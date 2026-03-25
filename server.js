// backend/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const { calculateBestOutcome } = require('./utils/riggingLogic');
// Initialize Express and HTTP server
const app = express();
const server = http.createServer(app);
const { processPayouts } = require('./utils/payoutLogic');
const jwt = require('jsonwebtoken');
const Bet = require('./models/Bet');
const User = require('./models/User');
const BankingRequest = require('./models/BankingRequest');
const Transaction = require('./models/Transaction');

// Middleware
app.use(cors({
    origin: ["http://localhost:5173", "https://casino-frontend-lyart.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));
app.use(express.json()); // Parses incoming JSON requests
app.use((req, res, next) => {
  req.gameState = gameState;
  req.currentRoundId = currentRoundId;
  next();
});

// 2. Import and use your new routes file
const betRoutes = require('./routes/betRoutes');
app.use('/api', betRoutes); // This prefixes all routes in that file with /api

// Setup Socket.io for real-time game state
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://casino-frontend-lyart.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// MongoDB Connection
// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lucky7_game')
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));


// Add this import to the top of server.js alongside the rigging logic
// const { processPayouts } = require('./utils/payoutLogic');

// --- GAME STATE VARIABLES ---
let currentEngineMode = 'FAIR';
let gameState = 'BETTING'; 
let timeLeft = 15; 
let currentRoundId = new mongoose.Types.ObjectId(); 
let currentRollResult = null; // We need this to remember the roll for the payout phase!

// --- ADMIN SETTING ---
let gameMode = 'FAIR'; // Change this to 'RIGGED' to activate the smart algorithm

// Helper for Fair Mode
const generateFairRoll = () => {
  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = Math.floor(Math.random() * 6) + 1;
  return { dice1, dice2, total: dice1 + dice2 };
};

// --- THE GLOBAL GAME LOOP ---
const startGameLoop = () => {
  setInterval(() => {
    timeLeft--;

    if (timeLeft <= 0) {
      if (gameState === 'BETTING') {
        // --- PHASE 1: NO MORE BETS, ROLL THE DICE ---
        gameState = 'ROLLING';
        timeLeft = 3; // Give React 3 seconds to show the dice spinning
        
        (async () => {
          try {
             // 1. Generate the roll (Rigged or Fair)
              if (currentEngineMode === 'RIGGED') {
                currentRollResult = await calculateBestOutcome(currentRoundId);
                console.log('🤖 Rigged logic selected the roll');
            } else {
                currentRollResult = generateFairRoll();
                console.log('🎲 Fair, completely random roll');
            }
             
             // Emit the result so the frontend dice can land!
             io.emit('gameStatus', { status: gameState, timeLeft, result: currentRollResult });
             console.log(`Roll Result: ${currentRollResult.dice1} + ${currentRollResult.dice2} = ${currentRollResult.total}`);
          } catch (error) {
             console.error("Roll Generation Error:", error);
             currentRollResult = generateFairRoll(); 
             io.emit('gameStatus', { status: gameState, timeLeft, result: currentRollResult });
          }
        })();

      } else if (gameState === 'ROLLING') {
        // --- PHASE 2: DICE LANDED, PAY THE WINNERS ---
        gameState = 'RESOLVED';
        timeLeft = 4; // Give React 4 seconds to flash "YOU WON!"
        
        (async () => {
           try {
               // 👇 YOUR ADVANCED PAYOUT LOGIC TRIGGER 👇
               await processPayouts(currentRoundId, currentRollResult);
               console.log('💰 Bets resolved and wallets updated.');
               
               // Tell React that money has been paid
               io.emit('gameStatus', { status: gameState, timeLeft,result: currentRollResult });
           } catch (error) {
               console.error("Payout Error:", error);
           }
        })();

      } else if (gameState === 'RESOLVED') {
        // --- PHASE 3: NEW ROUND ---
        gameState = 'BETTING';
        timeLeft = 15;
        currentRoundId = new mongoose.Types.ObjectId(); 
        currentRollResult = null; 
        
        io.emit('gameStatus', { status: gameState, timeLeft });
        console.log('\n⏱️ New round started. Accepting bets...');
      }
    } else {
      io.emit('timerTick', { status: gameState, timeLeft });
    }
  }, 1000); 
};

startGameLoop();


// The Real-Time Game Engine Pipeline
io.on('connection', (socket) => {
  console.log(`🟢 A player connected: ${socket.id}`);

  // TODO: Add events to listen for bets and broadcast timers

  socket.on('disconnect', () => {
    console.log(`🔴 Player disconnected: ${socket.id}`);
  });
});

// Basic API route to test if the server is alive
app.get('/api/status', (req, res) => {
  res.json({ message: '7 Up 7 Down API is running live!' });
});


// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
// Add these with your other route imports in server.js
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);



// --- THE VIP BOUNCER (JWT MIDDLEWARE) ---
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    // Note: Make sure the secret key matches whatever you used when generating the token!
    // If you are using a .env file, use process.env.JWT_SECRET
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'supersecretcasino'); 
    req.user = verified; // Attaches the user ID to the request
    next(); // Lets them through to the route
  } catch (err) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

