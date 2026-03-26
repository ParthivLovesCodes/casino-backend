// backend/routes/betRoutes.js
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Bet = require('../models/Bet');
const Round = require('../models/Round');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/authMiddleware');
router.post('/bet', protect, async (req, res) => {
  try {
    const { betTarget, amount } = req.body;
    const userId = req.user._id; 
    const { gameState, currentRoundId } = req;

    // 1. Check if the game is currently accepting bets
    if (gameState !== 'BETTING') {
      return res.status(400).json({ error: 'Bets are closed for this round!' });
    }

    // 2. Find the user and check their balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.walletBalance < amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    // 3. Deduct the money from the user's wallet
    user.walletBalance -= amount;
    user.totalWagered += amount;
    await user.save();

    // 4. Create the official Bet record
    const newBet = new Bet({
      userId: user._id,
      roundId: currentRoundId, 
      betTarget,
      amount
    });
    await newBet.save();

    // 5. Create the Ledger Receipt
    const newTransaction = new Transaction({
      userId: user._id,
      type: 'BET_PLACED',
      amount: -amount,
      balanceAfter: user.walletBalance,
      description: `Placed bet of ${amount} on ${betTarget}`
    });
    await newTransaction.save();

    // 6. Success! 
    res.json({ 
      message: 'Bet placed successfully', 
      newBalance: user.walletBalance,
      bet: newBet
    });

  } catch (error) {
    console.error('Betting Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.post('/bet/bulk', protect, async (req, res) => {
  try {
    const { bets } = req.body;
    const userId = req.user._id; 
    const { gameState, currentRoundId } = req;

    // 1. Check timer
    if (gameState !== 'BETTING') {
      return res.status(400).json({ error: 'Bets are closed for this round!' });
    }

    // 2. Calculate the total cost of all chips
    const totalCost = Object.values(bets).reduce((sum, amount) => sum + amount, 0);

    // 3. Find the user and verify funds
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.walletBalance < totalCost) {
      return res.status(400).json({ error: 'Insufficient funds for bulk bet' });
    }

    // 4. Deduct the massive lump sum ONCE safely
    user.walletBalance -= totalCost;
    user.totalWagered += totalCost;
    await user.save();

    // 5. Create the individual Bet tickets for the rigging engine to read
    const betTickets = Object.entries(bets).map(([target, amount]) => ({
      userId: user._id,
      roundId: currentRoundId,
      betTarget: target,
      amount: amount
    }));
    await Bet.insertMany(betTickets);

    // 6. Create ONE single ledger receipt for the whole batch
    const newTransaction = new Transaction({
      userId: user._id,
      type: 'BET_PLACED',
      amount: -totalCost,
      balanceAfter: user.walletBalance,
      description: `Placed bulk bets totaling ${totalCost}`
    });
    await newTransaction.save();

    res.json({ 
      message: 'Bulk bets placed successfully', 
      newBalance: user.walletBalance 
    });

  } catch (error) {
    console.error('Bulk Betting Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.delete('/bet/clear', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { gameState, currentRoundId } = req;

    // 1. Safety Check: Can only clear while the timer is still ticking!
    if (gameState !== 'BETTING') {
      return res.status(400).json({ error: 'Too late! Bets are locked for this round.' });
    }

    // 2. Find all bets placed by this user in the CURRENT round
    const activeBets = await Bet.find({ userId, roundId: currentRoundId });

    if (activeBets.length === 0) {
      return res.status(400).json({ error: 'No active bets to clear.' });
    }

    // 3. Calculate the exact total refund amount
    const totalRefund = activeBets.reduce((sum, bet) => sum + bet.amount, 0);

    // 4. Destroy the bet tickets in the database
    await Bet.deleteMany({ userId, roundId: currentRoundId });

    // 5. Refund the user's wallet safely
    const user = await User.findById(userId);
    user.walletBalance += totalRefund;
    user.totalWagered -= totalRefund; // Revert their wagered stats
    await user.save();

    // 6. Log the refund in the main transaction ledger
    const newTransaction = new Transaction({
      userId: user._id,
      type: 'DEPOSIT',
      amount: totalRefund,
      balanceAfter: user.walletBalance,
      description: `Cleared bets for current round`
    });
    await newTransaction.save();

    res.json({
      message: 'Bets cleared and fully refunded!',
      newBalance: user.walletBalance
    });

  } catch (error) {
    console.error('Clear Bets Error:', error);
    res.status(500).json({ error: 'Failed to clear bets.' });
  }
});
module.exports = router;