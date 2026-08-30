import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const USERS_JSON_PATH = path.resolve('data/users.json');

// User Schema to query User model if needed
const userSchema = new mongoose.Schema({
  id: String,
  name: String,
  email: { type: String, unique: true },
  password: { type: String, required: true },
  role: String,
  phone: String,
  avatar: String,
  country: String,
  memberSince: String
}, { collection: 'users' });

const User = mongoose.models.User || mongoose.model('User', userSchema);

const hash = bcrypt.hashSync('123456', 10);
console.log('Using hash:', hash);

async function run() {
  // 1. Update in local users.json file
  if (fs.existsSync(USERS_JSON_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(USERS_JSON_PATH, 'utf8'));
      let updatedCount = 0;
      const targetEmails = ['admin@luxestay.com', 'manager@luxestay.com', 'customer@luxestay.com'];
      
      data.forEach(user => {
        if (user && user.email && targetEmails.includes(user.email.toLowerCase())) {
          user.password = hash;
          updatedCount++;
        }
      });
      
      fs.writeFileSync(USERS_JSON_PATH, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Updated ${updatedCount} users in users.json`);
    } catch (err) {
      console.error('Error updating users.json:', err);
    }
  } else {
    console.error('users.json file not found at:', USERS_JSON_PATH);
  }

  // 2. Update in MongoDB Atlas
  if (MONGODB_URI) {
    try {
      console.log('Connecting to MongoDB Atlas...');
      await mongoose.connect(MONGODB_URI);
      console.log('Connected successfully!');
      
      const targetEmails = ['admin@luxestay.com', 'manager@luxestay.com', 'customer@luxestay.com'];
      const result = await User.updateMany(
        { email: { $in: targetEmails } },
        { $set: { password: hash } }
      );
      
      console.log(`Updated MongoDB documents:`, result);
    } catch (err) {
      console.error('Error updating MongoDB users:', err);
    } finally {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB.');
    }
  } else {
    console.log('No MONGODB_URI found. Skipped MongoDB update.');
  }
}

run().catch(console.error);