app.post('/api/admin/engine-mode', verifyToken, async (req, res) => {
    const { mode } = req.body;
    
    if (mode === 'FAIR' || mode === 'RIGGED') {
        currentEngineMode = mode;
        console.log(`\n🚨 ADMIN OVERRIDE: Game engine is now ${currentEngineMode} 🚨\n`);
        return res.json({ 
          message: `Engine successfully switched to ${currentEngineMode} mode.`, 
          currentMode: currentEngineMode 
        });
    }
    
    res.status(400).json({ error: 'Invalid mode specified.' });
});

// --- GET PLAYER BET HISTORY (WITH X-RAY LOGS) ---
app.get('/api/bet/history', verifyToken, async (req, res) => {
  try {
    // 1. Log the exact token payload to see what's inside
    console.log("\n🔍 [HISTORY API] JWT Payload:", req.user); 
    
    // 2. Catch all possible ID formats
    const userId = req.user.id || req.user.userId || req.user._id; 
    console.log("🔍 [HISTORY API] Searching for bets with userId:", userId);

    const { date } = req.query; 
    let query = { userId: userId }; // Use the caught ID

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const history = await Bet.find(query).sort({ createdAt: -1 }).limit(50);
    
    // 3. Log how many bets it actually found in MongoDB
    console.log(`🔍 [HISTORY API] Found ${history.length} bets in the database.`);
    
    res.json(history);
  } catch (error) {
    console.error("History Error:", error);
    res.status(500).json({ error: "Failed to fetch bet history" });
  }
});
// --- ADMIN: DELETE VIP PLAYER ---
app.delete('/api/admin/player/:username', verifyToken, async (req, res) => {
  try {
    const { username } = req.params;
    
    // Find and delete the user
    const deletedUser = await User.findOneAndDelete({ username: username });
    
    if (!deletedUser) {
      return res.status(404).json({ error: 'Player not found.' });
    }

    console.log(`🚨 ADMIN ACTION: Player ${username} has been permanently deleted.`);
    res.json({ message: `Player ${username} successfully deleted.` });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ error: 'Failed to delete player.' });
  }
});

// ... your existing DELETE route is right above here ...

// --- ADMIN: GET ALL PLAYERS ---
app.get('/api/admin/players', verifyToken, async (req, res) => {
  try {
    // Find all users who are NOT admins. 
    // .select('-password') ensures we don't send passwords to the frontend!
    const players = await User.find({ role: { $ne: 'admin' } })
                              .select('-password')
                              .sort({ createdAt: -1 }); // Newest players first
    res.json(players);
  } catch (error) {
    console.error("Fetch Players Error:", error);
    res.status(500).json({ error: 'Failed to fetch players.' });
  }
});

