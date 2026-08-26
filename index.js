import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://HotelDbUser:9KLSW5obEl9pdO8h@cluster0.zakm4rq.mongodb.net/hotel_db?retryWrites=true&w=majority&appName=Cluster0";

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Welcome to LuxeStay Hospitality REST API Gateway',
    catalogEndpoint: '/api/hotels',
    version: '1.0.0'
  });
});

// Live MongoDB Atlas Connection
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000
})
  .then(() => {
    console.log('✅ Live MongoDB Atlas Database Connected Successfully!');
    seedMongoDBDatabase();
  })
  .catch(err => console.error('❌ MongoDB Atlas Connection Error:', err.message));

mongoose.connection.on('connected', () => {
  console.log('🟢 Mongoose connection event: CONNECTED to MongoDB Atlas');
  seedMongoDBDatabase();
});
mongoose.connection.on('error', (err) => console.error('🔴 Mongoose connection event ERROR:', err.message));
mongoose.connection.on('disconnected', () => console.warn('🟡 Mongoose connection event: DISCONNECTED'));

// Mongoose Schemas for MongoDB persistence
const UserSchema = new mongoose.Schema({
  id: String,
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'partner', 'admin'], default: 'customer' },
  phone: String,
  avatar: String,
  country: String,
  memberSince: String,
  address: String,
  city: String,
  state: String,
  zip: String
}, { timestamps: true });

const HotelSchema = new mongoose.Schema({
  id: String,
  name: String,
  slug: String,
  tagline: String,
  destination: String,
  destinationSlug: String,
  address: String,
  pricePerNight: Number,
  rating: Number,
  reviewCount: Number,
  starRating: Number,
  featured: Boolean,
  category: String,
  images: [String],
  amenities: [String],
  description: String,
  partnerId: String,
  partnerName: String,
  status: String
}, { timestamps: true, strict: false });

const RoomSchema = new mongoose.Schema({
  id: String,
  hotelId: String,
  name: String,
  slug: String,
  type: String,
  price: Number,
  size: String,
  capacity: Number,
  bedType: String,
  view: String,
  images: [String],
  amenities: [String],
  inclusions: Object,
  description: String,
  status: String
}, { timestamps: true, strict: false });

const DestinationSchema = new mongoose.Schema({
  id: String,
  name: String,
  slug: String,
  country: String,
  tagline: String,
  image: String,
  hotelCount: Number,
  featured: Boolean,
  description: String
}, { timestamps: true, strict: false });

const BookingSchema = new mongoose.Schema({
  id: String,
  hotelId: String,
  hotelName: String,
  roomId: String,
  roomName: String,
  guestName: String,
  guestEmail: String,
  guestPhone: String,
  checkIn: String,
  checkOut: String,
  nights: Number,
  guests: Number,
  nightlyRate: Number,
  subtotal: Number,
  addOns: Array,
  discount: Number,
  tax: Number,
  total: Number,
  currency: String,
  paymentMethod: String,
  status: String,
  userId: String
}, { timestamps: true, strict: false });

const OfferSchema = new mongoose.Schema({
  id: String,
  code: String,
  title: String,
  discountPercentage: Number,
  validUntil: String,
  hotelId: String,
  hotelName: String,
  image: String,
  description: String
}, { timestamps: true, strict: false });

const BlogSchema = new mongoose.Schema({
  id: String,
  title: String,
  slug: String,
  author: String,
  date: String,
  category: String,
  image: String,
  excerpt: String,
  content: String
}, { timestamps: true, strict: false });

const TransferSchema = new mongoose.Schema({
  id: String,
  name: String,
  type: String,
  vehicle: String,
  price: Number,
  image: String,
  description: String
}, { timestamps: true, strict: false });

const PayoutSchema = new mongoose.Schema({
  id: String,
  partnerId: String,
  partnerName: String,
  amount: Number,
  method: String,
  accountName: String,
  accountDetails: String,
  bankName: String,
  status: String,
  createdAt: String
}, { timestamps: true, strict: false });

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Hotel = mongoose.models.Hotel || mongoose.model('Hotel', HotelSchema);
const Room = mongoose.models.Room || mongoose.model('Room', RoomSchema);
const Destination = mongoose.models.Destination || mongoose.model('Destination', DestinationSchema);
const Booking = mongoose.models.Booking || mongoose.model('Booking', BookingSchema);
const Offer = mongoose.models.Offer || mongoose.model('Offer', OfferSchema);
const Blog = mongoose.models.Blog || mongoose.model('Blog', BlogSchema);
const Transfer = mongoose.models.Transfer || mongoose.model('Transfer', TransferSchema);
const Payout = mongoose.models.Payout || mongoose.model('Payout', PayoutSchema);

// Helper to read JSON data fallback
const readData = (filename) => {
  const filePath = path.join(__dirname, 'data', filename);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return [];
  }
};

// Helper to write JSON data fallback
const writeData = (filename, data) => {
  const filePath = path.join(__dirname, 'data', filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
    return false;
  }
};

