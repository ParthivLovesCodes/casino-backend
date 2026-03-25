// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// --- 1. DEPOSIT MONEY (Admin Only) ---
// POST /api/admin/deposit
router.post('/deposit', protect, adminOnly, async (req, res) => {
  try {
    const { targetUsername, amount } = req.body;

    // 1. Find the player
    const player = await User.findOne({ username: targetUsername });
    if (!player) {
      return res.status(404).json({ error: 'Player not found in the system' });
    }

    // 2. Add the money to their wallet
    player.walletBalance += amount;
    await player.save();

    // 3. Create the Ledger Receipt
    const newTransaction = new Transaction({
      userId: player._id,
      type: 'DEPOSIT',
      amount: amount, // Positive because it's adding money
      balanceAfter: player.walletBalance,
      description: `Admin deposited ${amount} chips`
    });
    await newTransaction.save();

    res.json({ 
      message: `Successfully deposited ${amount} to ${player.username}`,
      newBalance: player.walletBalance
    });

  } catch (error) {
    console.error('Deposit Error:', error);
    res.status(500).json({ error: 'Failed to process deposit' });
  }
});

// --- 2. WITHDRAW MONEY (Admin Only) ---
// POST /api/admin/withdraw
router.post('/withdraw', protect, adminOnly, async (req, res) => {
  try {
    const { targetUsername, amount } = req.body;

    // 1. Find the player
    const player = await User.findOne({ username: targetUsername });
    if (!player) {
      return res.status(404).json({ error: 'Player not found in the system' });
    }

    // 2. Check if they actually have enough money to withdraw
    if (player.walletBalance < amount) {
      return res.status(400).json({ 
        error: `Insufficient funds. ${player.username} only has ${player.walletBalance} chips.` 
      });
    }

    // 3. Remove the money from their wallet
    player.walletBalance -= amount;
    await player.save();

    // 4. Create the Ledger Receipt
    const newTransaction = new Transaction({
      userId: player._id,
      type: 'WITHDRAWAL',
      amount: -amount, // Negative because it's removing money
      balanceAfter: player.walletBalance,
      description: `Admin withdrew ${amount} chips`
    });
    await newTransaction.save();

    res.json({ 
      message: `Successfully withdrew ${amount} from ${player.username}`,
      newBalance: player.walletBalance
    });

  } catch (error) {
    console.error('Withdrawal Error:', error);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

// --- 3. GET PLAYER LEDGER (Admin Only) ---
// GET /api/admin/ledger/:username
router.get('/ledger/:username', protect, adminOnly, async (req, res) => {
  try {
    const player = await User.findOne({ username: req.params.username });
    if (!player) return res.status(404).json({ error: 'Player not found' });

    // Fetch all transactions for this specific user, sorted by newest first
    const history = await Transaction.find({ userId: player._id }).sort({ createdAt: -1 });
    
    res.json({
      player: player.username,
      currentBalance: player.walletBalance,
      totalWagered: player.totalWagered,
      totalWon: player.totalWon,
      history: history
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ledger' });
  }
});

module.exports = router;