// --- ADMIN: RESET PLAYER PASSWORD ---
app.put('/api/admin/player/password', verifyToken, async (req, res) => {
  try {
    const { username, newPassword } = req.body;

    // 1. Find the user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'Player not found.' });
    }

    // 2. Update the password 
    // (Note: If you have a pre-save hook in your User model for bcrypt, this will automatically hash it!)
    user.password = newPassword; 
    await user.save();

    console.log(`🚨 ADMIN ACTION: Password reset for ${username}.`);
    res.json({ message: `Password successfully updated for ${username}.` });
  } catch (error) {
    console.error("Password Reset Error:", error);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// --- ADMIN: GET SPECIFIC PLAYER'S BET HISTORY ---
// --- ADMIN: GET SPECIFIC PLAYER'S BET HISTORY ---
app.get('/api/admin/player/:username/history', verifyToken, async (req, res) => {
  try {
    const { username } = req.params;
    const { date } = req.query; // Capture the calendar date!

    const targetUser = await User.findOne({ username });
    if (!targetUser) return res.status(404).json({ error: 'Player not found.' });

    let query = { userId: targetUser._id };

    // Apply the day-wise filter if the admin picked a date
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const history = await Bet.find(query).sort({ createdAt: -1 }).limit(50);
    res.json(history);
  } catch (error) {
    console.error("Admin History Fetch Error:", error);
    res.status(500).json({ error: 'Failed to fetch player history.' });
  }
});

// --- PLAYER: SUBMIT BANKING REQUEST ---
app.post('/api/banking/request', verifyToken, async (req, res) => {
  try {
    const { type, amount, method, upiId } = req.body;
    const userId = req.user.id || req.user._id || req.user.userId;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 🚨 WITHDRAWAL LOGIC: Deduct the money instantly to "hold" it
    if (type === 'WITHDRAWAL') {
      if (user.walletBalance < amount) {
        return res.status(400).json({ error: 'Insufficient funds.' });
      }
      user.walletBalance -= amount;
      await user.save();
      
      // We also log this hold in your existing Transaction ledger!
      const ledgerEntry = new Transaction({
          userId: user._id,
          type: 'WITHDRAWAL',
          amount: -amount,
          balanceAfter: user.walletBalance,
          description: 'Funds held for withdrawal request'
      });
      await ledgerEntry.save();
    }

    // Create the ticket for the Admin Dashboard
    const requestTicket = new BankingRequest({
      userId: user._id,
      username: user.username,
      type, amount, method, upiId
    });
    await requestTicket.save();

    res.json({ message: `${type} request sent to Admin!`, newBalance: user.walletBalance });
  } catch (error) {
    console.error("Banking Request Error:", error);
    res.status(500).json({ error: 'Failed to process request.' });
  }
});

// --- PLAYER: GET MY BANKING TICKETS ---
app.get('/api/banking/my-requests', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id || req.user.userId;
    // Fetch from the ticketing system, not the ledger
    const requests = await BankingRequest.find({ userId }).sort({ createdAt: -1 }).limit(20);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch banking requests.' });
  }
});

