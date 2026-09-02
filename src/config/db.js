import mongoose from 'mongoose';
import { seedMongoDBDatabase } from '../seed/seeder.js';

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, seeded: false };
}

export const connectDatabase = async () => {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    return null;
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      maxPoolSize: 10
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => {
      if (!cached.seeded) {
        cached.seeded = true;
        // Run seeder asynchronously in background
        seedMongoDBDatabase().catch(() => {});
      }
      return m;
    }).catch(err => {
      cached.promise = null;
      return null;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};
