// backend/models/BankingRequest.js
const mongoose = require('mongoose');

const bankingRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  type: { type: String, enum: ['DEPOSIT', 'WITHDRAWAL'], required: true },
  amount: { type: Number, required: true },
  method: { type: String, required: true },
  upiId: { type: String }, // For withdrawals
  status: { type: String, enum: ['PENDING', 'APPROVED', 'DENIED'], default: 'PENDING' }
}, { timestamps: true });

module.exports = mongoose.model('BankingRequest', bankingRequestSchema);