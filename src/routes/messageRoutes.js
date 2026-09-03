import express from 'express';
import mongoose from 'mongoose';
import { Message } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';
import { connectDatabase } from '../config/db.js';

const router = express.Router();

// Resilient In-Memory cache for live serverless messages
let inMemoryMessages = null;

const getMessagesStore = () => {
  if (!inMemoryMessages) {
    inMemoryMessages = readData('messages.json') || [];
  }
  return inMemoryMessages;
};

// GET messages (filtered by authenticated user/role with limit & projection)
router.get('/', async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

  await connectDatabase();
  const { userId, role, limit } = req.query;
  const maxLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

  let query = {};
  if (userId) {
    const cleanId = String(userId).trim();
    if (role === 'manager') {
      query = {
        $or: [
          { senderId: cleanId },
          { recipientId: cleanId },
          { recipientId: 'partner1' },
          { recipientId: 'manager' },
          { recipientRole: 'manager' }
        ]
      };
    } else if (role === 'customer') {
      query = {
        $or: [
          { senderId: cleanId },
          { recipientId: cleanId }
        ]
      };
    } else if (role !== 'admin') {
      query = {
        $or: [
          { senderId: cleanId },
          { recipientId: cleanId }
        ]
      };
    }
  }

  let dbMessages = [];
  try {
    dbMessages = await Message.find(query)
      .select('id senderId senderName senderRole senderAvatar recipientId recipientName recipientRole text time read createdAt')
      .sort({ createdAt: -1 })
      .limit(maxLimit)
      .lean();

    // Return in chronological order
    dbMessages = dbMessages.reverse();
  } catch (err) {
    // safe fallback
  }

  // Pure real MongoDB messages (no fake messages.json data)
  res.json(dbMessages || []);
});

// POST send new message
router.post('/', async (req, res) => {
  await connectDatabase();
  const newMessage = {
    id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    senderId: req.body.senderId,
    senderName: req.body.senderName,
    senderRole: req.body.senderRole,
    senderAvatar: req.body.senderAvatar || '',
    recipientId: req.body.recipientId,
    recipientName: req.body.recipientName,
    recipientRole: req.body.recipientRole || (req.body.senderRole === 'customer' ? 'manager' : 'customer'),
    text: req.body.text,
    time: req.body.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    read: false,
    createdAt: new Date()
  };

  // Push to in-memory store immediately
  const store = getMessagesStore();
  store.push(newMessage);

  // Direct persistence to MongoDB Atlas
  try {
    const mongoMsg = new Message(newMessage);
    await mongoMsg.save();
  } catch (err) {
    // safe fallback
  }

  writeData('messages.json', store);
  res.status(201).json(newMessage);
});

// PUT mark messages as read
router.put('/read', async (req, res) => {
  await connectDatabase();
  const { senderId, recipientId, role } = req.body;
  if (!senderId) {
    return res.status(400).json({ error: 'senderId is required' });
  }

  const sId = String(senderId).trim();
  const rId = recipientId ? String(recipientId).trim() : '';

  const orConditions = [
    { senderId: sId },
    { senderRole: sId }
  ];

  if (sId === 'manager' || role === 'manager') {
    orConditions.push({ senderRole: 'customer' });
  }

  const filter = {
    $or: orConditions,
    read: false
  };

  if (rId) {
    const recipientOr = [
      { recipientId: rId },
      { recipientRole: rId }
    ];
    if (role === 'manager' || rId === 'manager') {
      recipientOr.push({ recipientRole: 'manager' }, { recipientId: 'manager' }, { recipientId: 'partner1' });
    }
    if (role === 'admin' || rId === 'admin') {
      recipientOr.push({ recipientRole: 'admin' }, { recipientId: 'admin' });
    }
    if (role === 'customer') {
      recipientOr.push({ recipientRole: 'customer' });
    }
    filter.$and = [{ $or: recipientOr }];
  }

  try {
    if (mongoose.connection.readyState === 1) {
      await Message.updateMany(filter, { $set: { read: true } });
    }
  } catch (err) {}

  const store = getMessagesStore();
  let updated = false;

  store.forEach(msg => {
    const matchesSender = String(msg.senderId) === sId || msg.senderRole === sId;
    if (matchesSender && !msg.read) {
      msg.read = true;
      updated = true;
    }
  });

  if (updated) {
    writeData('messages.json', store);
  }

  res.json({ success: true, message: 'Messages marked as read' });
});

// PUT edit individual message
router.put('/:id', async (req, res) => {
  await connectDatabase();
  const { id } = req.params;
  const { text } = req.body;

  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'Message text is required' });
  }

  const cleanText = String(text).trim();

  try {
    if (mongoose.connection.readyState === 1) {
      await Message.findOneAndUpdate(
        { $or: [{ id: String(id) }, { _id: mongoose.isValidObjectId(id) ? id : null }] },
        { $set: { text: cleanText, edited: true } }
      );
    }
  } catch (err) {}

  const store = getMessagesStore();
  const target = store.find(m => String(m.id) === String(id));
  if (target) {
    target.text = cleanText;
    target.edited = true;
    writeData('messages.json', store);
    return res.json(target);
  }

  res.json({ id, text: cleanText, edited: true, success: true });
});

// DELETE individual message
router.delete('/:id', async (req, res) => {
  await connectDatabase();
  const { id } = req.params;

  try {
    if (mongoose.connection.readyState === 1) {
      await Message.deleteOne({
        $or: [{ id: String(id) }, { _id: mongoose.isValidObjectId(id) ? id : null }]
      });
    }
  } catch (err) {}

  const store = getMessagesStore();
  const idx = store.findIndex(m => String(m.id) === String(id));
  if (idx !== -1) {
    store.splice(idx, 1);
    writeData('messages.json', store);
  }

  res.json({ success: true, message: 'Message deleted', id });
});

// DELETE all messages in conversation (3-dot Clear Chat)
router.post('/clear-conversation', async (req, res) => {
  await connectDatabase();
  const { user1, user2 } = req.body;
  if (!user1 || !user2) {
    return res.status(400).json({ error: 'user1 and user2 are required' });
  }

  const u1 = String(user1).trim();
  const u2 = String(user2).trim();

  const conversationFilter = {
    $or: [
      { senderId: u1, recipientId: u2 },
      { senderId: u2, recipientId: u1 },
      { senderId: u1, recipientRole: u2 },
      { senderId: u2, recipientRole: u1 },
      { senderRole: u1, recipientId: u2 },
      { senderRole: u2, recipientId: u1 },
      { senderRole: u1, recipientRole: u2 },
      { senderRole: u2, recipientRole: u1 }
    ]
  };

  try {
    if (mongoose.connection.readyState === 1) {
      await Message.deleteMany(conversationFilter);
    }
  } catch (err) {}

  const store = getMessagesStore();
  const remaining = store.filter(m => {
    const match = 
      (String(m.senderId) === u1 && String(m.recipientId) === u2) ||
      (String(m.senderId) === u2 && String(m.recipientId) === u1) ||
      (String(m.senderId) === u1 && m.recipientRole === u2) ||
      (String(m.senderId) === u2 && m.recipientRole === u1);
    return !match;
  });

  writeData('messages.json', remaining);
  res.json({ success: true, message: 'All messages in conversation deleted' });
});

export default router;
