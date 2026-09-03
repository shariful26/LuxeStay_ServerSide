import express from 'express';
import mongoose from 'mongoose';
import { Room, Hotel } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';
import { connectDatabase } from '../config/db.js';

const router = express.Router();

// GET all rooms (with hotelId filtering, pagination, and projection)
router.get('/', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  await connectDatabase();
  const { hotelId, status, limit, page } = req.query;

  const mongoFilter = {};
  if (hotelId) {
    mongoFilter.hotelId = String(hotelId);
  }
  if (status) {
    mongoFilter.status = status;
  }

  const queryLimit = limit ? Math.min(Math.max(Number(limit) || 0, 1), 100) : 0;
  const queryPage = Math.max(Number(page) || 1, 1);
  const projection = 'id hotelId name slug type price size capacity bedType view images amenities inclusions available status housekeepingStatus housekeepingPriority housekeepingNotes createdAt';

  let rooms = [];
  try {
    if (mongoose.connection.readyState === 1) {
      let q = Room.find(mongoFilter).select(projection).sort({ createdAt: -1 });
      if (queryLimit > 0) {
        q = q.skip((queryPage - 1) * queryLimit).limit(queryLimit);
      }
      rooms = await q.lean();
    }
  } catch (err) {
    // safe fallback
  }

  if (!rooms || rooms.length === 0) {
    let localRooms = readData('rooms.json') || [];
    if (hotelId) {
      localRooms = localRooms.filter(r => String(r.hotelId) === String(hotelId));
    }
    if (status) {
      localRooms = localRooms.filter(r => String(r.status || '') === status);
    }
    if (queryLimit > 0) {
      localRooms = localRooms.slice((queryPage - 1) * queryLimit, queryPage * queryLimit);
    }
    return res.json(localRooms);
  }

  res.json(rooms);
});

// GET room by ID / slug
router.get('/:id', async (req, res) => {
  await connectDatabase();
  let room = null;
  let hotel = null;

  try {
    if (mongoose.connection.readyState === 1) {
      room = await Room.findOne({ $or: [{ id: req.params.id }, { slug: req.params.id }] }).lean();
      if (room && room.hotelId) {
        hotel = await Hotel.findOne({ id: room.hotelId }).lean();
      }
    }
  } catch (err) {}

  if (!room) {
    const rooms = readData('rooms.json');
    room = rooms.find(r => r.id === req.params.id || r.slug === req.params.id);
    if (room) {
      hotel = readData('hotels.json').find(h => h.id === room.hotelId);
    }
  }

  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ ...room, hotel });
});

// POST create room
router.post('/', async (req, res) => {
  await connectDatabase();
  const newRoom = {
    id: `r${Date.now()}`,
    hotelId: req.body.hotelId || 'h1',
    name: req.body.name || 'New Luxury Room',
    slug: (req.body.name || 'new-room').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    type: req.body.type || 'Suite',
    price: Number(req.body.price) || 350,
    size: req.body.size || '65 m² / 700 sq ft',
    capacity: Number(req.body.capacity) || 2,
    bedType: req.body.bedType || '1 King Bed',
    view: req.body.view || 'Ocean View',
    images: req.body.image ? [req.body.image] : (req.body.images || ["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80"]),
    amenities: req.body.amenities || ["Private Heated Pool", "Balcony Lounge", "Espresso Machine", "Marble Bath", "Smart TV"],
    inclusions: {
      freeCancellation: req.body.freeCancellation !== undefined ? req.body.freeCancellation : true,
      breakfastIncluded: req.body.breakfastIncluded !== undefined ? req.body.breakfastIncluded : true,
      instantVoucher: req.body.instantVoucher !== undefined ? req.body.instantVoucher : true
    },
    description: req.body.description || "Spacious luxury room with premium amenities and stunning views.",
    status: req.body.status || "Available",
    housekeeping: req.body.housekeeping || "Clean"
  };

  try {
    if (mongoose.connection.readyState === 1) {
      const mongoRoom = new Room(newRoom);
      await mongoRoom.save();
    }
  } catch (err) {
    // safe fallback
  }

  const rooms = readData('rooms.json');
  rooms.unshift(newRoom);
  writeData('rooms.json', rooms);

  res.status(201).json(newRoom);
});

// PUT update room
router.put('/:id', async (req, res) => {
  await connectDatabase();
  let updatedRoom = null;
  try {
    if (mongoose.connection.readyState === 1) {
      updatedRoom = await Room.findOneAndUpdate(
        { $or: [{ id: req.params.id }, { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }, { slug: req.params.id }] },
        { $set: req.body },
        { new: true }
      ).lean();
    }
  } catch (err) {}

  let rooms = readData('rooms.json');
  const index = rooms.findIndex(r => r.id === req.params.id || r.slug === req.params.id);
  if (index !== -1) {
    rooms[index] = { ...rooms[index], ...req.body };
    writeData('rooms.json', rooms);
    return res.json(updatedRoom || rooms[index]);
  }

  if (updatedRoom) return res.json(updatedRoom);
  res.json({ message: 'Room updated' });
});

// PUT update housekeeping status & priority
router.put('/:id/housekeeping', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  await connectDatabase();
  const { id } = req.params;
  const { housekeepingStatus, housekeepingPriority, housekeepingNotes } = req.body;

  let mongoUpdated = null;
  if (mongoose.connection.readyState === 1) {
    try {
      mongoUpdated = await Room.findOneAndUpdate(
        { $or: [{ id: String(id) }, { _id: mongoose.isValidObjectId(id) ? id : null }, { slug: id }] },
        { 
          $set: { 
            housekeepingStatus, 
            housekeepingPriority: housekeepingPriority || 'Medium', 
            housekeepingNotes: housekeepingNotes !== undefined ? housekeepingNotes : '',
            updatedAt: new Date().toISOString()
          } 
        },
        { new: true }
      ).lean();
    } catch (err) {
      // safe fallback
    }
  }

  let rooms = readData('rooms.json') || [];
  const index = rooms.findIndex(r => r.id === id || r.slug === id);
  if (index !== -1) {
    rooms[index] = { 
      ...rooms[index], 
      housekeepingStatus: housekeepingStatus || rooms[index].housekeepingStatus,
      housekeepingPriority: housekeepingPriority || rooms[index].housekeepingPriority || 'Medium',
      housekeepingNotes: housekeepingNotes !== undefined ? housekeepingNotes : (rooms[index].housekeepingNotes || ''),
      updatedAt: new Date().toISOString()
    };
    writeData('rooms.json', rooms);
    return res.json(mongoUpdated || rooms[index]);
  }

  if (mongoUpdated) return res.json(mongoUpdated);
  res.json({ id, housekeepingStatus, housekeepingPriority: housekeepingPriority || 'Medium', housekeepingNotes: housekeepingNotes || '' });
});

// DELETE room
router.delete('/:id', async (req, res) => {
  await connectDatabase();
  try {
    if (mongoose.connection.readyState === 1) {
      await Room.deleteOne({
        $or: [{ id: req.params.id }, { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }, { slug: req.params.id }]
      });
    }
  } catch (err) {}

  let rooms = readData('rooms.json');
  rooms = rooms.filter(r => r.id !== req.params.id && r.slug !== req.params.id);
  writeData('rooms.json', rooms);

  res.json({ success: true, message: 'Room deleted successfully' });
});

export default router;
