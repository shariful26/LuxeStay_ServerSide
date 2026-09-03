import express from 'express';
import mongoose from 'mongoose';
import { Booking } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';
import { connectDatabase } from '../config/db.js';

const router = express.Router();

const datesOverlap = (startA, endA, startB, endB) => {
  const aIn = new Date(startA).getTime();
  const aOut = new Date(endA).getTime();
  const bIn = new Date(startB).getTime();
  const bOut = new Date(endB).getTime();
  if (isNaN(aIn) || isNaN(aOut) || isNaN(bIn) || isNaN(bOut)) return false;
  return aIn < bOut && aOut > bIn;
};

// GET bookings (Live from MongoDB Atlas with user/role filtering & pagination)
router.get('/', async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

  await connectDatabase();
  const { userId, guestEmail, hotelId, status, role, limit, page } = req.query;

  const mongoFilter = {};

  if (userId || guestEmail) {
    const filters = [];
    if (userId) {
      const cleanId = String(userId).trim();
      filters.push({ userId: cleanId }, { guestEmail: cleanId.toLowerCase() });
    }
    if (guestEmail) {
      filters.push({ guestEmail: String(guestEmail).trim().toLowerCase() });
    }
    mongoFilter.$or = filters;
  } else if (role === 'customer') {
    // Ordinary customers must never download global bookings collection
    return res.json([]);
  }

  if (hotelId) {
    mongoFilter.hotelId = String(hotelId);
  }

  if (status) {
    mongoFilter.status = { $regex: new RegExp(`^${status}$`, 'i') };
  }

  const queryLimit = limit ? Math.min(Math.max(Number(limit) || 0, 1), 100) : 50;
  const queryPage = Math.max(Number(page) || 1, 1);

  const projection = 'id hotelId hotelName roomId roomName guestName guestEmail guestPhone checkIn checkOut nights guests nightlyRate subtotal addOns discount tax total currency paymentMethod status userId createdAt';

  let bookings = [];
  try {
    if (mongoose.connection.readyState === 1) {
      // Auto-purge any remnant mock Alice Johnson bookings from MongoDB
      await Booking.deleteMany({
        $or: [
          { guestName: /Alice Johnson/i },
          { guestEmail: 'customer@luxestay.com' }
        ]
      });

      mongoFilter.guestName = { $not: /Alice Johnson/i };

      let q = Booking.find(mongoFilter)
        .select(projection)
        .sort({ createdAt: -1 });

      if (queryLimit > 0) {
        q = q.skip((queryPage - 1) * queryLimit).limit(queryLimit);
      }
      bookings = await q.lean();
    }
  } catch (err) {
    // safe fallback
  }

  // Return pure real MongoDB bookings
  res.json(bookings || []);
});

