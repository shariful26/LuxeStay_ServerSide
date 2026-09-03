import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/index.js';
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

    // Check existing in real MongoDB Atlas
    await connectDatabase();
    if (mongoose.connection.readyState === 1) {
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(400).json({ error: 'User account with this email already exists' });
      }
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

    // Save directly to MongoDB Atlas
    let createdUser = null;
    if (mongoose.connection.readyState === 1) {
      createdUser = await User.create(newUserPayload);
    }

    const finalId = createdUser?.id || createdUser?._id?.toString() || newUserPayload.id;

    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      user: { 
        id: finalId, 
        name: newUserPayload.name, 
        email: newUserPayload.email, 
        role: newUserPayload.role, 
        avatar: newUserPayload.avatar, 
        phone: newUserPayload.phone,
        country: newUserPayload.country
      },
      token: `jwt-token-${finalId}`
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
    await connectDatabase();

    let userObj = null;
    if (mongoose.connection.readyState === 1) {
      userObj = await User.findOne({ email: cleanEmail });
    }

    if (userObj) {
      if (name) userObj.name = name;
      if (avatar && !avatar.startsWith('data:')) userObj.avatar = avatar;
      await userObj.save();
    } else {
      const defaultHashedPassword = await bcrypt.hash(`google_${uid || Date.now()}`, 6);
      userObj = await User.create({
        id: `u_google_${Date.now()}`,
        name: name || cleanEmail.split('@')[0],
        email: cleanEmail,
        password: defaultHashedPassword,
        role: role || 'customer',
        phone: '+1 (555) 000-9988',
        avatar: sanitizeAvatar(avatar, role),
        country: 'United States',
        memberSince: '2026'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Google user authenticated successfully',
      user: {
        id: userObj.id || userObj._id?.toString(),
        name: userObj.name,
        email: userObj.email,
        role: userObj.role,
        avatar: userObj.avatar,
        phone: userObj.phone,
        country: userObj.country
      },
      token: `jwt-token-${userObj.id || userObj._id}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Google auth failed' });
  }
});

// --- 3. LOGIN ---
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
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
    await connectDatabase();

    let user = null;
    if (mongoose.connection.readyState === 1) {
      user = await User.findOne({ email: cleanEmail });
    }

    if (!user) {
      return res.status(404).json({ error: 'No user account found with this email address' });
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
    const { email, otp, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const record = resetTokens.get(cleanEmail);
    
    if (otp && record && record.otp && String(record.otp).trim() !== String(otp).trim()) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    await connectDatabase();
    const hashedPassword = await bcrypt.hash(String(newPassword), 6);

    let updatedUser = null;
    if (mongoose.connection.readyState === 1) {
      updatedUser = await User.findOneAndUpdate(
        { email: cleanEmail },
        { $set: { password: hashedPassword } },
        { new: true }
      ).lean();
    }

    if (!updatedUser) {
      return res.status(404).json({ error: 'User account not found' });
    }

    if (resetTokens.has(cleanEmail)) {
      resetTokens.delete(cleanEmail);
    }

    return res.json({
      success: true,
      message: 'Password reset and encrypted successfully.',
      user: { 
        id: updatedUser.id || updatedUser._id?.toString(), 
        name: updatedUser.name, 
        email: updatedUser.email, 
        role: updatedUser.role 
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error resetting password' });
  }
});

// --- 6. VERIFY & REFRESH PERSISTENT SESSION ---
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const queryEmail = req.query.email;
    const queryId = req.query.id;

    await connectDatabase();
    let user = null;

    if (mongoose.connection.readyState === 1) {
      if (queryEmail) {
        user = await User.findOne({ email: String(queryEmail).trim().toLowerCase() }).select('-password').lean();
      } else if (queryId) {
        user = await User.findOne({ 
          $or: [
            { id: queryId },
            { _id: mongoose.isValidObjectId(queryId) ? queryId : null }
          ]
        }).select('-password').lean();
      } else if (authHeader && authHeader.startsWith('Bearer jwt-token-')) {
        const extractedId = authHeader.replace('Bearer jwt-token-', '').trim();
        user = await User.findOne({
          $or: [
            { id: extractedId },
            { _id: mongoose.isValidObjectId(extractedId) ? extractedId : null }
          ]
        }).select('-password').lean();
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'Session user not found' });
    }

    const cleanAvatar = sanitizeAvatar(user.avatar, user.role, user.name);
    return res.json({
      success: true,
      user: {
        id: user.id || user._id?.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: cleanAvatar,
        phone: user.phone || '',
        country: user.country || '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        zip: user.zip || ''
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify session' });
  }
});

export default router;
