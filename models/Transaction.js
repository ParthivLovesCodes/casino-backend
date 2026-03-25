const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['DEPOSIT', 'WITHDRAWAL', 'BET_PLACED', 'BET_WON'], required: true },
  amount: { type: Number, required: true }, // Negative for bets/withdrawals, Positive for wins/deposits
  balanceAfter: { type: Number, required: true },
  description: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);