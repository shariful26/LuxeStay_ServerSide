import express from 'express';
import mongoose from 'mongoose';
import { Message } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';

const router = express.Router();

// GET all messages
router.get('/', async (req, res) => {
  let messages = [];
  try {
    if (mongoose.connection.readyState === 1) {
      messages = await Message.find({}).sort({ createdAt: 1 }).lean();
    }
  } catch (err) {
    console.warn('⚠️ MongoDB Message query warning:', err.message);
  }

  if (!messages || messages.length === 0) {
    messages = readData('messages.json');
  }

  res.json(messages);
});

// POST send new message
router.post('/', async (req, res) => {
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

  try {
    if (mongoose.connection.readyState === 1) {
      const mongoMsg = new Message(newMessage);
      await mongoMsg.save();
    }
  } catch (err) {
    console.warn('⚠️ MongoDB Message save warning:', err.message);
  }

  // Also write to local JSON file for fallback
  const messages = readData('messages.json');
  messages.push(newMessage);
  writeData('messages.json', messages);

  res.status(201).json(newMessage);
});

// PUT mark messages from a user as read
router.put('/read', async (req, res) => {
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
    console.warn('⚠️ MongoDB Message update warning:', err.message);
  }

  const messages = readData('messages.json');
  let updated = false;

  messages.forEach(msg => {
    if (String(msg.senderId) === String(senderId) && String(msg.recipientId) === String(recipientId) && !msg.read) {
      msg.read = true;
      updated = true;
    }
  });

  if (updated) {
    writeData('messages.json', messages);
  }

  res.json({ success: true, message: 'Messages marked as read' });
});

export default router;
