import express from 'express';
import mongoose from 'mongoose';
import { Review } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';

const router = express.Router();

// GET reviews
router.get('/', async (req, res) => {
  let reviews = [];
  try {
    if (mongoose.connection.readyState === 1) {
      reviews = await Review.find({}).lean();
    }
  } catch (err) {}

  if (!reviews || reviews.length === 0) {
    reviews = readData('reviews.json');
  }

  const { hotelId } = req.query;
  if (hotelId) {
    return res.json(reviews.filter(r => String(r.hotelId) === String(hotelId)));
  }
  res.json(reviews);
});

// POST reply to review
router.post('/:id/reply', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await Review.findOneAndUpdate({ id: req.params.id }, { $set: { partnerReply: req.body.reply, reply: req.body.reply } });
    }
  } catch (err) {}

  const reviews = readData('reviews.json');
  const index = reviews.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Review not found' });

  reviews[index].reply = req.body.reply || '';
  reviews[index].partnerReply = req.body.reply || '';
  writeData('reviews.json', reviews);
  res.json(reviews[index]);
});

export default router;
