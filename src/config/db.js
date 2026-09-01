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
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then(async (m) => {
      console.log('✅ [Database] MongoDB Atlas Connected Successfully (Live Persistence Mode)!');
      if (!cached.seeded) {
        try {
          await seedMongoDBDatabase();
          cached.seeded = true;
        } catch (e) {
          console.warn('⚠️ Seeder notice:', e.message);
        }
      }
      return m;
    }).catch(err => {
      console.error('❌ [Database] MongoDB Connection Error:', err.message);
      cached.promise = null;
      return null;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

mongoose.connection.on('connected', () => {
  console.log('🟢 [Database] Mongoose event: CONNECTED');
});

mongoose.connection.on('error', (err) => {
  console.error('🔴 [Database] Mongoose error:', err.message);
});
