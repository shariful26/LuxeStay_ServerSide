import express from 'express';
import { readData } from '../utils/fileDb.js';

const router = express.Router();

// GET all destinations
router.get('/', (req, res) => {
  const destinations = readData('destinations.json');
  res.json(destinations);
});

// GET destination by slug / ID with associated hotels
router.get('/:slug', (req, res) => {
  const destinations = readData('destinations.json');
  const dest = destinations.find(d => d.slug === req.params.slug || d.id === req.params.slug);
  if (!dest) return res.status(404).json({ error: 'Destination not found' });
  const hotels = readData('hotels.json').filter(h => h.destinationSlug === dest.slug);
  res.json({ ...dest, hotels });
});

export default router;