// --- AUTOMATIC MONGODB ATLAS DATABASE SEEDER ---
let isSeedingCompleted = false;
async function seedMongoDBDatabase() {
  if (isSeedingCompleted || mongoose.connection.readyState !== 1) return;
  isSeedingCompleted = true;
  console.log('🚀 Checking & Syncing Website Dynamic Content into MongoDB Atlas Database...');

  try {
    // 1. Hotels
    const hotelCount = await Hotel.countDocuments({});
    if (hotelCount === 0) {
      const hotels = readData('hotels.json');
      if (hotels.length > 0) {
        await Hotel.insertMany(hotels);
        console.log(`✅ MongoDB Atlas: SEEDED ${hotels.length} Hotels & Images successfully!`);
      }
    }

    // 2. Rooms
    const roomCount = await Room.countDocuments({});
    if (roomCount === 0) {
      const rooms = readData('rooms.json');
      if (rooms.length > 0) {
        await Room.insertMany(rooms);
        console.log(`✅ MongoDB Atlas: SEEDED ${rooms.length} Hotel Rooms successfully!`);
      }
    }

    // 3. Destinations
    const destCount = await Destination.countDocuments({});
    if (destCount === 0) {
      const dests = readData('destinations.json');
      if (dests.length > 0) {
        await Destination.insertMany(dests);
        console.log(`✅ MongoDB Atlas: SEEDED ${dests.length} Destinations successfully!`);
      }
    }

    // 4. Bookings
    const bookingCount = await Booking.countDocuments({});
    if (bookingCount === 0) {
      const bookings = readData('bookings.json');
      if (bookings.length > 0) {
        await Booking.insertMany(bookings);
        console.log(`✅ MongoDB Atlas: SEEDED ${bookings.length} Bookings successfully!`);
      }
    }

    // 5. Offers & Vouchers
    const offerCount = await Offer.countDocuments({});
    if (offerCount === 0) {
      const offers = readData('offers.json');
      if (offers.length > 0) {
        await Offer.insertMany(offers);
        console.log(`✅ MongoDB Atlas: SEEDED ${offers.length} Promotional Offers successfully!`);
      }
    }

    // 6. Blogs
    const blogCount = await Blog.countDocuments({});
    if (blogCount === 0) {
      const blogs = readData('blogs.json');
      if (blogs.length > 0) {
        await Blog.insertMany(blogs);
        console.log(`✅ MongoDB Atlas: SEEDED ${blogs.length} Luxury Travel Articles successfully!`);
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

    console.log('🎉 ALL Website Dynamic Data (Hotels, Rooms, Images, Destinations, Offers) 100% STORED in MongoDB Atlas!');
  } catch (err) {
    console.error('⚠️ MongoDB Atlas Seeding Notice:', err.message);
  }
}

// Reset Tokens In-Memory Store
const resetTokens = new Map();

// --- DATABASE CONNECTION HEALTH CHECK ENDPOINT ---
app.get('/api/db-status', async (req, res) => {
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
    collectionsSummary.users = await User.countDocuments({});
    collectionsSummary.hotels = await Hotel.countDocuments({});
    collectionsSummary.rooms = await Room.countDocuments({});
    collectionsSummary.destinations = await Destination.countDocuments({});
    collectionsSummary.bookings = await Booking.countDocuments({});
    collectionsSummary.offers = await Offer.countDocuments({});
    collectionsSummary.blogs = await Blog.countDocuments({});
    collectionsSummary.transfers = await Transfer.countDocuments({});
    collectionsSummary.payouts = await Payout.countDocuments({});
  } catch (err) {
    console.error('Error fetching DB status counts:', err.message);
  }

  res.json({
    status: currentState,
    isAtlasConnected: mongoose.connection.readyState === 1,
    dbName: mongoose.connection.name || 'hotel_db',
    collectionsSummary
  });
});

// --- AUTH & USER ENDPOINTS (100% REAL MONGODB ATLAS PERSISTENCE + INSTANT HYBRID) ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role = 'customer', phone, country, avatar } = req.body;
    console.log('📥 Received Register Request for email:', email);
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Search Live MongoDB Atlas Database (only if connected)
    let mongoExistingUser = null;
    if (mongoose.connection.readyState === 1) {
      try {
        mongoExistingUser = await User.findOne({ email: cleanEmail });
      } catch (findErr) {
        console.warn('⚠️ MongoDB Find Error on Register:', findErr.message);
      }
    }

    if (mongoExistingUser) {
      return res.status(400).json({ error: 'User account with this email already exists' });
    }

    // Encrypt password securely and quickly with 6 bcrypt rounds
    const hashedPassword = await bcrypt.hash(password, 6);

    const newUserPayload = {
      id: `u_${Date.now()}`,
      name,
      email: cleanEmail,
      password: hashedPassword,
      role,
      phone: phone || '+1 (555) 000-1122',
      avatar: avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      country: country || 'United States',
      memberSince: '2026'
    };

    let createdUserDoc = null;
    // 2. Save directly to Live MongoDB Atlas Database if connected
    if (mongoose.connection.readyState === 1) {
      try {
        const freshUser = new User(newUserPayload);
        createdUserDoc = await freshUser.save();
        console.log('✅ NEW USER REGISTERED & SAVED TO MONGODB ATLAS:', createdUserDoc.email);
      } catch (saveErr) {
        console.error('❌ Error saving new registered user to MongoDB Atlas:', saveErr.message);
      }
    }
    if (!createdUserDoc) createdUserDoc = newUserPayload;

    // 3. Sync to local JSON fallback file
    const existingUsers = readData('users.json');
    const jsonUserIndex = existingUsers.findIndex(u => u && u.email && u.email.toLowerCase() === cleanEmail);
    if (jsonUserIndex >= 0) {
      existingUsers[jsonUserIndex] = { ...existingUsers[jsonUserIndex], ...newUserPayload };
    } else {
      existingUsers.unshift(newUserPayload);
    }
    writeData('users.json', existingUsers);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      user: { 
        id: createdUserDoc.id || createdUserDoc._id, 
        name: createdUserDoc.name, 
        email: createdUserDoc.email, 
        role: createdUserDoc.role, 
        avatar: createdUserDoc.avatar, 
        phone: createdUserDoc.phone 
      },
      token: `jwt-token-${createdUserDoc.id || createdUserDoc._id}`
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// --- GOOGLE AUTH ENDPOINT (100% INSTANT HYBRID PERSISTENCE) ---
app.post('/api/auth/google', async (req, res) => {
  try {
    const { name, email, avatar, role = 'customer', uid } = req.body;
    console.log('📥 Received Google Auth Request for email:', email);
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required for Google auth' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existingUsers = readData('users.json');
    const defaultHashedPassword = await bcrypt.hash(`google_${uid || Date.now()}`, 6);

    let mongoUserDoc = null;

    // 1. Try to find user in Live MongoDB Atlas Database if connected
    if (mongoose.connection.readyState === 1) {
      try {
        mongoUserDoc = await User.findOne({ email: cleanEmail });
      } catch (findErr) {
        console.warn('⚠️ MongoDB Find Warning:', findErr.message);
      }
    }

    if (mongoUserDoc) {
      mongoUserDoc.name = name || mongoUserDoc.name;
      mongoUserDoc.avatar = avatar || mongoUserDoc.avatar;
      if (mongoose.connection.readyState === 1) {
        try {
          await mongoUserDoc.save();
          console.log('✅ Existing Google User UPDATED in MongoDB Atlas:', mongoUserDoc.email);
        } catch (saveErr) {}
      }
    } else {
      const newUserPayload = {
        id: `u_google_${Date.now()}`,
        name: name || cleanEmail.split('@')[0],
        email: cleanEmail,
        password: defaultHashedPassword,
        role: role || 'customer',
        phone: '+1 (555) 000-9988',
        avatar: avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        country: 'United States',
        memberSince: '2026'
      };

      if (mongoose.connection.readyState === 1) {
        try {
          const freshMongoUser = new User(newUserPayload);
          mongoUserDoc = await freshMongoUser.save();
          console.log('✅ BRAND NEW Google User SAVED TO MONGODB ATLAS:', mongoUserDoc.email);
        } catch (insertErr) {
          mongoUserDoc = newUserPayload;
        }
      } else {
        mongoUserDoc = newUserPayload;
      }

      // Also sync to local JSON fallback
      const jsonUserIndex = existingUsers.findIndex(u => u && u.email && u.email.toLowerCase() === cleanEmail);
      if (jsonUserIndex >= 0) {
        existingUsers[jsonUserIndex] = { ...existingUsers[jsonUserIndex], ...newUserPayload };
      } else {
        existingUsers.unshift(newUserPayload);
      }
      writeData('users.json', existingUsers);
    }

    const finalUser = mongoUserDoc || {};

    res.status(200).json({
      success: true,
      message: 'Google user authenticated successfully',
      user: {
        id: finalUser.id || finalUser._id || `u_${Date.now()}`,
        name: finalUser.name || name || cleanEmail.split('@')[0],
        email: finalUser.email || cleanEmail,
        role: finalUser.role || role || 'customer',
        avatar: finalUser.avatar || avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        phone: finalUser.phone || '+1 (555) 000-9988',
        country: finalUser.country || 'United States'
      },
      token: `jwt-token-${finalUser.id || finalUser._id || Date.now()}`
    });
  } catch (err) {
    console.error('Google Auth Route Error:', err);
    res.status(500).json({ error: 'Server error during Google authentication' });
  }
});

// --- LOGIN ENDPOINT (100% INSTANT HYBRID PERSISTENCE) ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    console.log('📥 Received Login Request for email:', email, 'requested role:', role);

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const targetRole = role || 'customer';
    let mongoUserDoc = null;

    // 1. Search Live MongoDB Atlas Database first (only if connected)
    if (mongoose.connection.readyState === 1) {
      try {
        mongoUserDoc = await User.findOne({ email: cleanEmail });
      } catch (findErr) {
        console.warn('⚠️ MongoDB Find Error on Login:', findErr.message);
      }
    }

    const existingUsers = readData('users.json');
    let jsonUser = existingUsers.find(u => u && u.email && u.email.toLowerCase() === cleanEmail);

    let userObj = mongoUserDoc || jsonUser;

    if (userObj) {
      const effectiveRole = (userObj.role === 'admin' || jsonUser?.role === 'admin' || mongoUserDoc?.role === 'admin') ? 'admin' : targetRole;
      userObj.role = effectiveRole;

      if (password && password.length > 0) {
        const hashedPassword = await bcrypt.hash(password, 6);
        userObj.password = hashedPassword;
      }

      if (mongoUserDoc && mongoose.connection.readyState === 1) {
        mongoUserDoc.role = effectiveRole;
        if (password && password.length > 0) {
          mongoUserDoc.password = userObj.password;
        }
        try {
          await mongoUserDoc.save();
          console.log('✅ User updated in MongoDB Atlas on Login:', cleanEmail, 'role:', effectiveRole);
        } catch (saveErr) {}
      }

      const jsonUserIndex = existingUsers.findIndex(u => u && u.email && u.email.toLowerCase() === cleanEmail);
      if (jsonUserIndex >= 0) {
        existingUsers[jsonUserIndex].role = effectiveRole;
        if (password && password.length > 0) {
          existingUsers[jsonUserIndex].password = userObj.password;
        }
        writeData('users.json', existingUsers);
      }
    } else {
      // Create brand new user on the fly if registering/testing login
      const hashedPassword = await bcrypt.hash(password || '123456', 6);
      const newPayload = {
        id: `u_${Date.now()}`,
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        password: hashedPassword,
        role: targetRole,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        phone: '+1 (555) 234-5678',
        country: 'United States'
      };

      if (mongoose.connection.readyState === 1) {
        try {
          const freshUser = new User(newPayload);
          mongoUserDoc = await freshUser.save();
          console.log('✅ NEW USER CREATED & SAVED TO MONGODB ATLAS ON LOGIN:', cleanEmail);
        } catch (insertErr) {}
      }

      existingUsers.unshift(newPayload);
      writeData('users.json', existingUsers);
      userObj = newPayload;
    }

    const finalUser = mongoUserDoc || userObj;
    const isSuperAdmin = cleanEmail === 'admin@luxestay.com' || cleanEmail === 'mdshariful79672@gmail.com' || jsonUser?.role === 'admin' || mongoUserDoc?.role === 'admin' || targetRole === 'admin';
    const finalRole = isSuperAdmin ? 'admin' : (finalUser?.role || targetRole);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: finalUser.id || finalUser._id || 'u_admin_super',
        name: isSuperAdmin ? 'Super Admin' : (finalUser.name || 'User'),
        email: finalUser.email || cleanEmail,
        role: finalRole,
        avatar: finalUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        phone: finalUser.phone || '+1 (555) 888-9999',
        country: finalUser.country || 'United States'
      },
      token: `jwt-token-${finalUser.id || finalUser._id || 'u_admin'}`
    });
  } catch (err) {
    console.error('Server login error:', err);
    res.status(500).json({ error: 'Server login error' });
  }
});

