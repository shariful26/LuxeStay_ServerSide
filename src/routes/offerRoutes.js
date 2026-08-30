import express from 'express';
import { readData } from '../utils/fileDb.js';

const router = express.Router();

// GET all promo offers
router.get('/', (req, res) => {
  res.json(readData('offers.json'));
});

// POST validate promo coupon code
router.post('/validate', (req, res) => {
  const { code } = req.body;
  const offers = readData('offers.json');
  const offer = offers.find(o => o.code.toUpperCase() === (code || '').toUpperCase());
  if (!offer) return res.status(404).json({ error: 'Invalid coupon code' });
  res.json(offer);
});

export default router;
