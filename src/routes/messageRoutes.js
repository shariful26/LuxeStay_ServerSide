import express from 'express';
import { readData, writeData } from '../utils/fileDb.js';

const router = express.Router();

// GET all messages
router.get('/', (req, res) => {
  let messages = readData('messages.json');
  if (!messages || messages.length === 0) {
    messages = [
      {
        id: 'msg1',
        senderId: 'alice',
        senderName: 'Alice Johnson',
        senderRole: 'customer',
        recipientId: 'partner1',
        recipientName: 'Hotel Concierge',
        text: 'Hi, can I request a late check-out for Room 101?',
        time: '9:15 AM',
        read: true,
        createdAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'msg2',
        senderId: 'partner1',
        senderName: 'Hotel Concierge',
        senderRole: 'manager',
        recipientId: 'alice',
        recipientName: 'Alice Johnson',
        text: 'Hi Alice, we can accommodate a late check-out for you. How late would you like to stay?',
        time: '9:30 AM',
        read: true,
        createdAt: new Date(Date.now() - 1800000).toISOString()
      }
    ];
    writeData('messages.json', messages);
  }
  res.json(messages);
});

// POST send new message
router.post('/', (req, res) => {
  const messages = readData('messages.json');
  const newMessage = {
    id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    senderId: req.body.senderId,
    senderName: req.body.senderName,
    senderRole: req.body.senderRole,
    senderAvatar: req.body.senderAvatar || '',
    recipientId: req.body.recipientId,
    recipientName: req.body.recipientName,
    text: req.body.text,
    time: req.body.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    read: false,
    createdAt: new Date().toISOString()
  };
  messages.push(newMessage);
  writeData('messages.json', messages);
  res.status(201).json(newMessage);
});

// PUT mark messages from a user as read
router.put('/read', (req, res) => {
  const { senderId, recipientId } = req.body;
  if (!senderId || !recipientId) {
    return res.status(400).json({ error: 'senderId and recipientId are required' });
  }

  const messages = readData('messages.json');
  let updated = false;

  messages.forEach(msg => {
    // If the message was sent by the customer (senderId) to the manager (recipientId), mark as read
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
