const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
  status: { 
    type: String, 
    enum: ['BETTING', 'ROLLING', 'RESOLVED'], 
    default: 'BETTING' 
  },
  dice1: { type: Number, default: null },
  dice2: { type: Number, default: null },
  total: { type: Number, default: null },
  // We store the calculated house profit for analytics
  houseProfit: { type: Number, default: 0 } 
}, { timestamps: true });

module.exports = mongoose.model('Round', roundSchema);