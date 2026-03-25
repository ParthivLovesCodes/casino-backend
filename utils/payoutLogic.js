// backend/utils/payoutLogic.js
const Bet = require('../models/Bet');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// 📊 THE PERFECTLY BALANCED CASINO MULTIPLIERS 📊
const MULTIPLIERS = {
  // Standard Bets
  'DOWN': 2,        // Pays 1:1
  'UP': 2,          // Pays 1:1
  'LUCKY_7': 5,     // Pays 4:1

  // Exact Number Bets (Symmetrically Balanced for House Edge)
  'NUM_2': 26,  'NUM_12': 26,  // 1 in 36 chance
  'NUM_3': 12,  'NUM_11': 12,  // 2 in 36 chance
  'NUM_4': 8,   'NUM_10': 8,   // 3 in 36 chance
  'NUM_5': 6,   'NUM_9': 6,    // 4 in 36 chance
  'NUM_6': 4.5, 'NUM_8': 4.5   // 5 in 36 chance
};

const processPayouts = async (roundId, rollResult) => {
  // 1. Find all pending bets for this round
  const bets = await Bet.find({ roundId, payoutStatus: 'PENDING' });
  const { total } = rollResult; // e.g., total = 10

  // 2. Loop through every bet and check if it matches the dice total
  for (let bet of bets) {
    let won = false;

    // Determine if the bet was a winner
    if (bet.betTarget === 'DOWN' && total < 7) won = true;
    else if (bet.betTarget === 'UP' && total > 7) won = true;
    else if (bet.betTarget === 'LUCKY_7' && total === 7) won = true;
    else if (bet.betTarget === `NUM_${total}`) won = true; // e.g., 'NUM_10' matches roll 10

    // 3. Update the bet status and user wallet
    if (won) {
      // Calculate winnings using the secure multiplier table
      const winnings = bet.amount * (MULTIPLIERS[bet.betTarget] || 2);
      
      bet.payoutStatus = 'WON';
      bet.payoutAmount = winnings;
      
      const updatedUser = await User.findByIdAndUpdate(
        bet.userId, 
        { $inc: { walletBalance: winnings, totalWon: winnings } },
        { new: true } // Returns the updated balance for the ledger
      );
      
      // Create the Ledger Receipt for the House P/L and Player History
      const newTransaction = new Transaction({
        userId: bet.userId,
        type: 'BET_WON',
        amount: winnings,
        balanceAfter: updatedUser.walletBalance,
        description: `Won ₹${winnings} on ${bet.betTarget.replace('_', ' ')} (Rolled ${total})`
      });
      await newTransaction.save();
      
    } else {
      bet.payoutStatus = 'LOST';
      bet.payoutAmount = 0;
      // Note: We don't need a Transaction entry for a LOST bet because the 
      // money was already deducted from their wallet when they PLACED the bet!
    }
    
    // Save the updated bet document
    await bet.save();
  }
};

module.exports = { processPayouts };