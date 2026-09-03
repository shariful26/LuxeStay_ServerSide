import express from 'express';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { 
  User, 
  Hotel, 
  Room, 
  Destination, 
  Booking, 
  Offer, 
  Blog, 
  Transfer, 
  Payout 
} from '../models/index.js';

const router = express.Router();

// GET database health status
router.get('/db-status', async (req, res) => {
  await connectDatabase();
  const states = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'];
  const currentState = states[mongoose.connection.readyState] || 'Unknown';
  
  let collectionsSummary = {
    users: 0,
    hotels: 0,
    rooms: 0,
    destinations: 0,
    bookings: 0,
    offers: 0,
    blogs: 0,
    transfers: 0,
    payouts: 0
  };

  try {
    if (mongoose.connection.readyState === 1) {
      collectionsSummary.users = await User.countDocuments({});
      collectionsSummary.hotels = await Hotel.countDocuments({});
      collectionsSummary.rooms = await Room.countDocuments({});
      collectionsSummary.destinations = await Destination.countDocuments({});
      collectionsSummary.bookings = await Booking.countDocuments({});
      collectionsSummary.offers = await Offer.countDocuments({});
      collectionsSummary.blogs = await Blog.countDocuments({});
      collectionsSummary.transfers = await Transfer.countDocuments({});
      collectionsSummary.payouts = await Payout.countDocuments({});
    }
  } catch (err) {
    // safe fallback
  }

  res.json({
    status: currentState,
    isAtlasConnected: mongoose.connection.readyState === 1,
    clusterHost: mongoose.connection.host || 'cluster0.zakm4rq.mongodb.net',
    dbName: mongoose.connection.name || 'hotel_db',
    collectionsSummary
  });
});

export default router;
