import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';
import { connectDatabase, isDbConnected } from '../config/db.js';

const router = express.Router();

// Reset Tokens In-Memory Store for OTP recovery
export const resetTokens = new Map();

// In-Memory Fast Lookup Helper - Preserves user avatar (custom URLs, uploads & base64)
const sanitizeAvatar = (avatar, role = 'customer', name = 'User') => {
  if (avatar && typeof avatar === 'string' && avatar.trim().length > 0 && !avatar.includes('photo-1534528741775')) {
    return avatar.trim();
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=0284c7&color=fff&bold=true`;
};


// --- 1. REGISTER ---
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'customer', phone, country, avatar } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existingUsers = readData('users.json') || [];

    // Check local existing
    const isLocalExist = existingUsers.some(u => u && u.email && u.email.toLowerCase() === cleanEmail);
    if (isLocalExist) {
      return res.status(400).json({ error: 'User account with this email already exists' });
    }

    // Encrypt password securely (cost factor 6 for sub-10ms response)
    const hashedPassword = await bcrypt.hash(password, 6);
    const cleanAvatarUrl = sanitizeAvatar(avatar, role, name.trim());

    const newUserPayload = {
      id: `u_${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role: role || 'customer',
      phone: phone || '+1 (555) 000-1122',
      avatar: cleanAvatarUrl,
      country: country || 'United States',
      memberSince: '2026'
    };

    // Save to local JSON immediately
    existingUsers.unshift(newUserPayload);
    writeData('users.json', existingUsers);

    // Sync to MongoDB Atlas
    await connectDatabase();
    if (mongoose.connection.readyState === 1) {
      try {
        await User.create(newUserPayload);
      } catch (e) {}
    }

    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      user: { 
        id: newUserPayload.id, 
        name: newUserPayload.name, 
        email: newUserPayload.email, 
        role: newUserPayload.role, 
        avatar: newUserPayload.avatar, 
        phone: newUserPayload.phone,
        country: newUserPayload.country
      },
      token: `jwt-token-${newUserPayload.id}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// --- 2. GOOGLE AUTH ---
router.post('/google', async (req, res) => {
  try {
    const { name, email, avatar, role = 'customer', uid } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required for Google auth' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existingUsers = readData('users.json') || [];
    let userObj = existingUsers.find(u => u && u.email && u.email.toLowerCase() === cleanEmail);

    if (userObj) {
      if (name) userObj.name = name;
      if (avatar && !avatar.startsWith('data:')) userObj.avatar = avatar;
      writeData('users.json', existingUsers);
    } else {
      const defaultHashedPassword = await bcrypt.hash(`google_${uid || Date.now()}`, 6);
      userObj = {
        id: `u_google_${Date.now()}`,
        name: name || cleanEmail.split('@')[0],
        email: cleanEmail,
        password: defaultHashedPassword,
        role: role || 'customer',
        phone: '+1 (555) 000-9988',
        avatar: sanitizeAvatar(avatar, role),
        country: 'United States',
        memberSince: '2026'
      };
      existingUsers.unshift(userObj);
      writeData('users.json', existingUsers);
    }

    // Sync to Mongo in background
    if (isDbConnected()) {
      User.findOneAndUpdate(
        { email: cleanEmail },
        { $set: userObj },
        { upsert: true, new: true }
      ).catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: 'Google user authenticated successfully',
      user: {
        id: userObj.id,
        name: userObj.name,
        email: userObj.email,
        role: userObj.role,
        avatar: userObj.avatar,
        phone: userObj.phone,
        country: userObj.country
      },
      token: `jwt-token-${userObj.id}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during Google authentication' });
  }
});

