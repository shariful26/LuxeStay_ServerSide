import express from 'express';
import mongoose from 'mongoose';
import { Destination, Hotel } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';

const router = express.Router();

// GET all destinations
router.get('/', async (req, res) => {
  let destinations = [];
  try {
    if (mongoose.connection.readyState === 1) {
      destinations = await Destination.find({}).lean();
    }
  } catch (err) {}

  if (!destinations || destinations.length === 0) {
    destinations = readData('destinations.json');
  }

  res.json(destinations);
});

// GET destination by slug / ID with associated hotels
router.get('/:slug', async (req, res) => {
  let dest = null;
  let hotels = [];

  try {
    if (mongoose.connection.readyState === 1) {
      dest = await Destination.findOne({ $or: [{ slug: req.params.slug }, { id: req.params.slug }] }).lean();
      if (dest) {
        hotels = await Hotel.find({ destinationSlug: dest.slug }).lean();
      }
    }
  } catch (err) {}

  if (!dest) {
    const destinations = readData('destinations.json');
    dest = destinations.find(d => d.slug === req.params.slug || d.id === req.params.slug);
    if (dest) {
      hotels = readData('hotels.json').filter(h => h.destinationSlug === dest.slug);
    }
  }

  if (!dest) return res.status(404).json({ error: 'Destination not found' });
  res.json({ ...dest, hotels });
});

// POST new destination
router.post('/', async (req, res) => {
  const newDest = {
    id: `d_${Date.now()}`,
    name: req.body.name,
    slug: (req.body.name || 'new-dest').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    tagline: req.body.tagline || 'Exotic World Destination',
    country: req.body.country || 'International',
    image: req.body.image || 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=800&q=80',
    hotelCount: Number(req.body.hotelCount) || 0,
    startingPrice: Number(req.body.startingPrice) || 250,
    rating: Number(req.body.rating) || 4.9
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const mongoDest = new Destination(newDest);
      await mongoDest.save();
    } catch (e) {}
  }

  const destinations = readData('destinations.json');
  destinations.unshift(newDest);
  writeData('destinations.json', destinations);
  res.status(201).json(newDest);
});

// PUT update destination
router.put('/:id', async (req, res) => {
  let mongoUpdated = null;
  if (mongoose.connection.readyState === 1) {
    try {
      mongoUpdated = await Destination.findOneAndUpdate(
        { $or: [{ id: req.params.id }, { slug: req.params.id }] },
        { $set: req.body },
        { new: true }
      ).lean();
    } catch (e) {}
  }

  const destinations = readData('destinations.json');
  const index = destinations.findIndex(d => d.id === req.params.id || d.slug === req.params.id);
  if (index !== -1) {
    destinations[index] = { ...destinations[index], ...req.body };
    writeData('destinations.json', destinations);
    return res.json(mongoUpdated || destinations[index]);
  }

  if (mongoUpdated) return res.json(mongoUpdated);
  res.json({ message: 'Destination updated' });
});

// DELETE destination
router.delete('/:id', async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      await Destination.deleteOne({ $or: [{ id: req.params.id }, { slug: req.params.id }] });
    } catch (e) {}
  }

  const destinations = readData('destinations.json');
  const filtered = destinations.filter(d => d.id !== req.params.id && d.slug !== req.params.id);
  writeData('destinations.json', filtered);
  res.json({ success: true, message: 'Destination deleted successfully' });
});

export default router;
