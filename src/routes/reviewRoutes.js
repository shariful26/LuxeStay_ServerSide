import express from 'express';
import { readData, writeData } from '../utils/fileDb.js';

const router = express.Router();

// GET reviews
router.get('/', (req, res) => {
  const reviews = readData('reviews.json');
  const { hotelId } = req.query;
  if (hotelId) {
    return res.json(reviews.filter(r => r.hotelId === hotelId));
  }
  res.json(reviews);
});

// POST reply to review
router.post('/:id/reply', (req, res) => {
  const reviews = readData('reviews.json');
  const index = reviews.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Review not found' });

  reviews[index].reply = req.body.reply || '';
  writeData('reviews.json', reviews);
  res.json(reviews[index]);
});

export default router;
