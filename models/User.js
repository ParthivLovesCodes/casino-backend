const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'player'], default: 'player' },
  walletBalance: { type: Number, default: 0 }, // Matches your betRoutes.js
  totalWagered: { type: Number, default: 0 },  // Matches your betRoutes.js
  totalWon: { type: Number, default: 0 },      // Matches your payoutLogic.js
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null } // Links to Admin
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);