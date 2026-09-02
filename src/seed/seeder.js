import mongoose from 'mongoose';
import { readData } from '../utils/fileDb.js';
import { 
  Hotel, 
  Room, 
  Destination, 
  Offer, 
  User, 
  Blog, 
  Transfer, 
  Payout 
} from '../models/index.js';

let isSeedingCompleted = false;

/**
 * Automatically populates MongoDB Atlas with seed data on first connection.
 */
export async function seedMongoDBDatabase() {
  if (isSeedingCompleted || mongoose.connection.readyState !== 1) return;
  isSeedingCompleted = true;

  try {
    // 1. Hotels
    const hotelCount = await Hotel.countDocuments({});
    const hotels = readData('hotels.json');
    if (hotelCount === 0 && hotels.length > 0) {
      await Hotel.insertMany(hotels);
    }

    // 2. Rooms
    const roomCount = await Room.countDocuments({});
    const rooms = readData('rooms.json');
    if (roomCount === 0 && rooms.length > 0) {
      await Room.insertMany(rooms);
    }

    // 3. Destinations
    const destCount = await Destination.countDocuments({});
    const destinations = readData('destinations.json');
    if (destCount === 0 && destinations.length > 0) {
      await Destination.insertMany(destinations);
    }

    // 4. Offers
    const offerCount = await Offer.countDocuments({});
    const offers = readData('offers.json');
    if (offerCount === 0 && offers.length > 0) {
      await Offer.insertMany(offers);
    }

    // 5. Users & Role Migration
    if (mongoose.connection.readyState === 1) {
      await User.updateMany({ role: 'partner' }, { $set: { role: 'manager' } });
      const users = readData('users.json');
      for (const u of users) {
        if (u.email) {
          const exists = await User.findOne({ email: u.email.toLowerCase() });
          if (!exists) {
            await User.create(u);
          }
        }
      }
    }

    // 6. Blogs
    const blogCount = await Blog.countDocuments({});
    const blogs = readData('blogs.json');
    if (blogCount === 0 && blogs.length > 0) {
      await Blog.insertMany(blogs);
    }

    // 7. Transfers
    const transferCount = await Transfer.countDocuments({});
    const transfers = readData('transfers.json');
    if (transferCount === 0 && transfers.length > 0) {
      await Transfer.insertMany(transfers);
    }

    // 8. Payouts
    const payoutCount = await Payout.countDocuments({});
    const payouts = readData('payouts.json');
    if (payoutCount === 0 && payouts.length > 0) {
      await Payout.insertMany(payouts);
    }
  } catch (err) {
    // safe fallback
  }
}