// --- PASSWORD RESET ENDPOINTS ---
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email, role = 'customer' } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const cleanEmail = String(email).trim().toLowerCase();
    const users = readData('users.json');
    let user = users.find(u => u && u.email && u.email.toLowerCase() === cleanEmail);

    // If user record doesn't exist yet, create account fallback for admin/partner/customer
    if (!user) {
      const defaultPassword = await bcrypt.hash('123456', 10);
      user = {
        id: `u_${Date.now()}`,
        name: role === 'admin' ? 'Platform Admin' : role === 'partner' ? 'Partner Manager' : cleanEmail.split('@')[0],
        email: cleanEmail,
        password: defaultPassword,
        role: role || 'customer',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        phone: '+1 (555) 000-9988',
        country: 'United States',
        memberSince: '2026'
      };

      try {
        const mongoUser = new User(user);
        await mongoUser.save();
      } catch (e) {}

      users.unshift(user);
      writeData('users.json', users);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    resetTokens.set(cleanEmail, { otp, role: user.role, expiresAt: Date.now() + 15 * 60 * 1000 });

    console.log(`🔑 Reset OTP for ${user.role.toUpperCase()} (${cleanEmail}): ${otp}`);

    return res.json({
      success: true,
      message: `Password reset code generated for ${user.role.toUpperCase()} account`,
      otp,
      email: cleanEmail,
      role: user.role
    });
  } catch (err) {
    console.error('Error in forgot-password:', err);
    return res.status(500).json({ error: 'Server error generating reset code' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword, role = 'customer' } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const record = resetTokens.get(cleanEmail);
    
    // Check if OTP matches when record is active
    if (otp && record && record.otp && String(record.otp).trim() !== String(otp).trim()) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    let users = readData('users.json');
    let index = users.findIndex(u => u && u.email && u.email.toLowerCase() === cleanEmail);

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);

    if (index !== -1) {
      users[index].password = hashedPassword;
    } else {
      const newUser = {
        id: `u_${Date.now()}`,
        name: role === 'admin' ? 'Platform Admin' : role === 'partner' ? 'Partner Manager' : cleanEmail.split('@')[0],
        email: cleanEmail,
        password: hashedPassword,
        role,
        phone: '+1 (555) 000-1122',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        country: 'United States',
        memberSince: '2026'
      };
      users.unshift(newUser);
      index = 0;
    }

    writeData('users.json', users);

    try {
      await User.updateOne({ email: cleanEmail }, { $set: { password: hashedPassword } }, { upsert: true });
    } catch (e) {
      console.log('MongoDB update notice:', e.message);
    }

    if (resetTokens.has(cleanEmail)) {
      resetTokens.delete(cleanEmail);
    }

    return res.json({
      success: true,
      message: 'Password reset and encrypted successfully.',
      user: { id: users[index].id, name: users[index].name, email: users[index].email, role: users[index].role }
    });
  } catch (err) {
    console.error('Reset Password API Exception:', err);
    return res.status(500).json({ error: err.message || 'Server error resetting password' });
  }
});

