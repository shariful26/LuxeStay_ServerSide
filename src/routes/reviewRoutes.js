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
      reviews = await Review.find({}).sort({ createdAt: -1 }).lean();
    }
  } catch (err) {}

  if (!reviews || reviews.length === 0) {
    reviews = readData('reviews.json') || [];
  }

  const { hotelId } = req.query;
  if (hotelId) {
    return res.json(reviews.filter(r => String(r.hotelId) === String(hotelId)));
  }
  res.json(reviews);
});

// POST new customer review
router.post('/', async (req, res) => {
  try {
    const {
      hotelId,
      hotelName,
      guestName,
      guestAvatar,
      guestCountry,
      rating,
      categories,
      title,
      comment
    } = req.body;

    const newReview = {
      id: `rev-${Date.now()}`,
      hotelId: hotelId || 'h-1',
      hotelName: hotelName || 'LuxeStay Curated Resort',
      guestName: guestName || 'Verified Guest',
      guestAvatar: guestAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      guestCountry: guestCountry || 'United States',
      rating: Number(rating) || 5,
      categories: categories || {
        facilities: 5,
        cleanliness: 5,
        services: 5,
        comfort: 5,
        food: 5
      },
      title: title || 'Exceptional luxury experience',
      comment: comment || 'An absolute paradise. The views, private butler, and room amenities exceeded all expectations.',
      date: new Date().toISOString().split('T')[0],
      verifiedStay: true,
      helpfulCount: 0,
      partnerReply: null
    };

    if (mongoose.connection.readyState === 1) {
      try {
        await Review.create(newReview);
      } catch (dbErr) {
        console.warn('MongoDB review write error, fallback to JSON:', dbErr.message);
      }
    }

    const reviews = readData('reviews.json') || [];
    reviews.unshift(newReview);
    writeData('reviews.json', reviews);

    // Update Hotel aggregate rating
    try {
      const hotels = readData('hotels.json') || [];
      const hotelIdx = hotels.findIndex(h => String(h.id) === String(newReview.hotelId));
      if (hotelIdx !== -1) {
        const hotelReviews = reviews.filter(r => String(r.hotelId) === String(newReview.hotelId));
        const avg = (hotelReviews.reduce((sum, r) => sum + Number(r.rating || 5), 0) / hotelReviews.length).toFixed(1);
        hotels[hotelIdx].rating = Number(avg);
        hotels[hotelIdx].reviews = hotelReviews.length;
        hotels[hotelIdx].reviewsCount = hotelReviews.length;
        writeData('hotels.json', hotels);
      }
    } catch (e) {}

    res.status(201).json(newReview);
  } catch (error) {
    console.error('Error posting review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// POST reply to review
router.post('/:id/reply', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await Review.findOneAndUpdate({ id: req.params.id }, { $set: { partnerReply: req.body.reply, reply: req.body.reply } });
    }
  } catch (err) {}

  const reviews = readData('reviews.json') || [];
  const index = reviews.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Review not found' });

  reviews[index].reply = req.body.reply || '';
  reviews[index].partnerReply = req.body.reply || '';
  writeData('reviews.json', reviews);
  res.json(reviews[index]);
});

export default router;
