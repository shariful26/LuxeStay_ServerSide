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

// GET all messages
router.get('/', async (req, res) => {
  await connectDatabase();
  let dbMessages = [];
  try {
    if (mongoose.connection.readyState === 1) {
      dbMessages = await Message.find({}).sort({ createdAt: 1 }).lean();
    }
  } catch (err) {
    // safe fallback
  }

  const localStore = getMessagesStore();

  if (dbMessages && dbMessages.length > 0) {
    // Merge any newer in-memory messages with DB messages
    const dbMap = new Map(dbMessages.map(m => [m.id, m]));
    localStore.forEach(m => {
      if (!dbMap.has(m.id)) {
        dbMessages.push(m);
      }
    });
    inMemoryMessages = dbMessages;
    return res.json(dbMessages);
  }

  res.json(localStore);
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

  // Background persistence to MongoDB Atlas
  try {
    if (mongoose.connection.readyState === 1) {
      const mongoMsg = new Message(newMessage);
      await mongoMsg.save();
    }
  } catch (err) {
    // safe fallback
  }

  writeData('messages.json', store);
  res.status(201).json(newMessage);
});

// PUT mark messages from a user as read
router.put('/read', async (req, res) => {
  await connectDatabase();
  const { senderId, recipientId } = req.body;
  if (!senderId || !recipientId) {
    return res.status(400).json({ error: 'senderId and recipientId are required' });
  }

  try {
    if (mongoose.connection.readyState === 1) {
      await Message.updateMany(
        { senderId: String(senderId), recipientId: String(recipientId), read: false },
        { $set: { read: true } }
      );
    }
  } catch (err) {
    // safe fallback
  }

  const store = getMessagesStore();
  let updated = false;

  store.forEach(msg => {
    if (String(msg.senderId) === String(senderId) && String(msg.recipientId) === String(recipientId) && !msg.read) {
      msg.read = true;
      updated = true;
    }
  });

  if (updated) {
    writeData('messages.json', store);
  }

  res.json({ success: true, message: 'Messages marked as read' });
});

export default router;
