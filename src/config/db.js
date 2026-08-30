import mongoose from 'mongoose';
import { seedMongoDBDatabase } from '../seed/seeder.js';

export const connectDatabase = async () => {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    console.warn('⚠️ [Database] MONGODB_URI is not defined in environment variables. Running in file-based JSON mode.');
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });
    console.log('✅ [Database] MongoDB Atlas Connected Successfully!');
    await seedMongoDBDatabase();
  } catch (err) {
    console.error('❌ [Database] MongoDB Connection Error:', err.message);
    console.log('ℹ️ [Database] Fallback: Express will continue serving requests via local JSON store.');
  }
};

mongoose.connection.on('connected', async () => {
  console.log('🟢 [Database] Mongoose event: CONNECTED');
});

mongoose.connection.on('error', (err) => {
  console.error('🔴 [Database] Mongoose error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('🟡 [Database] Mongoose event: DISCONNECTED');
});
