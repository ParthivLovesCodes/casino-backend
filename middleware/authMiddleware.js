// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 1. Protect: Checks if the user is logged in at all
const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header (looks like "Bearer eyJhbGci...")
      token = req.headers.authorization.split(' ')[1];
      
      // Verify token using the secret in your .env file
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Fetch the user from the DB and attach it to the request (minus the password)
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      res.status(401).json({ error: 'Not authorized, invalid token' });
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Not authorized, no token provided' });
  }
};

// 2. Admin Only: Checks if the logged-in user has the 'admin' role
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Admins only.' });
  }
};

module.exports = { protect, adminOnly };