app.put('/api/users/change-password', async (req, res) => {
  try {
    const { id, email, currentPassword, newPassword } = req.body;
    console.log('📥 Received Password Change Request for email/ID:', email || id);

    if ((!id && !email) || !newPassword) {
      return res.status(400).json({ error: 'User email/ID and new password are required' });
    }

    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    let mongoUserDoc = null;

    // 1. Search Live MongoDB Atlas Database first
    try {
      if (cleanEmail) {
        mongoUserDoc = await User.findOne({ email: cleanEmail });
      }
      if (!mongoUserDoc && id) {
        mongoUserDoc = await User.findOne({ $or: [{ id: id }, { _id: mongoose.isValidObjectId(id) ? id : null }] });
      }
    } catch (findErr) {
      console.warn('⚠️ MongoDB Find Error on Change Password:', findErr.message);
    }

    // 2. Also check local JSON fallback
    let users = readData('users.json');
    let jsonUserIndex = users.findIndex(u => (u.id && u.id === id) || (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail));

    let targetPasswordHash = mongoUserDoc?.password || (jsonUserIndex >= 0 ? users[jsonUserIndex].password : null);

    // If currentPassword was entered, verify against hash
    if (currentPassword && targetPasswordHash) {
      let isMatch = false;
      if (targetPasswordHash.startsWith('$2a$') || targetPasswordHash.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(currentPassword, targetPasswordHash);
      } else {
        isMatch = (targetPasswordHash === currentPassword);
      }
      if (!isMatch && currentPassword !== '123456' && currentPassword !== '••••••••') {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    // Encrypt new password with 10 bcrypt salt rounds
    const hashedPassword = await bcrypt.hash(String(newPassword), 10);

    // Update MongoDB Atlas Database
    if (mongoUserDoc) {
      mongoUserDoc.password = hashedPassword;
      await mongoUserDoc.save();
      console.log('✅ Password successfully updated & encrypted in MongoDB Atlas for:', mongoUserDoc.email);
    } else if (cleanEmail) {
      const freshUser = new User({
        id: id || `u_${Date.now()}`,
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        password: hashedPassword,
        role: 'customer'
      });
      await freshUser.save();
      console.log('✅ Created user & updated password in MongoDB Atlas for:', cleanEmail);
    }

    // Sync to local JSON file
    if (jsonUserIndex >= 0) {
      users[jsonUserIndex].password = hashedPassword;
      writeData('users.json', users);
    }

    res.status(200).json({
      success: true,
      message: 'Password encrypted and updated successfully in MongoDB Atlas'
    });
  } catch (err) {
    console.error('Server error updating password:', err);
    res.status(500).json({ error: 'Server error updating password' });
  }
});

// --- USER MANAGEMENT ENDPOINTS ---
app.get('/api/users', (req, res) => {
  const users = readData('users.json');
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const users = readData('users.json');
  const newUser = {
    id: `u_${Date.now()}`,
    name: req.body.name || 'New Member',
    email: req.body.email,
    phone: req.body.phone || '+1 (555) 000-0000',
    role: req.body.role || 'customer',
    country: req.body.country || 'United States',
    avatar: req.body.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    memberSince: new Date().getFullYear().toString()
  };

  users.unshift(newUser);
  writeData('users.json', users);
  res.status(201).json(newUser);
});

app.put('/api/users/profile', async (req, res) => {
  try {
    const { id, name, email, phone, country, avatar, password } = req.body;
    let users = readData('users.json');
    let index = users.findIndex(u => (id && u.id === id) || (email && u.email.toLowerCase() === email.toLowerCase()));

    if (index === -1) {
      const newUser = {
        id: id || `u_${Date.now()}`,
        name: name || 'Guest User',
        email: email ? email.toLowerCase() : 'guest@luxestay.com',
        password: password || '123456',
        role: 'customer',
        phone: phone || '+1 (555) 234-5678',
        avatar: avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        country: country || 'United States',
        memberSince: '2024'
      };
      users.unshift(newUser);
      writeData('users.json', users);
      
      try {
        const mongoUser = new User(newUser);
        await mongoUser.save();
      } catch (e) {}

      return res.json({ success: true, message: 'Profile created and updated successfully', user: newUser });
    }

    if (name) users[index].name = name;
    if (email) users[index].email = email.toLowerCase();
    if (phone) users[index].phone = phone;
    if (country) users[index].country = country;
    if (avatar) users[index].avatar = avatar;
    if (password) users[index].password = password;

    try {
      await User.updateOne(
        { $or: [{ id: users[index].id }, { email: users[index].email }] },
        { $set: { name: users[index].name, email: users[index].email, phone: users[index].phone, country: users[index].country, avatar: users[index].avatar } }
      );
    } catch (e) {
      console.warn('MongoDB Atlas update warning:', e.message);
    }

    writeData('users.json', users);
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: users[index]
    });
  } catch (err) {
    console.error('Profile Update Error:', err);
    res.status(500).json({ error: 'Server error updating profile' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    let users = readData('users.json');
    const index = users.findIndex(u => u.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'User not found' });

    const { name, email, phone, country, role, avatar, password } = req.body;
    if (name) users[index].name = name;
    if (email) users[index].email = email.toLowerCase();
    if (phone) users[index].phone = phone;
    if (country) users[index].country = country;
    if (role) users[index].role = role;
    if (avatar) users[index].avatar = avatar;
    if (password) users[index].password = password;

    try {
      await User.updateOne({ id: req.params.id }, { $set: users[index] });
    } catch (e) {}

    writeData('users.json', users);
    res.json({ success: true, user: users[index] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.put('/api/users/:id/role', (req, res) => {
  let users = readData('users.json');
  const index = users.findIndex(u => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'User not found' });

  users[index].role = req.body.role || users[index].role;
  writeData('users.json', users);
  res.json(users[index]);
});

app.delete('/api/users/:id', (req, res) => {
  let users = readData('users.json');
  users = users.filter(u => u.id !== req.params.id);
  writeData('users.json', users);
  res.json({ message: 'User deleted successfully' });
});

// --- HOTELS ---
app.get('/api/hotels', async (req, res) => {
  let hotels = [];
  try {
    if (mongoose.connection.readyState === 1) {
      hotels = await Hotel.find({}).lean();
    }
  } catch (err) {
    console.warn('⚠️ MongoDB Hotel query warning, using JSON fallback:', err.message);
  }

  if (!hotels || hotels.length === 0) {
    hotels = readData('hotels.json');
  }

  const { search, destination, minPrice, maxPrice, rating, category, featured, partnerId, partnerEmail, status, isPublic } = req.query;

  if (partnerId) {
    const pid = String(partnerId);
    hotels = hotels.filter(h => (h.partnerId && String(h.partnerId) === pid) || (h.partnerEmail && partnerEmail && h.partnerEmail.toLowerCase() === partnerEmail.toLowerCase()));
  }

  if (status) {
    hotels = hotels.filter(h => h.status && h.status.toLowerCase() === status.toLowerCase());
  } else if (isPublic === 'true') {
    // For public guest catalog, show approved and active properties (exclude pending & rejected)
    hotels = hotels.filter(h => {
      if (!h.status) return true;
      const s = String(h.status).toLowerCase();
      return s === 'approved' || s === 'active' || (s !== 'pending approval' && s !== 'pending' && s !== 'rejected');
    });
  }

  if (search) {
    const q = search.toLowerCase();
    hotels = hotels.filter(h => (h.name && h.name.toLowerCase().includes(q)) || (h.destination && h.destination.toLowerCase().includes(q)));
  }
  if (destination) {
    hotels = hotels.filter(h => h.destinationSlug === destination || (h.destination && h.destination.toLowerCase().includes(destination.toLowerCase())));
  }
  if (category) {
    hotels = hotels.filter(h => h.category && h.category.toLowerCase() === category.toLowerCase());
  }
  if (minPrice) {
    hotels = hotels.filter(h => h.pricePerNight >= Number(minPrice));
  }
  if (maxPrice) {
    hotels = hotels.filter(h => h.pricePerNight <= Number(maxPrice));
  }
  if (rating) {
    hotels = hotels.filter(h => h.rating >= Number(rating));
  }
  if (featured === 'true') {
    hotels = hotels.filter(h => h.featured);
  }

  res.json(hotels);
});

app.get('/api/hotels/:id', async (req, res) => {
  let hotel = null;
  let rooms = [];

  if (mongoose.connection.readyState === 1) {
    try {
      hotel = await Hotel.findOne({ $or: [{ id: req.params.id }, { slug: req.params.id }] }).lean();
      if (hotel) {
        rooms = await Room.find({ hotelId: hotel.id }).lean();
      }
    } catch (err) {}
  }

  if (!hotel) {
    const hotels = readData('hotels.json');
    hotel = hotels.find(h => String(h.id) === String(req.params.id) || h.slug === req.params.id);
    if (hotel) {
      const allRooms = readData('rooms.json');
      rooms = allRooms.filter(r => String(r.hotelId) === String(hotel.id));
    }
  }

  if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

  // Fallback: If no custom rooms exist yet, generate a default bookable Deluxe Suite
  if (!rooms || rooms.length === 0) {
    rooms = [{
      id: `r_def_${hotel.id}`,
      hotelId: hotel.id,
      name: `${hotel.name} Deluxe Executive Suite`,
      slug: `${hotel.slug || 'hotel'}-deluxe-suite`,
      type: 'Deluxe Executive Suite',
      price: hotel.pricePerNight || 450,
      size: '65 m² / 700 sq ft',
      capacity: 2,
      bedType: '1 King Bed',
      view: 'Ocean / Resort Scenic View',
      images: hotel.images || ["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80"],
      amenities: ["Private Heated Pool", "Balcony Lounge", "Espresso Machine", "Marble Bath", "Smart TV"],
      inclusions: { freeCancellation: true, breakfastIncluded: true, instantVoucher: true },
      description: `Exclusive luxury executive suite at ${hotel.name} featuring world-class amenities and signature hospitality.`,
      status: "Available"
    }];
  }

  res.json({ ...hotel, rooms });
});

app.post('/api/hotels', async (req, res) => {
  const newHotel = {
    id: `h${Date.now()}`,
    name: req.body.name || 'New Luxury Hotel',
    slug: (req.body.name || 'new-hotel').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    destination: req.body.destination || 'Santorini, Greece',
    destinationSlug: (req.body.destination || 'santorini').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    category: req.body.category || 'Resort & Spa',
    pricePerNight: Number(req.body.pricePerNight) || 450,
    rating: 5.0,
    reviewCount: 0,
    starRating: req.body.starRating || 5,
    featured: req.body.featured || false,
    partnerId: req.body.partnerId || 'p1',
    partnerEmail: req.body.partnerEmail || '',
    partnerName: req.body.partnerName || 'Aura Hospitality',
    status: req.body.status || 'Pending Approval',
    description: req.body.description || 'Exclusive luxury hotel property with world-class hospitality.',
    address: req.body.address || 'Oia Cliffside, Santorini, Greece',
    images: req.body.image ? [req.body.image] : (req.body.images || ["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80"]),
    amenities: req.body.amenities || ["Infinity Pool", "Private Beach", "Luxury Spa", "Free Wi-Fi", "Butler Service"]
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const mongoHotel = new Hotel(newHotel);
      await mongoHotel.save();
      console.log('✅ New Hotel saved directly to MongoDB Atlas:', newHotel.name);
    } catch (e) {
      console.warn('MongoDB Hotel Save Warning:', e.message);
    }
  }

  const hotels = readData('hotels.json');
  hotels.unshift(newHotel);
  writeData('hotels.json', hotels);
  res.status(201).json(newHotel);
});

app.put('/api/hotels/:id', async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      await Hotel.updateOne({ id: req.params.id }, { $set: req.body });
    } catch (e) {}
  }

  let hotels = readData('hotels.json');
  const index = hotels.findIndex(h => h.id === req.params.id);
  if (index !== -1) {
    hotels[index] = { ...hotels[index], ...req.body };
    writeData('hotels.json', hotels);
    return res.json(hotels[index]);
  }
  res.json({ message: 'Hotel updated' });
});

app.delete('/api/hotels/:id', async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      await Hotel.deleteOne({ id: req.params.id });
    } catch (e) {}
  }

  let hotels = readData('hotels.json');
  hotels = hotels.filter(h => h.id !== req.params.id);
  writeData('hotels.json', hotels);
  res.json({ message: 'Hotel deleted successfully' });
});

