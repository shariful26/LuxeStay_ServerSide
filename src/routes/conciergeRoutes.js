import express from 'express';
import mongoose from 'mongoose';
import { Concierge, ConciergeRequest } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';
import { connectDatabase } from '../config/db.js';

const router = express.Router();

// GET concierge staff
router.get('/', async (req, res) => {
  await connectDatabase();
  let staff = [];
  try {
    if (mongoose.connection.readyState === 1) {
      staff = await Concierge.find({}).sort({ createdAt: -1 }).lean();
    }
  } catch (err) {}

  if (!staff || staff.length === 0) {
    staff = readData('concierge.json') || [];
  }

  res.json(staff);
});

// POST add concierge staff
router.post('/', async (req, res) => {
  await connectDatabase();
  const newStaff = {
    id: `FLG${Math.floor(100 + Math.random() * 900)}`,
    name: req.body.name,
    position: req.body.position || 'Head Concierge',
    schedule: req.body.schedule || 'Monday - Friday | 8 AM - 4 PM',
    contact: req.body.contact || '+1 (555) 123-4567',
    email: req.body.email || '',
    status: req.body.status || 'Active',
    hotelId: req.body.hotelId || 'h1'
  };

  try {
    if (mongoose.connection.readyState === 1) {
      const doc = new Concierge(newStaff);
      await doc.save();
    }
  } catch (err) {}

  const staff = readData('concierge.json') || [];
  staff.unshift(newStaff);
  writeData('concierge.json', staff);

  res.status(201).json(newStaff);
});

// PUT update concierge staff
router.put('/:id', async (req, res) => {
  await connectDatabase();
  let updatedDoc = null;
  try {
    if (mongoose.connection.readyState === 1) {
      updatedDoc = await Concierge.findOneAndUpdate(
        { $or: [{ id: req.params.id }, { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }] },
        { $set: req.body },
        { new: true }
      ).lean();
    }
  } catch (err) {}

  const staff = readData('concierge.json') || [];
  const index = staff.findIndex(s => s.id === req.params.id);
  if (index !== -1) {
    staff[index] = { ...staff[index], ...req.body };
    writeData('concierge.json', staff);
    return res.json(updatedDoc || staff[index]);
  }

  if (updatedDoc) return res.json(updatedDoc);
  res.json({ id: req.params.id, ...req.body });
});

// DELETE concierge staff
router.delete('/:id', async (req, res) => {
  await connectDatabase();
  try {
    if (mongoose.connection.readyState === 1) {
      await Concierge.deleteOne({
        $or: [{ id: req.params.id }, { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }]
      });
    }
  } catch (err) {}

  let staff = readData('concierge.json') || [];
  staff = staff.filter(s => s.id !== req.params.id);
  writeData('concierge.json', staff);

  res.json({ success: true, message: 'Concierge staff deleted' });
});

// GET concierge guest requests
router.get('/requests/all', async (req, res) => {
  await connectDatabase();
  let requests = [];
  try {
    if (mongoose.connection.readyState === 1) {
      requests = await ConciergeRequest.find({}).sort({ createdAt: -1 }).lean();
    }
  } catch (err) {}

  if (!requests || requests.length === 0) {
    requests = readData('concierge-requests.json') || [];
  }

  res.json(requests);
});

// POST concierge guest request
router.post('/requests', async (req, res) => {
  await connectDatabase();
  const newRequest = {
    id: `req_${Date.now()}`,
    guestName: req.body.guestName || 'Guest',
    roomNumber: req.body.roomNumber || 'Suite 101',
    requestType: req.body.requestType || 'VIP Dining Reservation',
    status: req.body.status || 'Pending',
    notes: req.body.notes || '',
    time: req.body.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  try {
    if (mongoose.connection.readyState === 1) {
      const doc = new ConciergeRequest(newRequest);
      await doc.save();
    }
  } catch (err) {}

  const requests = readData('concierge-requests.json') || [];
  requests.unshift(newRequest);
  writeData('concierge-requests.json', requests);

  res.status(201).json(newRequest);
});

// PUT update concierge guest request
router.put('/requests/:id', async (req, res) => {
  await connectDatabase();
  let updatedDoc = null;
  try {
    if (mongoose.connection.readyState === 1) {
      updatedDoc = await ConciergeRequest.findOneAndUpdate(
        { $or: [{ id: req.params.id }, { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }] },
        { $set: req.body },
        { new: true }
      ).lean();
    }
  } catch (err) {}

  const requests = readData('concierge-requests.json') || [];
  const index = requests.findIndex(r => r.id === req.params.id);
  if (index !== -1) {
    requests[index] = { ...requests[index], ...req.body };
    writeData('concierge-requests.json', requests);
    return res.json(updatedDoc || requests[index]);
  }

  if (updatedDoc) return res.json(updatedDoc);
  res.json({ id: req.params.id, ...req.body });
});

export default router;
