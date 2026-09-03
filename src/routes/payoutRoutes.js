import express from 'express';
import mongoose from 'mongoose';
import { Payout } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';
import { connectDatabase } from '../config/db.js';

const router = express.Router();

// GET payouts (Always fresh, no caching)
router.get('/', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  await connectDatabase();
  let payouts = [];
  try {
    if (mongoose.connection.readyState === 1) {
      payouts = await Payout.find({}).sort({ createdAt: -1 }).lean();
    }
  } catch (e) {}

  if (!payouts || payouts.length === 0) {
    payouts = readData('payouts.json') || [];
  }

  const { partnerId } = req.query;
  if (partnerId) {
    return res.json(payouts.filter(p => p.partnerId === partnerId));
  }
  res.json(payouts);
});

// POST request payout
router.post('/', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  await connectDatabase();

  const newPayout = {
    id: req.body.id || `PO-${Math.floor(10000 + Math.random() * 90000)}`,
    partnerId: req.body.partnerId || 'p1',
    partnerName: req.body.partnerName || 'Partner',
    amount: Number(req.body.amount) || 500,
    method: req.body.method || 'International Bank Wire (SWIFT)',
    accountName: req.body.accountName || 'Beneficiary Account',
    accountDetails: req.body.accountDetails || 'SWIFT / IBAN Details',
    bankName: req.body.bankName || 'International Commercial Bank',
    status: req.body.status || 'Pending',
    createdAt: req.body.createdAt || new Date().toISOString()
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const mongoPayout = new Payout(newPayout);
      await mongoPayout.save();
    } catch (e) {
      console.error('Error saving payout to MongoDB:', e);
    }
  }

  const payouts = readData('payouts.json') || [];
  payouts.unshift(newPayout);
  writeData('payouts.json', payouts);
  res.status(201).json(newPayout);
});

// PUT update payout status
router.put('/:id/status', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  await connectDatabase();

  const { id } = req.params;
  const status = req.body.status || 'Completed';
  const processedAt = new Date().toISOString();

  let mongoUpdated = null;
  if (mongoose.connection.readyState === 1) {
    try {
      mongoUpdated = await Payout.findOneAndUpdate(
        { id },
        { $set: { status, processedAt } },
        { new: true }
      ).lean();
    } catch (e) {}
  }

  const payouts = readData('payouts.json') || [];
  const index = payouts.findIndex(p => p.id === id);
  if (index !== -1) {
    payouts[index].status = status;
    payouts[index].processedAt = processedAt;
    writeData('payouts.json', payouts);
    return res.json(mongoUpdated || payouts[index]);
  }

  if (mongoUpdated) return res.json(mongoUpdated);
  res.json({ id, status });
});

export default router;
