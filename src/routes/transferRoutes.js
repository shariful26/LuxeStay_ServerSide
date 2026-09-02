import express from 'express';
import mongoose from 'mongoose';
import { Transfer } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';

const router = express.Router();

// GET transfers
router.get('/', async (req, res) => {
  let transfers = [];
  try {
    if (mongoose.connection.readyState === 1) {
      transfers = await Transfer.find({}).sort({ createdAt: -1 }).lean();
    }
  } catch (e) {}

  if (!transfers || transfers.length === 0) {
    transfers = readData('transfers.json');
  }

  const { partnerId } = req.query;
  if (partnerId) {
    return res.json(transfers.filter(t => t.partnerId === partnerId));
  }
  res.json(transfers);
});

// POST dispatch / request transfer
router.post('/', async (req, res) => {
  const newTransfer = {
    id: `TR-${Math.floor(10000 + Math.random() * 90000)}`,
    partnerId: req.body.partnerId || 'p1',
    partnerName: req.body.partnerName || 'Partner',
    amount: Number(req.body.amount) || 200,
    destinationType: req.body.destinationType || 'Personal Bank Account',
    accountName: req.body.accountName || 'Personal Account Holder',
    accountNumber: req.body.accountNumber || 'Acc/Phone No',
    provider: req.body.provider || 'Bank / Payment Gateway',
    status: 'Dispatched & Completed',
    referenceCode: `TXN-${Date.now().toString().slice(-8)}`,
    createdAt: new Date().toISOString()
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const mongoTransfer = new Transfer(newTransfer);
      await mongoTransfer.save();
    } catch (e) {}
  }

  const transfers = readData('transfers.json');
  transfers.unshift(newTransfer);
  writeData('transfers.json', transfers);
  res.status(201).json(newTransfer);
});

export default router;
