import express from 'express';
import mongoose from 'mongoose';
import { Offer } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';
import { connectDatabase } from '../config/db.js';

const router = express.Router();

// GET all promo offers
router.get('/', async (req, res) => {
  await connectDatabase();
  let offers = [];
  try {
    if (mongoose.connection.readyState === 1) {
      offers = await Offer.find({}).lean();
    }
  } catch (e) {}

  if (!offers || offers.length === 0) {
    offers = readData('offers.json') || [];
  }

  res.json(offers);
});

// POST create offer
router.post('/', async (req, res) => {
  await connectDatabase();
  const newOffer = {
    id: req.body.id || `off_${Date.now()}`,
    code: (req.body.code || 'LUXE10').toUpperCase(),
    title: req.body.title || 'Special Promotion',
    description: req.body.description || 'Exclusive discount on luxury stays.',
    discount: Number(req.body.discount) || 10,
    validUntil: req.body.validUntil || '2026-12-31',
    category: req.body.category || 'All Hotels',
    image: req.body.image || 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80'
  };

  try {
    if (mongoose.connection.readyState === 1) {
      const doc = new Offer(newOffer);
      await doc.save();
    }
  } catch (e) {}

  const offers = readData('offers.json') || [];
  offers.unshift(newOffer);
  writeData('offers.json', offers);

  res.status(201).json(newOffer);
});

// PUT update offer
router.put('/:id', async (req, res) => {
  await connectDatabase();
  let updatedDoc = null;
  try {
    if (mongoose.connection.readyState === 1) {
      updatedDoc = await Offer.findOneAndUpdate(
        { $or: [{ id: req.params.id }, { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }, { code: req.params.id.toUpperCase() }] },
        { $set: req.body },
        { new: true }
      ).lean();
    }
  } catch (e) {}

  const offers = readData('offers.json') || [];
  const index = offers.findIndex(o => o.id === req.params.id || o.code === req.params.id.toUpperCase());
  if (index !== -1) {
    offers[index] = { ...offers[index], ...req.body };
    writeData('offers.json', offers);
    return res.json(updatedDoc || offers[index]);
  }

  if (updatedDoc) return res.json(updatedDoc);
  res.json({ id: req.params.id, ...req.body });
});

// DELETE offer
router.delete('/:id', async (req, res) => {
  await connectDatabase();
  try {
    if (mongoose.connection.readyState === 1) {
      await Offer.deleteOne({
        $or: [{ id: req.params.id }, { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }, { code: req.params.id.toUpperCase() }]
      });
    }
  } catch (e) {}

  let offers = readData('offers.json') || [];
  offers = offers.filter(o => o.id !== req.params.id && o.code !== req.params.id.toUpperCase());
  writeData('offers.json', offers);

  res.json({ success: true, message: 'Offer deleted successfully' });
});

// POST validate promo coupon code
router.post('/validate', async (req, res) => {
  await connectDatabase();
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Promo code is required' });

  const cleanCode = code.toUpperCase().trim();
  let offer = null;

  try {
    if (mongoose.connection.readyState === 1) {
      offer = await Offer.findOne({ code: cleanCode }).lean();
    }
  } catch (e) {}

  if (!offer) {
    const offers = readData('offers.json') || [];
    offer = offers.find(o => o.code && o.code.toUpperCase() === cleanCode);
  }

  if (!offer) return res.status(404).json({ error: 'Invalid coupon code' });
  res.json(offer);
});

export default router;
