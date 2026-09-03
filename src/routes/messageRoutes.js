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
    if (mongoose.connection.readyState === 1) {
      // Auto-purge remnant mock Alice Johnson messages
      await Message.deleteMany({
        $or: [
          { senderName: /Alice Johnson/i },
          { recipientName: /Alice Johnson/i },
          { senderId: 'alice' },
          { recipientId: 'alice' }
        ]
      });

      dbMessages = await Message.find({
        ...query,
        senderName: { $not: /Alice Johnson/i },
        recipientName: { $not: /Alice Johnson/i }
      })
        .select('id senderId senderName senderRole senderAvatar recipientId recipientName recipientRole text time read createdAt')
        .sort({ createdAt: -1 })
        .limit(maxLimit)
        .lean();

      // Return in chronological order
      dbMessages = dbMessages.reverse();
    }
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
