import express from 'express';
import mongoose from 'mongoose';
import { Room } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';

const router = express.Router();

// GET all rooms
router.get('/', async (req, res) => {
  let rooms = [];
  try {
    if (mongoose.connection.readyState === 1) {
      rooms = await Room.find({}).lean();
    }
  } catch (e) {}

  if (!rooms || rooms.length === 0) {
    rooms = readData('rooms.json');
  }
  res.json(rooms);
});

// GET room by ID / slug
router.get('/:id', (req, res) => {
  const rooms = readData('rooms.json');
  const room = rooms.find(r => r.id === req.params.id || r.slug === req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const hotel = readData('hotels.json').find(h => h.id === room.hotelId);
  res.json({ ...room, hotel });
});

// POST create room
router.post('/', (req, res) => {
  const rooms = readData('rooms.json');
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
    status: req.body.status || "Available"
  };

  rooms.unshift(newRoom);
  writeData('rooms.json', rooms);
  res.status(201).json(newRoom);
});

// PUT update room
router.put('/:id', (req, res) => {
  let rooms = readData('rooms.json');
  const index = rooms.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Room not found' });

  const updatedRoom = {
    ...rooms[index],
    name: req.body.name !== undefined ? req.body.name : rooms[index].name,
    type: req.body.type !== undefined ? req.body.type : rooms[index].type,
    price: req.body.price !== undefined ? Number(req.body.price) : rooms[index].price,
    capacity: req.body.capacity !== undefined ? Number(req.body.capacity) : rooms[index].capacity,
    bedType: req.body.bedType !== undefined ? req.body.bedType : rooms[index].bedType,
    size: req.body.size !== undefined ? req.body.size : rooms[index].size,
    view: req.body.view !== undefined ? req.body.view : rooms[index].view,
    status: req.body.status !== undefined ? req.body.status : rooms[index].status,
    description: req.body.description !== undefined ? req.body.description : rooms[index].description,
    images: req.body.image ? [req.body.image] : (req.body.images || rooms[index].images),
    inclusions: {
      freeCancellation: req.body.freeCancellation !== undefined ? req.body.freeCancellation : (rooms[index].inclusions?.freeCancellation ?? true),
      breakfastIncluded: req.body.breakfastIncluded !== undefined ? req.body.breakfastIncluded : (rooms[index].inclusions?.breakfastIncluded ?? true),
      instantVoucher: req.body.instantVoucher !== undefined ? req.body.instantVoucher : (rooms[index].inclusions?.instantVoucher ?? true)
    }
  };

  rooms[index] = updatedRoom;
  writeData('rooms.json', rooms);
  res.json(updatedRoom);
});

// PUT update room housekeeping status
router.put('/:id/housekeeping', (req, res) => {
  const rooms = readData('rooms.json');
  const index = rooms.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Room not found' });

  rooms[index].housekeepingStatus = req.body.housekeepingStatus || 'Ready';
  rooms[index].housekeepingPriority = req.body.housekeepingPriority || 'Medium';
  rooms[index].housekeepingNotes = req.body.housekeepingNotes || '';
  
  writeData('rooms.json', rooms);
  res.json(rooms[index]);
});

// DELETE room
router.delete('/:id', (req, res) => {
  let rooms = readData('rooms.json');
  rooms = rooms.filter(r => r.id !== req.params.id);
  writeData('rooms.json', rooms);
  res.json({ message: 'Room deleted successfully' });
});

export default router;
