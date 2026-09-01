import express from 'express';
import mongoose from 'mongoose';
import { Room, Hotel } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';

const router = express.Router();

// GET all rooms
router.get('/', async (req, res) => {
  let rooms = [];
  try {
    if (mongoose.connection.readyState === 1) {
      rooms = await Room.find({}).lean();
    }
  } catch (err) {
    console.warn('⚠️ MongoDB Room query warning:', err.message);
  }

  if (!rooms || rooms.length === 0) {
    rooms = readData('rooms.json');
  }

  const { hotelId, destination } = req.query;
  if (hotelId) {
    rooms = rooms.filter(r => String(r.hotelId) === String(hotelId));
  }

  res.json(rooms);
});

// GET room by ID / slug
router.get('/:id', async (req, res) => {
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
    console.warn('⚠️ MongoDB Room save warning:', err.message);
  }

  const rooms = readData('rooms.json');
  rooms.unshift(newRoom);
  writeData('rooms.json', rooms);

  res.status(201).json(newRoom);
});

// PUT update room
router.put('/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await Room.findOneAndUpdate({ id: req.params.id }, { $set: req.body });
    }
  } catch (err) {}

  let rooms = readData('rooms.json');
  const index = rooms.findIndex(r => r.id === req.params.id);
  if (index !== -1) {
    rooms[index] = { ...rooms[index], ...req.body };
    writeData('rooms.json', rooms);
    return res.json(rooms[index]);
  }

  res.json({ message: 'Room updated' });
});

// DELETE room
router.delete('/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await Room.deleteOne({ id: req.params.id });
    }
  } catch (err) {}

  let rooms = readData('rooms.json');
  rooms = rooms.filter(r => r.id !== req.params.id);
  writeData('rooms.json', rooms);

  res.json({ success: true, message: 'Room deleted successfully' });
});

export default router;
