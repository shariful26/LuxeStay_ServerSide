import express from 'express';
import { readData, writeData } from '../utils/fileDb.js';

const router = express.Router();

// GET payouts
router.get('/', (req, res) => {
  const payouts = readData('payouts.json');
  const { partnerId } = req.query;
  if (partnerId) {
    return res.json(payouts.filter(p => p.partnerId === partnerId));
  }
  res.json(payouts);
});

// POST request payout
router.post('/', (req, res) => {
  const payouts = readData('payouts.json');
  const newPayout = {
    id: `PO-${Math.floor(10000 + Math.random() * 90000)}`,
    partnerId: req.body.partnerId || 'p1',
    partnerName: req.body.partnerName || 'Partner',
    amount: Number(req.body.amount) || 500,
    method: req.body.method || 'International Bank Wire (SWIFT)',
    accountName: req.body.accountName || 'Beneficiary Account',
    accountDetails: req.body.accountDetails || 'SWIFT / IBAN Details',
    bankName: req.body.bankName || 'International Commercial Bank',
    status: 'Pending',
    createdAt: new Date().toISOString()
  };

  payouts.unshift(newPayout);
  writeData('payouts.json', payouts);
  res.status(201).json(newPayout);
});

// PUT update payout status
router.put('/:id/status', (req, res) => {
  const payouts = readData('payouts.json');
  const index = payouts.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Payout request not found' });

  payouts[index].status = req.body.status || 'Completed';
  payouts[index].processedAt = new Date().toISOString();

  writeData('payouts.json', payouts);
  res.json(payouts[index]);
});

export default router;
