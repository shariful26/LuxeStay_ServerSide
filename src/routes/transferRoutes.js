import express from 'express';
import { readData, writeData } from '../utils/fileDb.js';

const router = express.Router();

// GET transfers
router.get('/', (req, res) => {
  const transfers = readData('transfers.json');
  const { partnerId } = req.query;
  if (partnerId) {
    return res.json(transfers.filter(t => t.partnerId === partnerId));
  }
  res.json(transfers);
});

// POST dispatch / request transfer
router.post('/', (req, res) => {
  const transfers = readData('transfers.json');
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

  transfers.unshift(newTransfer);
  writeData('transfers.json', transfers);
  res.status(201).json(newTransfer);
});

export default router;
