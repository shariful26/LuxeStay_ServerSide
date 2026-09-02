import mongoose from 'mongoose';
import { seedMongoDBDatabase } from '../seed/seeder.js';

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, seeded: false };
}

// Default MongoDB URI fallback for live serverless environment
const DEFAULT_MONGODB_URI = 'mongodb+srv://HotelDbUser:9KLSW5obEl9pdO8h@cluster0.zakm4rq.mongodb.net/hotel_db?retryWrites=true&w=majority&appName=Cluster0';

export const isDbConnected = () => {
  return mongoose.connection && mongoose.connection.readyState === 1;
};

export const connectDatabase = async () => {
  const MONGODB_URI = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 2500,
      connectTimeoutMS: 2500,
      maxPoolSize: 10
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => {
      console.log('MongoDB Atlas Connected Successfully!');
      if (!cached.seeded) {
        cached.seeded = true;
        // Run initial seed if collections are empty
        seedMongoDBDatabase().catch(() => {});
      }
      return m;
    }).catch(err => {
      console.error('MongoDB Atlas Connection Error:', err.message);
      cached.promise = null;
      return null;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.conn = null;
  }

  return cached.conn;
};

