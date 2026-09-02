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

  const { hotelId, role, scope } = req.query;

  // Filter by hotelId if specified
  if (hotelId) {
    reviews = reviews.filter(r => String(r.hotelId) === String(hotelId));
  }

  // If public guest view (not admin or manager), hide 'only_me' / 'private' / 'rejected' reviews
  if (role !== 'admin' && role !== 'manager' && scope !== 'all') {
    reviews = reviews.filter(r => r.visibility !== 'only_me' && r.visibility !== 'private' && r.status !== 'rejected');
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
      comment,
      visibility
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
      partnerReply: null,
      status: 'approved',
      visibility: visibility || 'public'
    };

    if (mongoose.connection.readyState === 1) {
      try {
        await Review.create(newReview);
      } catch (dbErr) {
        // safe fallback
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

// PATCH review status and visibility (public, only_me, approved, rejected)
router.patch('/:id/status', async (req, res) => {
  const { status, visibility } = req.body;
  const updates = {};
  if (status !== undefined) updates.status = status;
  if (visibility !== undefined) updates.visibility = visibility;

  try {
    if (mongoose.connection.readyState === 1) {
      await Review.findOneAndUpdate({ id: req.params.id }, { $set: updates });
    }
  } catch (err) {}

  const reviews = readData('reviews.json') || [];
  const index = reviews.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Review not found' });

  reviews[index] = { ...reviews[index], ...updates };
  writeData('reviews.json', reviews);
  res.json(reviews[index]);
});

// DELETE review
router.delete('/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await Review.findOneAndDelete({ id: req.params.id });
    }
  } catch (err) {}

  const reviews = readData('reviews.json') || [];
  const filtered = reviews.filter(r => r.id !== req.params.id);
  writeData('reviews.json', filtered);
  res.json({ success: true, message: 'Review deleted successfully' });
});

export default router;