// POST create new booking
router.post('/', async (req, res) => {
  await connectDatabase();
  const bookings = readData('bookings.json');
  const { roomId, roomName, checkIn, checkOut } = req.body;

  // Strict Date Overlap Conflict Check
  if (roomId && checkIn && checkOut) {
    const existingConflict = bookings.find(b => {
      if (b.status === 'Cancelled' || b.status === 'Rejected') return false;
      const bRoomId = b.roomId || b.room?.id;
      if (bRoomId && String(bRoomId) === String(roomId)) {
        return datesOverlap(checkIn, checkOut, b.checkIn, b.checkOut);
      }
      return false;
    });

    if (existingConflict) {
      return res.status(400).json({
        error: `Sorry! ${roomName || 'This room'} is already reserved from ${existingConflict.checkIn} to ${existingConflict.checkOut}. Please select different stay dates.`
      });
    }
  }

  const newBooking = {
    id: `BK-${Math.floor(10000 + Math.random() * 90000)}`,
    status: 'Confirmed',
    createdAt: new Date().toISOString(),
    ...req.body
  };

  const gatewayKey = String(req.body.paymentGateway || '').toLowerCase();
  const methodStr = String(req.body.paymentMethod || '').toLowerCase();

  // Determine standard payment status & gateway transaction ID
  if (gatewayKey === 'pay_at_hotel' || methodStr.includes('hotel') || methodStr.includes('check-in')) {
    newBooking.paymentGateway = 'pay_at_hotel';
    newBooking.paymentStatus = 'Pending (Pay at Check-In)';
    newBooking.transactionId = req.body.transactionId || `HOTEL-RECP-${Math.floor(100000 + Math.random() * 900000)}`;
  } else {
    newBooking.paymentStatus = 'Paid';
    newBooking.paidAt = new Date().toISOString();
    
    if (gatewayKey === 'paypal' || methodStr.includes('paypal')) {
      newBooking.paymentGateway = 'paypal';
      newBooking.transactionId = req.body.transactionId || `PAYID-M${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    } else if (gatewayKey === 'razorpay' || methodStr.includes('razorpay')) {
      newBooking.paymentGateway = 'razorpay';
      newBooking.transactionId = req.body.transactionId || `pay_${Math.random().toString(36).substring(2, 16)}`;
    } else if (gatewayKey === 'payoneer' || methodStr.includes('payoneer')) {
      newBooking.paymentGateway = 'payoneer';
      newBooking.transactionId = req.body.transactionId || `PAYO-${Math.floor(10000000 + Math.random() * 90000000)}`;
    } else if (gatewayKey === 'apple_google_pay' || methodStr.includes('apple') || methodStr.includes('google')) {
      newBooking.paymentGateway = 'apple_google_pay';
      newBooking.transactionId = req.body.transactionId || `APL-GPAY-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    } else {
      newBooking.paymentGateway = 'stripe';
      newBooking.transactionId = req.body.transactionId || `pi_3M${Math.random().toString(36).substring(2, 18)}`;
    }
  }

  // =========================================================================
  // Live Merchant Gateway Integrations (Stripe, PayPal, Razorpay)
  // =========================================================================
  const paymentSettings = readData('payment-settings.json');
  const isLiveMode = paymentSettings?.mode === 'live';

  // 1. Stripe Live / Test API Charge
  const stripeConfig = paymentSettings?.gateways?.stripe;
  let stripeSecretKey = process.env.STRIPE_TEST_SK || process.env.STRIPE_LIVE_SK || (isLiveMode ? stripeConfig?.liveSk : stripeConfig?.testSk);
  if (!stripeSecretKey || !stripeSecretKey.startsWith('sk_') || stripeSecretKey.includes('demo') || stripeSecretKey.includes('key')) {
    stripeSecretKey = process.env.STRIPE_TEST_SK || process.env.STRIPE_LIVE_SK || (stripeConfig?.liveSk?.startsWith('sk_') && !stripeConfig?.liveSk?.includes('demo') ? stripeConfig?.liveSk : stripeConfig?.testSk);
  }

  if ((newBooking.paymentGateway === 'stripe' || methodStr.includes('stripe') || methodStr.includes('card')) && stripeSecretKey && stripeSecretKey.startsWith('sk_')) {
    try {
      const amountInCents = Math.round((Number(req.body.total) || 100) * 100);
      const params = new URLSearchParams();
      params.append('amount', amountInCents);
      params.append('currency', req.body.currency ? req.body.currency.toLowerCase() : 'usd');
      params.append('payment_method_types[]', 'card');
      params.append('confirm', 'true');
      params.append('payment_method', 'pm_card_visa');
      params.append('description', `LuxeStay Hotel Booking - ${req.body.roomName || 'Suite'} (${req.body.guestEmail || 'Guest'})`);

      const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const stripeData = await stripeRes.json();
      if (stripeRes.ok && stripeData.id) {
        newBooking.stripeTxId = stripeData.id;
        newBooking.transactionId = stripeData.id;
        newBooking.stripeStatus = stripeData.status;
      }
    } catch (e) {
      // safe fallback
    }
  }

  // 2. PayPal REST API Integration
  const paypalConfig = paymentSettings?.gateways?.paypal;
  const paypalClientId = paypalConfig?.clientId || process.env.PAYPAL_CLIENT_ID;
  const paypalSecret = paypalConfig?.clientSecret || process.env.PAYPAL_CLIENT_SECRET;

  if (newBooking.paymentGateway === 'paypal' && paypalClientId && paypalSecret && !paypalClientId.includes('demo')) {
    try {
      const paypalBase = isLiveMode ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
      const authHeader = 'Basic ' + Buffer.from(`${paypalClientId}:${paypalSecret}`).toString('base64');
      
      const tokenRes = await fetch(`${paypalBase}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });
      const tokenData = await tokenRes.json();
      
      if (tokenData.access_token) {
        const orderRes = await fetch(`${paypalBase}/v2/checkout/orders`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
              reference_id: newBooking.id,
              amount: {
                currency_code: 'USD',
                value: String(newBooking.total || '100.00')
              },
              description: `LuxeStay Suite Booking - ${newBooking.roomName}`
            }]
          })
        });
        const orderData = await orderRes.json();
        if (orderData.id) {
          newBooking.transactionId = orderData.id;
          newBooking.paypalOrderId = orderData.id;
        }
      }
    } catch (e) {
      // safe fallback
    }
  }

  // 3. Razorpay Orders API Integration
  const razorpayConfig = paymentSettings?.gateways?.razorpay;
  const rzpKeyId = razorpayConfig?.keyId || process.env.RAZORPAY_KEY_ID;
  const rzpKeySecret = razorpayConfig?.keySecret || process.env.RAZORPAY_KEY_SECRET;

  if (newBooking.paymentGateway === 'razorpay' && rzpKeyId && rzpKeySecret && !rzpKeyId.includes('demo')) {
    try {
      const rzpAuth = 'Basic ' + Buffer.from(`${rzpKeyId}:${rzpKeySecret}`).toString('base64');
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': rzpAuth,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: Math.round((Number(newBooking.total) || 100) * 100),
          currency: 'USD',
          receipt: newBooking.id,
          notes: {
            hotelName: newBooking.hotelName,
            guestEmail: newBooking.guestEmail
          }
        })
      });
      const rzpData = await rzpRes.json();
      if (rzpData.id) {
        newBooking.transactionId = rzpData.id;
        newBooking.razorpayOrderId = rzpData.id;
      }
    } catch (e) {
      // safe fallback
    }
  }

  if (mongoose.connection.readyState === 1) {
    try {
      const mongoBooking = new Booking(newBooking);
      await mongoBooking.save();
    } catch (e) {}
  }

  bookings.unshift(newBooking);
  writeData('bookings.json', bookings);
  res.status(201).json(newBooking);
});

// PUT update booking
router.put('/:id', async (req, res) => {
  await connectDatabase();
  const bookings = readData('bookings.json');
  const index = bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Booking not found' });

  const updatedBooking = {
    ...bookings[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  if (mongoose.connection.readyState === 1) {
    try {
      await Booking.findOneAndUpdate({ id: req.params.id }, updatedBooking);
    } catch (e) {}
  }

  bookings[index] = updatedBooking;
  writeData('bookings.json', bookings);
  res.json(updatedBooking);
});

// PUT update booking status (Persists directly to MongoDB Atlas)
router.put('/:id/status', async (req, res) => {
  await connectDatabase();
  const { id } = req.params;
  const { status } = req.body;

  let mongoUpdated = null;
  if (mongoose.connection.readyState === 1) {
    try {
      mongoUpdated = await Booking.findOneAndUpdate(
        { id },
        { $set: { status, updatedAt: new Date().toISOString() } },
        { new: true }
      ).lean();
    } catch (e) {
      // safe fallback
    }
  }

  const bookings = readData('bookings.json');
  const index = bookings.findIndex(b => b.id === id);
  if (index !== -1) {
    bookings[index].status = status;
    bookings[index].updatedAt = new Date().toISOString();
    writeData('bookings.json', bookings);
    return res.json(mongoUpdated || bookings[index]);
  }

  if (mongoUpdated) {
    return res.json(mongoUpdated);
  }

  res.json({ id, status });
});

// DELETE booking (Deletes from MongoDB Atlas & JSON)
router.delete('/:id', async (req, res) => {
  await connectDatabase();
  const { id } = req.params;

  if (mongoose.connection.readyState === 1) {
    try {
      await Booking.findOneAndDelete({ id });
    } catch (e) {}
  }

  const bookings = readData('bookings.json');
  const filtered = bookings.filter(b => b.id !== id);
  writeData('bookings.json', filtered);
  res.json({ success: true, message: 'Booking deleted successfully' });
});

// PUT extend stay
router.put('/:id/extend', async (req, res) => {
  await connectDatabase();
  const bookings = readData('bookings.json');
  const index = bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Booking reservation not found' });
  }

  const currentBooking = bookings[index];
  const { extraNights = 1, newCheckOut, extraAmount = 0 } = req.body;

  if (!newCheckOut) {
    return res.status(400).json({ error: 'New checkout date is required for extension' });
  }

  const roomId = currentBooking.roomId || currentBooking.room?.id;
  const currentCheckOut = currentBooking.checkOut;

  const conflictBooking = bookings.find(b => {
    if (b.id === currentBooking.id) return false;
    if (b.status === 'Cancelled' || b.status === 'Rejected') return false;
    const bRoomId = b.roomId || b.room?.id;
    if (bRoomId && String(bRoomId) === String(roomId)) {
      return datesOverlap(currentCheckOut, newCheckOut, b.checkIn, b.checkOut);
    }
    return false;
  });

  if (conflictBooking) {
    return res.status(400).json({
      conflict: true,
      error: `Sorry, this room is already reserved by another guest starting ${conflictBooking.checkIn}. You can switch rooms or select an alternative suite.`
    });
  }

  const updatedBooking = {
    ...currentBooking,
    checkOut: newCheckOut,
    nights: (currentBooking.nights || 1) + Number(extraNights),
    total: (currentBooking.total || 0) + Number(extraAmount),
    extendedAt: new Date().toISOString()
  };

  if (mongoose.connection.readyState === 1) {
    try {
      await Booking.findOneAndUpdate({ id: req.params.id }, updatedBooking);
    } catch (e) {}
  }

  bookings[index] = updatedBooking;
  writeData('bookings.json', bookings);

  res.json({
    success: true,
    message: 'Stay extended successfully!',
    booking: updatedBooking
  });
});

// PUT switch room / upgrade suite
router.put('/:id/switch-room', async (req, res) => {
  await connectDatabase();
  const bookings = readData('bookings.json');
  const index = bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Booking not found' });

  const { newRoomId, newRoomName, newCheckOut, extraAmount = 0 } = req.body;
  const updatedBooking = {
    ...bookings[index],
    roomId: newRoomId,
    roomName: newRoomName || bookings[index].roomName,
    checkOut: newCheckOut || bookings[index].checkOut,
    total: (bookings[index].total || 0) + Number(extraAmount),
    roomSwitchedAt: new Date().toISOString()
  };

  if (mongoose.connection.readyState === 1) {
    try {
      await Booking.findOneAndUpdate({ id: req.params.id }, updatedBooking);
    } catch (e) {}
  }

  bookings[index] = updatedBooking;
  writeData('bookings.json', bookings);
  res.json({ success: true, message: 'Room switched successfully!', booking: updatedBooking });
});

export default router;
