// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Helper function to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

// --- 1. SETUP MASTER ADMIN (Run this ONCE to create your first admin) ---
// POST /api/auth/setup-admin
router.post('/setup-admin', async (req, res) => {
  const adminExists = await User.findOne({ role: 'admin' });
  if (adminExists) return res.status(400).json({ error: 'An admin already exists!' });
  
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('admin123', salt); // Default password
  
  const admin = await User.create({
    username: 'masteradmin',
    password: hashedPassword,
    role: 'admin'
  });
  
  res.status(201).json({ message: 'Master Admin created! Login with username: masteradmin, password: admin123' });
});

// --- 2. LOGIN (For both Players and Admins) ---
// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    // Check if user exists AND password matches the hash
    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user._id,
        username: user.username,
        role: user.role,
        walletBalance: user.walletBalance,
        token: generateToken(user._id) // Give them their ID badge!
      });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (error) {
    console.error('🚨 REAL LOGIN CRASH REASON:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// --- 3. CREATE PLAYER (Admins Only) ---
// POST /api/auth/create-player
router.post('/create-player', protect, adminOnly, async (req, res) => {
  try {
    const { username, password } = req.body;

    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).json({ error: 'Username is already taken' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const player = await User.create({
      username,
      password: hashedPassword,
      role: 'player',
      createdBy: req.user._id // Records WHICH admin made this account
    });

    res.status(201).json({ message: `Player ${player.username} created successfully!` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create player' });
  }
});

// --- 4. VERIFY SESSION (AUTO-LOGIN) ---
// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  try {
    // Your 'protect' middleware already verified the token and attached the user!
    // We just need to fetch their latest wallet balance and info (hiding the password)
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    // Send the fresh user data back to React so it can skip the login screen
    res.json(user);
  } catch (error) {
    console.error("Auto-login error:", error);
    res.status(500).json({ error: 'Failed to verify session.' });
  }
});

module.exports = router;