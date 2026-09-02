import express from 'express';
import { readData, writeData } from '../utils/fileDb.js';

const router = express.Router();

// GET platform dashboard analytics & stats
router.get('/stats', (req, res) => {
  const bookings = readData('bookings.json');
  const hotels = readData('hotels.json');
  const users = readData('users.json');
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.total || 0), 0);
  const totalCommission = Math.round(totalRevenue * 0.15);

  res.json({
    totalHotels: hotels.length,
    totalBookings: bookings.length,
    totalRevenue,
    totalCommission,
    totalUsers: users.length,
    occupancyRate: 86.4,
    revenueHistory: [
      { month: 'Jan', revenue: 12400 },
      { month: 'Feb', revenue: 15800 },
      { month: 'Mar', revenue: 18900 },
      { month: 'Apr', revenue: 24500 },
      { month: 'May', revenue: 31000 },
      { month: 'Jun', revenue: 42000 },
      { month: 'Jul', revenue: 49500 }
    ]
  });
});

// GET payment gateway settings
router.get('/payment-settings', (req, res) => {
  let settings = readData('payment-settings.json');
  if (!settings || !settings.mode) {
    settings = {
      mode: 'test',
      gateways: {
        stripe: { enabled: true, livePk: '', liveSk: '', testPk: 'pk_test_placeholder', testSk: 'sk_test_placeholder' },
        paypal: { enabled: true, clientId: '', clientSecret: '' },
        razorpay: { enabled: true, keyId: '', keySecret: '' },
        payoneer: { enabled: true, merchantId: '', apiToken: '' },
        pay_at_hotel: { enabled: true }
      },
      updatedAt: new Date().toISOString()
    };
    writeData('payment-settings.json', settings);
  }
  res.json(settings);
});

// PUT update payment gateway settings
router.put('/payment-settings', async (req, res) => {
  const newSettings = {
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  writeData('payment-settings.json', newSettings);

  res.json({
    success: true,
    message: `Payment settings saved! Platform environment mode is now: ${newSettings.mode === 'live' ? 'LIVE PRODUCTION MODE' : 'SANDBOX TEST MODE'}`,
    settings: newSettings
  });
});

export default router;