// --- 3. ULTRA-FAST LIVE MONGODB & SERVER LOGIN ---
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Connect to MongoDB Atlas and retrieve real user
    await connectDatabase();
    let userObj = null;
    if (mongoose.connection.readyState === 1) {
      try {
        userObj = await User.findOne({ email: cleanEmail }).lean();
      } catch (findErr) {}
    }

    // 2. If account not found in MongoDB Atlas, reject immediately (no fake users)
    if (!userObj) {
      return res.status(401).json({ error: 'Account not found in database. Please register first.' });
    }

    // 3. Real Password Verification via Bcrypt
    let isPasswordMatch = false;
    if (userObj.password) {
      try {
        if (userObj.password.startsWith('$2a$') || userObj.password.startsWith('$2b$')) {
          isPasswordMatch = await bcrypt.compare(password, userObj.password);
        } else {
          isPasswordMatch = (password === userObj.password);
        }
      } catch (compareErr) {
        isPasswordMatch = (password === userObj.password);
      }
    }

    if (!isPasswordMatch) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const finalRole = userObj.role || 'customer';
    const finalAvatar = sanitizeAvatar(userObj.avatar, finalRole, userObj.name);

    // 4. Return Real MongoDB User Profile
    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: userObj.id || userObj._id?.toString(),
        name: userObj.name || 'User',
        email: userObj.email || cleanEmail,
        role: finalRole,
        avatar: finalAvatar,
        phone: userObj.phone || '',
        country: userObj.country || '',
        address: userObj.address || '',
        city: userObj.city || '',
        state: userObj.state || '',
        zip: userObj.zip || ''
      },
      token: `jwt-token-${userObj.id || userObj._id}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Server database login error' });
  }
});

// --- 4. FORGOT PASSWORD ---
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, role = 'customer' } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const cleanEmail = String(email).trim().toLowerCase();
    const users = readData('users.json') || [];
    let user = users.find(u => u && u.email && u.email.toLowerCase() === cleanEmail);

    if (!user) {
      const defaultPassword = await bcrypt.hash('123456', 6);
      user = {
        id: `u_${Date.now()}`,
        name: role === 'admin' ? 'Platform Admin' : role === 'manager' ? 'Hotel Manager' : cleanEmail.split('@')[0],
        email: cleanEmail,
        password: defaultPassword,
        role: role || 'customer',
        avatar: sanitizeAvatar(null, role),
        phone: '+1 (555) 000-9988',
        country: 'United States',
        memberSince: '2026'
      };

      users.unshift(user);
      writeData('users.json', users);

      if (isDbConnected()) {
        User.create(user).catch(() => {});
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    resetTokens.set(cleanEmail, { otp, role: user.role, expiresAt: Date.now() + 15 * 60 * 1000 });

    return res.json({
      success: true,
      message: `Password reset code generated for ${user.role.toUpperCase()} account`,
      otp,
      email: cleanEmail,
      role: user.role
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error generating reset code' });
  }
});

// --- 5. RESET PASSWORD ---
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword, role = 'customer' } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const record = resetTokens.get(cleanEmail);
    
    if (otp && record && record.otp && String(record.otp).trim() !== String(otp).trim()) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    let users = readData('users.json') || [];
    let index = users.findIndex(u => u && u.email && u.email.toLowerCase() === cleanEmail);

    const hashedPassword = await bcrypt.hash(String(newPassword), 6);

    if (index !== -1) {
      users[index].password = hashedPassword;
    } else {
      const newUser = {
        id: `u_${Date.now()}`,
        name: role === 'admin' ? 'Platform Admin' : role === 'manager' ? 'Hotel Manager' : cleanEmail.split('@')[0],
        email: cleanEmail,
        password: hashedPassword,
        role,
        phone: '+1 (555) 000-1122',
        avatar: sanitizeAvatar(null, role),
        country: 'United States',
        memberSince: '2026'
      };
      users.unshift(newUser);
      index = 0;
    }

    writeData('users.json', users);

    if (isDbConnected()) {
      User.updateOne({ email: cleanEmail }, { $set: { password: hashedPassword } }, { upsert: true }).catch(() => {});
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
    return res.status(500).json({ error: err.message || 'Server error resetting password' });
  }
});

export default router;
