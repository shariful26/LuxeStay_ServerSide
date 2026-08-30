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
  console.log('🚀 Checking & Syncing Website Content into MongoDB Atlas Database...');

  try {
    // 1. Hotels
    const hotelCount = await Hotel.countDocuments({});
    const hotels = readData('hotels.json');
    if (hotelCount === 0) {
      if (hotels.length > 0) {
        await Hotel.insertMany(hotels);
        console.log(`✅ MongoDB Atlas: SEEDED ${hotels.length} Hotels successfully!`);
      }
    } else {
      for (const h of hotels) {
        if (h.id && h.images && h.images.length > 0) {
          await Hotel.updateOne(
            { id: h.id },
            { $set: { images: h.images } }
          );
        }
      }
    }

    // 2. Rooms
    const roomCount = await Room.countDocuments({});
    if (roomCount === 0) {
      const rooms = readData('rooms.json');
      if (rooms.length > 0) {
        await Room.insertMany(rooms);
        console.log(`✅ MongoDB Atlas: SEEDED ${rooms.length} Suites successfully!`);
      }
    }

    // 3. Destinations
    const destCount = await Destination.countDocuments({});
    if (destCount === 0) {
      const destinations = readData('destinations.json');
      if (destinations.length > 0) {
        await Destination.insertMany(destinations);
        console.log(`✅ MongoDB Atlas: SEEDED ${destinations.length} Destinations successfully!`);
      }
    }

    // 4. Offers
    const offerCount = await Offer.countDocuments({});
    if (offerCount === 0) {
      const offers = readData('offers.json');
      if (offers.length > 0) {
        await Offer.insertMany(offers);
        console.log(`✅ MongoDB Atlas: SEEDED ${offers.length} Promotional Offers successfully!`);
      }
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
      console.log('🔄 MongoDB Atlas: Synced users into database successfully');
    }

    // 6. Blogs
    const blogCount = await Blog.countDocuments({});
    if (blogCount === 0) {
      const blogs = readData('blogs.json');
      if (blogs.length > 0) {
        await Blog.insertMany(blogs);
        console.log(`✅ MongoDB Atlas: SEEDED ${blogs.length} Travel Articles successfully!`);
      }
    }

    // 7. Transfers
    const transferCount = await Transfer.countDocuments({});
    if (transferCount === 0) {
      const transfers = readData('transfers.json');
      if (transfers.length > 0) {
        await Transfer.insertMany(transfers);
        console.log(`✅ MongoDB Atlas: SEEDED ${transfers.length} Luxury Transfers successfully!`);
      }
    }

    // 8. Payouts
    const payoutCount = await Payout.countDocuments({});
    if (payoutCount === 0) {
      const payouts = readData('payouts.json');
      if (payouts.length > 0) {
        await Payout.insertMany(payouts);
        console.log(`✅ MongoDB Atlas: SEEDED ${payouts.length} Partner Payouts successfully!`);
      }
    }

    console.log('🎉 MongoDB Atlas Database initialization & sync completed successfully.');
  } catch (err) {
    console.error('⚠️ MongoDB Atlas Seeding Notice:', err.message);
  }
}