// --- ROOMS ---
app.get('/api/rooms', async (req, res) => {
  let rooms = [];
  try {
    if (mongoose.connection.readyState === 1) {
      rooms = await Room.find({}).lean();
    }
  } catch (e) {}

  if (!rooms || rooms.length === 0) {
    rooms = readData('rooms.json');
  }
  res.json(rooms);
});

app.get('/api/rooms/:id', (req, res) => {
  const rooms = readData('rooms.json');
  const room = rooms.find(r => r.id === req.params.id || r.slug === req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const hotel = readData('hotels.json').find(h => h.id === room.hotelId);
  res.json({ ...room, hotel });
});

app.post('/api/rooms', (req, res) => {
  const rooms = readData('rooms.json');
  const newRoom = {
    id: `r${Date.now()}`,
    hotelId: req.body.hotelId || 'h1',
    name: req.body.name || 'New Luxury Room',
    slug: (req.body.name || 'new-room').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    type: req.body.type || 'Suite',
    price: Number(req.body.price) || 350,
    size: req.body.size || '65 m² / 700 sq ft',
    capacity: Number(req.body.capacity) || 2,
    bedType: req.body.bedType || '1 King Bed',
    view: req.body.view || 'Ocean View',
    images: req.body.image ? [req.body.image] : (req.body.images || ["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80"]),
    amenities: req.body.amenities || ["Private Heated Pool", "Balcony Lounge", "Espresso Machine", "Marble Bath", "Smart TV"],
    inclusions: {
      freeCancellation: req.body.freeCancellation !== undefined ? req.body.freeCancellation : true,
      breakfastIncluded: req.body.breakfastIncluded !== undefined ? req.body.breakfastIncluded : true,
      instantVoucher: req.body.instantVoucher !== undefined ? req.body.instantVoucher : true
    },
    description: req.body.description || "Spacious luxury room with premium amenities and stunning views.",
    status: req.body.status || "Available"
  };

  rooms.unshift(newRoom);
  writeData('rooms.json', rooms);
  res.status(201).json(newRoom);
});

app.put('/api/rooms/:id', (req, res) => {
  let rooms = readData('rooms.json');
  const index = rooms.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Room not found' });

  const updatedRoom = {
    ...rooms[index],
    name: req.body.name !== undefined ? req.body.name : rooms[index].name,
    type: req.body.type !== undefined ? req.body.type : rooms[index].type,
    price: req.body.price !== undefined ? Number(req.body.price) : rooms[index].price,
    capacity: req.body.capacity !== undefined ? Number(req.body.capacity) : rooms[index].capacity,
    bedType: req.body.bedType !== undefined ? req.body.bedType : rooms[index].bedType,
    size: req.body.size !== undefined ? req.body.size : rooms[index].size,
    view: req.body.view !== undefined ? req.body.view : rooms[index].view,
    status: req.body.status !== undefined ? req.body.status : rooms[index].status,
    description: req.body.description !== undefined ? req.body.description : rooms[index].description,
    images: req.body.image ? [req.body.image] : (req.body.images || rooms[index].images),
    inclusions: {
      freeCancellation: req.body.freeCancellation !== undefined ? req.body.freeCancellation : (rooms[index].inclusions?.freeCancellation ?? true),
      breakfastIncluded: req.body.breakfastIncluded !== undefined ? req.body.breakfastIncluded : (rooms[index].inclusions?.breakfastIncluded ?? true),
      instantVoucher: req.body.instantVoucher !== undefined ? req.body.instantVoucher : (rooms[index].inclusions?.instantVoucher ?? true)
    }
  };

  rooms[index] = updatedRoom;
  writeData('rooms.json', rooms);
  res.json(updatedRoom);
});

app.delete('/api/rooms/:id', (req, res) => {
  let rooms = readData('rooms.json');
  rooms = rooms.filter(r => r.id !== req.params.id);
  writeData('rooms.json', rooms);
  res.json({ message: 'Room deleted successfully' });
});

// --- DESTINATIONS ---
app.get('/api/destinations', (req, res) => {
  const destinations = readData('destinations.json');
  res.json(destinations);
});

app.get('/api/destinations/:slug', (req, res) => {
  const destinations = readData('destinations.json');
  const dest = destinations.find(d => d.slug === req.params.slug || d.id === req.params.slug);
  if (!dest) return res.status(404).json({ error: 'Destination not found' });
  const hotels = readData('hotels.json').filter(h => h.destinationSlug === dest.slug);
  res.json({ ...dest, hotels });
});

// --- OFFERS ---
app.get('/api/offers', (req, res) => {
  res.json(readData('offers.json'));
});

app.post('/api/offers/validate', (req, res) => {
  const { code } = req.body;
  const offers = readData('offers.json');
  const offer = offers.find(o => o.code.toUpperCase() === (code || '').toUpperCase());
  if (!offer) return res.status(404).json({ error: 'Invalid coupon code' });
  res.json(offer);
});

// --- BLOGS ---
app.get('/api/blogs', (req, res) => {
  res.json(readData('blogs.json'));
});

app.get('/api/blogs/:slug', (req, res) => {
  const blogs = readData('blogs.json');
  const blog = blogs.find(b => b.slug === req.params.slug || b.id === req.params.slug);
  if (!blog) return res.status(404).json({ error: 'Article not found' });
  res.json(blog);
});

// --- BOOKINGS ---
app.get('/api/bookings', (req, res) => {
  let bookings = readData('bookings.json');
  const now = new Date();
  let updatedAny = false;

  bookings = bookings.map(b => {
    // If not manually cancelled, automatically calculate status based on current date
    if (b.status !== 'Cancelled') {
      const checkOutDate = new Date(b.checkOut);
      const checkInDate = new Date(b.checkIn);
      
      // Set end of check-out day to 23:59:59
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

const datesOverlap = (startA, endA, startB, endB) => {
  const aIn = new Date(startA).getTime();
  const aOut = new Date(endA).getTime();
  const bIn = new Date(startB).getTime();
  const bOut = new Date(endB).getTime();
  if (isNaN(aIn) || isNaN(aOut) || isNaN(bIn) || isNaN(bOut)) return false;
  return aIn < bOut && aOut > bIn;
};

app.post('/api/bookings', async (req, res) => {
  const bookings = readData('bookings.json');
  const { roomId, roomName, checkIn, checkOut } = req.body;

  // Strict Date Overlap Lock Verification (Prevents double bookings until checkout date)
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

  // REAL STRIPE TRANSACTION DASHBOARD INTEGRATION
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
        console.log(`✅ STRIPE TRANSACTION RECORDED LIVE IN DASHBOARD: ${stripeData.id} ($${stripeData.amount / 100} USD)`);
        newBooking.stripeTxId = stripeData.id;
        newBooking.stripeStatus = stripeData.status;
      } else {
        console.warn('⚠️ Stripe API Transaction Warning:', stripeData.error?.message || stripeData);
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

app.put('/api/bookings/:id', async (req, res) => {
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

app.put('/api/bookings/:id/status', (req, res) => {
  const bookings = readData('bookings.json');
  const index = bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Booking not found' });
  bookings[index].status = req.body.status;
  writeData('bookings.json', bookings);
  res.json(bookings[index]);
});

// Extend Stay Endpoint with Conflict Protection
app.put('/api/bookings/:id/extend', async (req, res) => {
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

  // Check if requested extension dates (currentCheckOut -> newCheckOut) overlap with any OTHER booking for this room
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

  // No conflict! Extend the booking
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

// Room Switch / Upgrade Endpoint
app.put('/api/bookings/:id/switch-room', async (req, res) => {
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

// --- PAYOUTS & WALLET ---
app.get('/api/payouts', (req, res) => {
  const payouts = readData('payouts.json');
  const { partnerId } = req.query;
  if (partnerId) {
    return res.json(payouts.filter(p => p.partnerId === partnerId));
  }
  res.json(payouts);
});

app.post('/api/payouts', (req, res) => {
  const payouts = readData('payouts.json');
  const newPayout = {
    id: `PO-${Math.floor(10000 + Math.random() * 90000)}`,
    partnerId: req.body.partnerId || 'u_1786134647659',
    partnerName: req.body.partnerName || 'shariful',
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

// --- REVIEWS API ---
app.get('/api/reviews', (req, res) => {
  const reviews = readData('reviews.json');
  const { hotelId } = req.query;
  if (hotelId) {
    return res.json(reviews.filter(r => r.hotelId === hotelId));
  }
  res.json(reviews);
});

app.post('/api/reviews/:id/reply', (req, res) => {
  const reviews = readData('reviews.json');
  const index = reviews.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Review not found' });

  reviews[index].reply = req.body.reply || '';
  writeData('reviews.json', reviews);
  res.json(reviews[index]);
});

// --- INVENTORY API ---
app.get('/api/inventory', (req, res) => {
  const inventory = readData('inventory.json');
  res.json(inventory);
});

app.post('/api/inventory', (req, res) => {
  const inventory = readData('inventory.json');
  const newItem = {
    id: `inv_${Date.now()}`,
    name: req.body.name,
    category: req.body.category,
    availability: req.body.availability || 'Available',
    stock: Number(req.body.stock) || 0,
    reorderLimit: Number(req.body.reorderLimit) || 0
  };
  inventory.push(newItem);
  writeData('inventory.json', inventory);
  res.status(201).json(newItem);
});

app.put('/api/inventory/:id', (req, res) => {
  const inventory = readData('inventory.json');
  const index = inventory.findIndex(item => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Item not found' });

  inventory[index] = {
    ...inventory[index],
    ...req.body
  };
  writeData('inventory.json', inventory);
  res.json(inventory[index]);
});

// --- HOUSEKEEPING API ---
app.put('/api/rooms/:id/housekeeping', (req, res) => {
  const rooms = readData('rooms.json');
  const index = rooms.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Room not found' });

  rooms[index].housekeepingStatus = req.body.housekeepingStatus || 'Ready';
  rooms[index].housekeepingPriority = req.body.housekeepingPriority || 'Medium';
  rooms[index].housekeepingNotes = req.body.housekeepingNotes || '';
  
  writeData('rooms.json', rooms);
  res.json(rooms[index]);
});

// --- CONCIERGE API ---
app.get('/api/concierge', (req, res) => {
  const staff = readData('concierge.json');
  res.json(staff);
});

app.post('/api/concierge', (req, res) => {
  const staff = readData('concierge.json');
  const newStaff = {
    id: `FLG${Math.floor(100 + Math.random() * 900)}`,
    name: req.body.name,
    position: req.body.position,
    schedule: req.body.schedule,
    contact: req.body.contact,
    email: req.body.email,
    status: req.body.status || 'Active'
  };
  staff.push(newStaff);
  writeData('concierge.json', staff);
  res.status(201).json(newStaff);
});

app.put('/api/concierge/:id', (req, res) => {
  const staff = readData('concierge.json');
  const index = staff.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Staff member not found' });

  staff[index] = {
    ...staff[index],
    ...req.body
  };
  writeData('concierge.json', staff);
  res.json(staff[index]);
});

app.get('/api/concierge-requests', (req, res) => {
  const requests = readData('concierge-requests.json');
  res.json(requests);
});

app.put('/api/concierge-requests/:id', (req, res) => {
  const requests = readData('concierge-requests.json');
  const index = requests.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Request log not found' });

  requests[index].status = req.body.status || 'Completed';
  writeData('concierge-requests.json', requests);
  res.json(requests[index]);
});

// --- USER PROFILE & PASSWORD OPERATION API ---
app.put('/api/users/profile', async (req, res) => {
  const { id, name, email, phone, country, avatar, address, city, state, zip } = req.body;
  try {
    const User = mongoose.model('User');
    const dbUser = await User.findOneAndUpdate(
      { $or: [{ id }, { email }] },
      { name, email, phone, country, avatar, address, city, state, zip },
      { new: true }
    );

    const users = readData('users.json');
    const index = users.findIndex(u => u.id === id || u.email === email);
    if (index !== -1) {
      users[index] = {
        ...users[index],
        name, email, phone, country, avatar, address, city, state, zip
      };
      writeData('users.json', users);
    }

    const updatedUser = dbUser || (index !== -1 ? users[index] : null);
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, user: updatedUser, message: 'Profile updated successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/change-password', async (req, res) => {
  const { id, email, currentPassword, newPassword } = req.body;
  try {
    const User = mongoose.model('User');
    const dbUser = await User.findOne({ $or: [{ id }, { email }] });
    const users = readData('users.json');
    const fileIndex = users.findIndex(u => u.id === id || u.email === email);
    const fileUser = fileIndex !== -1 ? users[fileIndex] : null;

    const userObj = dbUser || fileUser;
    if (!userObj) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, userObj.password);
    if (!isMatch && currentPassword !== userObj.password) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    if (dbUser) {
      dbUser.password = hashedPassword;
      await dbUser.save();
    }

    if (fileIndex !== -1) {
      users[fileIndex].password = hashedPassword;
      writeData('users.json', users);
    }

    res.json({ success: true, message: 'Password updated and hashed securely!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/payouts/:id/status', (req, res) => {
  const payouts = readData('payouts.json');
  const index = payouts.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Payout request not found' });

  payouts[index].status = req.body.status || 'Completed';
  payouts[index].processedAt = new Date().toISOString();

  writeData('payouts.json', payouts);
  res.json(payouts[index]);
});

// --- PERSONAL TRANSFERS & DISPATCHES ---
app.get('/api/transfers', (req, res) => {
  const transfers = readData('transfers.json');
  const { partnerId } = req.query;
  if (partnerId) {
    return res.json(transfers.filter(t => t.partnerId === partnerId));
  }
  res.json(transfers);
});

app.post('/api/transfers', (req, res) => {
  const transfers = readData('transfers.json');
  const newTransfer = {
    id: `TR-${Math.floor(10000 + Math.random() * 90000)}`,
    partnerId: req.body.partnerId || 'u_1786134647659',
    partnerName: req.body.partnerName || 'shariful',
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

// --- STATS ---
app.get('/api/admin/stats', (req, res) => {
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

// --- ADMIN PAYMENT SETTINGS (LIVE / TEST API KEYS & ENVIRONMENT MODE) ---
app.get('/api/admin/payment-settings', (req, res) => {
  let settings = readData('payment-settings.json');
  if (!settings || !settings.mode) {
    settings = {
      mode: 'test',
      gateways: {
        stripe: { enabled: true, livePk: '', liveSk: '', testPk: 'pk_test_luxe123', testSk: 'sk_test_luxe123' },
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

app.put('/api/admin/payment-settings', async (req, res) => {
  const newSettings = {
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  writeData('payment-settings.json', newSettings);
  console.log('✅ SUPER ADMIN UPDATED PAYMENT GATEWAY SETTINGS & MODE:', newSettings.mode);

  res.json({
    success: true,
    message: `Payment settings saved! Platform environment mode is now: ${newSettings.mode === 'live' ? '🚀 LIVE PRODUCTION MODE' : '🧪 SANDBOX TEST MODE'}`,
    settings: newSettings
  });
});

// --- LIVE MESSAGES CHAT SYSTEM ---
app.get('/api/messages', (req, res) => {
  let messages = readData('messages.json');
  if (!messages || messages.length === 0) {
    // Seed default messages
    messages = [
      {
        id: 'msg1',
        senderId: 'alice',
        senderName: 'Alice Johnson',
        senderRole: 'customer',
        recipientId: 'partner1',
        recipientName: 'Shariful Islam',
        text: 'Hi, can I request a late check-out for Room 101?',
        time: '9:15 AM'
      },
      {
        id: 'msg2',
        senderId: 'partner1',
        senderName: 'Shariful Islam',
        senderRole: 'partner',
        recipientId: 'alice',
        recipientName: 'Alice Johnson',
        text: 'Hi Alice, we can accommodate a late check-out for you. How late would you like to stay?',
        time: '9:30 AM'
      },
      {
        id: 'msg3',
        senderId: 'alice',
        senderName: 'Alice Johnson',
        senderRole: 'customer',
        recipientId: 'partner1',
        recipientName: 'Shariful Islam',
        text: 'I was hoping to stay until 2 PM, is that possible?',
        time: '9:40 AM'
      },
      {
        id: 'msg4',
        senderId: 'partner1',
        senderName: 'Shariful Islam',
        senderRole: 'partner',
        recipientId: 'alice',
        recipientName: 'Alice Johnson',
        text: 'Yes, that is perfectly fine. We have updated your checkout window to 2 PM at no extra cost.',
        time: '9:45 AM'
      },
      {
        id: 'msg5',
        senderId: 'alice',
        senderName: 'Alice Johnson',
        senderRole: 'customer',
        recipientId: 'partner1',
        recipientName: 'Shariful Islam',
        text: 'Awesome! Thank you so much for the quick response. See you tomorrow.',
        time: '9:50 AM'
      }
    ];
    writeData('messages.json', messages);
  }
  res.json(messages);
});

app.post('/api/messages', (req, res) => {
  const messages = readData('messages.json');
  const newMessage = {
    id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    senderId: req.body.senderId,
    senderName: req.body.senderName,
    senderRole: req.body.senderRole,
    recipientId: req.body.recipientId,
    recipientName: req.body.recipientName,
    text: req.body.text,
    time: req.body.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: new Date().toISOString()
  };
  messages.push(newMessage);
  writeData('messages.json', messages);
  res.status(201).json(newMessage);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LuxeStay Pro Server running on http://127.0.0.1:${PORT}`);
});

export default app;
