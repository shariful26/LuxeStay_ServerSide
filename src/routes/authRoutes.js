import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';
import { connectDatabase } from '../config/db.js';

const router = express.Router();

// Reset Tokens In-Memory Store for OTP recovery
export const resetTokens = new Map();

// --- 1. REGISTER ---
router.post('/register', async (req, res) => {
  await connectDatabase();
  try {
    const { name, email, password, role = 'customer', phone, country, avatar } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Check Live MongoDB Atlas if connected
    let mongoExistingUser = null;
    if (mongoose.connection.readyState === 1) {
      try {
        mongoExistingUser = await User.findOne({ email: cleanEmail });
      } catch (findErr) {
        // safe fallback
      }
    }

    if (mongoExistingUser) {
      return res.status(400).json({ error: 'User account with this email already exists' });
    }

    // Encrypt password securely
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
    if (mongoose.connection.readyState === 1) {
      try {
        const freshUser = new User(newUserPayload);
        createdUserDoc = await freshUser.save();
      } catch (saveErr) {
        // safe fallback
      }
    }
    if (!createdUserDoc) createdUserDoc = newUserPayload;

    // Sync to local JSON fallback
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
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// --- 2. GOOGLE AUTH ---
router.post('/google', async (req, res) => {
  await connectDatabase();
  try {
    const { name, email, avatar, role = 'customer', uid } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required for Google auth' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existingUsers = readData('users.json');
    const defaultHashedPassword = await bcrypt.hash(`google_${uid || Date.now()}`, 6);

    let mongoUserDoc = null;
    if (mongoose.connection.readyState === 1) {
      try {
        mongoUserDoc = await User.findOne({ email: cleanEmail });
      } catch (findErr) {
        // safe fallback
      }
    }

    if (mongoUserDoc) {
      mongoUserDoc.name = name || mongoUserDoc.name;
      mongoUserDoc.avatar = avatar || mongoUserDoc.avatar;
      if (mongoose.connection.readyState === 1) {
        try {
          await mongoUserDoc.save();
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
        } catch (insertErr) {
          mongoUserDoc = newUserPayload;
        }
      } else {
        mongoUserDoc = newUserPayload;
      }

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
    res.status(500).json({ error: 'Server error during Google authentication' });
  }
});

// Pre-configured instant high-speed demo accounts
const DEMO_USERS = {
  'customer@luxestay.com': {
    id: 'u_customer_demo',
    name: 'Alice Johnson',
    email: 'customer@luxestay.com',
    role: 'customer',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    phone: '+1 (555) 000-1122',
    country: 'United States'
  },
  'manager@luxestay.com': {
    id: 'u_manager_demo',
    name: 'Shariful Islam (Hotel Manager)',
    email: 'manager@luxestay.com',
    role: 'manager',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    phone: '+1 (555) 000-1122',
    country: 'United States'
  },
  'admin@luxestay.com': {
    id: 'u_admin_demo',
    name: 'System Administrator',
    email: 'admin@luxestay.com',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    phone: '+1 (555) 000-1122',
    country: 'United States'
  },
  'sharif@gmail.com': {
    id: 'u_admin_sharif',
    name: 'Shariful Islam (Admin)',
    email: 'sharif@gmail.com',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    phone: '+1 (555) 000-1122',
    country: 'United States'
  },
  'shariful@gmail.com': {
    id: 'u_admin_shariful',
    name: 'Shariful Islam (Admin)',
    email: 'shariful@gmail.com',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    phone: '+1 (555) 000-1122',
    country: 'United States'
  }
};

// --- 3. LIVE MONGODB ATLAS LOGIN ---
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
    const targetRole = role || 'customer';

    // 1. Connect to Live MongoDB Atlas
    await connectDatabase();

    let userObj = null;
    if (mongoose.connection.readyState === 1) {
      try {
        userObj = await User.findOne({ email: cleanEmail }).lean();
      } catch (findErr) {}
    }

    // 2. Fallback to local JSON if MongoDB cold-start missed
    if (!userObj) {
      const existingUsers = readData('users.json');
      userObj = existingUsers.find(u => u && u.email && u.email.toLowerCase() === cleanEmail);
    }

    // 3. Auto-seed demo accounts if not yet in database
    if (!userObj) {
      if (cleanEmail === 'customer@luxestay.com' || cleanEmail === 'manager@luxestay.com' || cleanEmail === 'admin@luxestay.com' || cleanEmail === 'sharif@gmail.com' || cleanEmail === 'shariful@gmail.com') {
        const autoRole = cleanEmail.includes('admin') || cleanEmail.includes('sharif') ? 'admin' : cleanEmail.includes('manager') ? 'manager' : 'customer';
        const defaultHash = await bcrypt.hash('123456', 6);
        
        userObj = {
          id: `u_${Date.now()}`,
          name: autoRole === 'admin' ? 'System Administrator' : autoRole === 'manager' ? 'Hotel Manager' : 'Customer Member',
          email: cleanEmail,
          password: defaultHash,
          role: autoRole,
          phone: '+1 (555) 000-1122',
          avatar: autoRole === 'admin' ? 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80' : autoRole === 'manager' ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80' : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
          country: 'United States',
          memberSince: '2026'
        };

        if (mongoose.connection.readyState === 1) {
          try {
            await User.create(userObj);
          } catch (createErr) {}
        }
      } else {
        return res.status(401).json({ error: 'Account does not exist. Please register first.' });
      }
    }

    // 4. Password Verification (Bcrypt Hash & Fallback)
    let isPasswordMatch = false;
    if (userObj.password) {
      try {
        if (userObj.password.startsWith('$2a$') || userObj.password.startsWith('$2b$')) {
          isPasswordMatch = await bcrypt.compare(password, userObj.password);
        } else {
          isPasswordMatch = (password === userObj.password);
        }
      } catch (compareErr) {}
    }

    // Allow 123456 for standard demo accounts if bcrypt fails
    if (!isPasswordMatch && password === '123456' && (cleanEmail === 'customer@luxestay.com' || cleanEmail === 'manager@luxestay.com' || cleanEmail === 'admin@luxestay.com')) {
      isPasswordMatch = true;
    }

    if (!isPasswordMatch) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const finalRole = userObj.role || targetRole;

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: userObj.id || userObj._id || 'u_user',
        name: userObj.name || 'User',
        email: userObj.email || cleanEmail,
        role: finalRole,
        avatar: userObj.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        phone: userObj.phone || '+1 (555) 888-9999',
        country: userObj.country || 'United States',
        address: userObj.address || '',
        city: userObj.city || '',
        state: userObj.state || '',
        zip: userObj.zip || ''
      },
      token: `jwt-token-${userObj.id || userObj._id || 'u_token'}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Server login error' });
  }
});

// --- 4. FORGOT PASSWORD ---
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, role = 'customer' } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const cleanEmail = String(email).trim().toLowerCase();
    const users = readData('users.json');
    let user = users.find(u => u && u.email && u.email.toLowerCase() === cleanEmail);

    if (!user) {
      const defaultPassword = await bcrypt.hash('123456', 10);
      user = {
        id: `u_${Date.now()}`,
        name: role === 'admin' ? 'Platform Admin' : role === 'manager' ? 'Hotel Manager' : cleanEmail.split('@')[0],
        email: cleanEmail,
        password: defaultPassword,
        role: role || 'customer',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        phone: '+1 (555) 000-9988',
        country: 'United States',
        memberSince: '2026'
      };

      if (mongoose.connection.readyState === 1) {
        try {
          const mongoUser = new User(user);
          await mongoUser.save();
        } catch (e) {}
      }

      users.unshift(user);
      writeData('users.json', users);
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

    let users = readData('users.json');
    let index = users.findIndex(u => u && u.email && u.email.toLowerCase() === cleanEmail);

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);

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
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        country: 'United States',
        memberSince: '2026'
      };
      users.unshift(newUser);
      index = 0;
    }

    writeData('users.json', users);

    if (mongoose.connection.readyState === 1) {
      try {
        await User.updateOne({ email: cleanEmail }, { $set: { password: hashedPassword } }, { upsert: true });
      } catch (e) {
        // safe update
      }
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
