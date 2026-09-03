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
  Payout,
  Booking,
  Review,
  Inventory,
  Concierge,
  ConciergeRequest,
  Setting
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

    // 5. Users: Seeding from users.json disabled. All users managed 100% live in MongoDB Atlas.
    if (mongoose.connection.readyState === 1) {
      await User.updateMany({ role: 'partner' }, { $set: { role: 'manager' } });
      // users.json seeding disabled
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

    // 9. Bookings
    const bookingCount = await Booking.countDocuments({});
    const bookings = readData('bookings.json');
    if (bookingCount === 0 && bookings.length > 0) {
      await Booking.insertMany(bookings);
    }

    // 10. Reviews
    const reviewCount = await Review.countDocuments({});
    const reviews = readData('reviews.json');
    if (reviewCount === 0 && reviews.length > 0) {
      await Review.insertMany(reviews);
    }

    // 11. Inventory
    const invCount = await Inventory.countDocuments({});
    const items = readData('inventory.json');
    if (invCount === 0 && items.length > 0) {
      await Inventory.insertMany(items);
    }

    // 12. Concierge Staff
    const staffCount = await Concierge.countDocuments({});
    const staff = readData('concierge.json');
    if (staffCount === 0 && staff.length > 0) {
      await Concierge.insertMany(staff);
    }

    // 13. Concierge Requests
    const reqCount = await ConciergeRequest.countDocuments({});
    const requests = readData('concierge-requests.json');
    if (reqCount === 0 && requests.length > 0) {
      await ConciergeRequest.insertMany(requests);
    }

    // 14. Settings
    const settingDoc = await Setting.findOne({ id: 'payment_settings' });
    if (!settingDoc) {
      const setJson = readData('payment-settings.json');
      if (setJson && setJson.mode) {
        await Setting.create({ id: 'payment_settings', ...setJson });
      }
    }
  } catch (err) {
    // safe fallback
  }
}
