const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  roundId: { type: mongoose.Schema.Types.ObjectId, required: true },
  betTarget: { type: String, required: true },
  amount: { type: Number, required: true }, // Matches your code
  payoutStatus: { type: String, enum: ['PENDING', 'WON', 'LOST'], default: 'PENDING' }, // Matches your code
  payoutAmount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Bet', betSchema);