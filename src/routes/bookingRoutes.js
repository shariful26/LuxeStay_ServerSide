import express from 'express';
import mongoose from 'mongoose';
import { Booking } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';

const router = express.Router();

const datesOverlap = (startA, endA, startB, endB) => {
  const aIn = new Date(startA).getTime();
  const aOut = new Date(endA).getTime();
  const bIn = new Date(startB).getTime();
  const bOut = new Date(endB).getTime();
  if (isNaN(aIn) || isNaN(aOut) || isNaN(bIn) || isNaN(bOut)) return false;
  return aIn < bOut && aOut > bIn;
};

// GET bookings (with automatic date status evaluation)
router.get('/', (req, res) => {
  let bookings = readData('bookings.json');
  const now = new Date();
  let updatedAny = false;

  bookings = bookings.map(b => {
    if (b.status !== 'Cancelled') {
      const checkOutDate = new Date(b.checkOut);
      const checkInDate = new Date(b.checkIn);
      checkOutDate.setHours(23, 59, 59, 999);

      if (now > checkOutDate && b.status !== 'Checked-Out') {
        b.status = 'Checked-Out';
        updatedAny = true;
      } else if (now >= checkInDate && now <= checkOutDate && b.status !== 'Checked-In' && b.status !== 'Checked-Out') {
        b.status = 'Checked-In';
        updatedAny = true;
      }
    }
    return b;
  });

  if (updatedAny) {
    writeData('bookings.json', bookings);
  }

  const { userId } = req.query;
  if (userId) {
    return res.json(bookings.filter(b => b.userId === userId));
  }
  res.json(bookings);
});

// POST create new booking
router.post('/', async (req, res) => {
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

  // Stripe transaction integration
  const paymentSettings = readData('payment-settings.json');
  const stripeConfig = paymentSettings?.gateways?.stripe;
  let stripeSecretKey = process.env.STRIPE_TEST_SK || process.env.STRIPE_LIVE_SK || (paymentSettings?.mode === 'live' ? stripeConfig?.liveSk : stripeConfig?.testSk);
  if (!stripeSecretKey || !stripeSecretKey.startsWith('sk_') || stripeSecretKey.includes('demo') || stripeSecretKey.includes('key')) {
    stripeSecretKey = process.env.STRIPE_TEST_SK || process.env.STRIPE_LIVE_SK || (stripeConfig?.liveSk?.startsWith('sk_') && !stripeConfig?.liveSk?.includes('demo') ? stripeConfig?.liveSk : stripeConfig?.testSk);
  }

  const methodStr = String(req.body.paymentMethod || '').toLowerCase();
  if ((methodStr.includes('stripe') || methodStr.includes('card')) && stripeSecretKey && stripeSecretKey.startsWith('sk_')) {
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
        console.log(`✅ Stripe Transaction Recorded: ${stripeData.id} ($${stripeData.amount / 100} USD)`);
        newBooking.stripeTxId = stripeData.id;
        newBooking.stripeStatus = stripeData.status;
      }
    } catch (e) {
      console.warn('⚠️ Stripe API Fetch Exception:', e.message);
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

// PUT update booking status
router.put('/:id/status', (req, res) => {
  const bookings = readData('bookings.json');
  const index = bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Booking not found' });
  bookings[index].status = req.body.status;
  writeData('bookings.json', bookings);
  res.json(bookings[index]);
});

// PUT extend stay
router.put('/:id/extend', async (req, res) => {
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