// --- ADMIN: GET PENDING BANKING REQUESTS ---
app.get('/api/admin/banking/requests', verifyToken, async (req, res) => {
  try {
    // Fetch only tickets that haven't been processed yet
    const requests = await BankingRequest.find({ status: 'PENDING' }).sort({ createdAt: 1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending requests.' });
  }
});

// --- ADMIN: PROCESS BANKING REQUEST ---
app.post('/api/admin/banking/process', verifyToken, async (req, res) => {
  try {
    const { requestId, action } = req.body; // action will be 'APPROVE' or 'DENY'
    
    const request = await BankingRequest.findById(requestId);
    if (!request) return res.status(404).json({ error: 'Request not found.' });
    if (request.status !== 'PENDING') return res.status(400).json({ error: 'Already processed.' });

    const user = await User.findById(request.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (action === 'APPROVE') {
      request.status = 'APPROVED';
      if (request.type === 'DEPOSIT') {
        user.walletBalance += request.amount;
        await user.save();
        
        // Log the official deposit in the main ledger
        const ledgerEntry = new Transaction({
          userId: user._id, type: 'DEPOSIT', amount: request.amount, balanceAfter: user.walletBalance, description: 'Approved Deposit'
        });
        await ledgerEntry.save();
      }
      // If it's a WITHDRAWAL, we don't need to change the balance because we already deducted it to "hold" it when they submitted the form!
    } 
    else if (action === 'DENY') {
      request.status = 'DENIED';
      if (request.type === 'WITHDRAWAL') {
        // Refund the held money back to the player
        user.walletBalance += request.amount;
        await user.save();
        
        // Log the refund in the main ledger
        const ledgerEntry = new Transaction({
          userId: user._id, type: 'DEPOSIT', amount: request.amount, balanceAfter: user.walletBalance, description: 'Refund: Denied Withdrawal'
        });
        await ledgerEntry.save();
      }
    }

    await request.save();
    res.json({ 
      message: `Request ${action}D successfully.`, 
      userId: user._id, 
      newBalance: user.walletBalance 
    });

  } catch (error) {
    console.error("Process Request Error:", error);
    res.status(500).json({ error: 'Failed to process request.' });
  }
});

// --- ADMIN: GET MASTER PROFIT/LOSS LEDGER ---
app.get('/api/admin/ledger', verifyToken, async (req, res) => {
  try {
    const { date } = req.query;
    let matchStage = {};

    // Apply the calendar filter if the admin selected a date
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    // 1. Calculate Gameplay Profit (Total Wagered vs Total Paid Out)
    const betStats = await Bet.aggregate([
      { $match: matchStage },
      { $group: {
          _id: null,
          totalWagered: { $sum: '$amount' },
          totalPaidOut: { $sum: { $cond: [{ $eq: ['$payoutStatus', 'WON'] }, '$payoutAmount', 0] } }
        }
      }
    ]);

    // 2. Calculate Cash Flow (Total Deposits vs Total Withdrawals)
    const bankingStats = await Transaction.aggregate([
      { $match: { ...matchStage, type: { $in: ['DEPOSIT', 'WITHDRAWAL'] } } },
      { $group: {
          _id: '$type',
          total: { $sum: { $abs: '$amount' } } 
        }
      }
    ]);

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    bankingStats.forEach(stat => {
      if (stat._id === 'DEPOSIT') totalDeposits = stat.total;
      if (stat._id === 'WITHDRAWAL') totalWithdrawals = stat.total;
    });

    const stats = betStats[0] || { totalWagered: 0, totalPaidOut: 0 };
    const houseProfit = stats.totalWagered - stats.totalPaidOut;

    // 3. Fetch the raw ledger entries for the timeline
    const recentTransactions = await Transaction.find(matchStage).sort({ createdAt: -1 }).limit(50);

    res.json({
      houseProfit,
      totalWagered: stats.totalWagered,
      totalPaidOut: stats.totalPaidOut,
      totalDeposits,
      totalWithdrawals,
      transactions: recentTransactions
    });
  } catch (error) {
    console.error("Ledger Error:", error);
    res.status(500).json({ error: 'Failed to fetch master ledger.' });
  }
});
// 🚨 TEMPORARY SETUP ROUTE: Delete this after you log in! 🚨
app.get('/api/setup-admin', async (req, res) => {
  try {
    const adminExists = await User.findOne({ username: 'CasinoBoss' });
    if (adminExists) {
      return res.send('Boss already exists! Go log in.');
    }

    // This creates the user and runs it through your normal security/encryption
    const newAdmin = new User({
      username: 'CasinoBoss',
      password: 'BossPassword99', 
      role: 'admin',
      walletBalance: 5000000
    });
    
    await newAdmin.save();
    res.send('✅ SUCCESS! Master account created. Username: CasinoBoss | Password: BossPassword99');
  } catch (error) {
    res.send(`❌ Error: ${error.message}`);
  }
});