// backend/utils/riggingLogic.js
const Bet = require('../models/Bet');

// Multipliers based on your reference image (adjust these as needed)
const MULTIPLIERS = {
  'DOWN': 2,        // Pays 1:1 (so return is 2x)
  'UP': 2,          // Pays 1:1
  'LUCKY_7': 5,     // Usually pays 1:4 or 1:5
  'NUM_2': 26, 'NUM_3': 12, 'NUM_4': 6, 'NUM_5': 6, 'NUM_6': 5,
  'NUM_8': 5, 'NUM_9': 6, 'NUM_10': 16, 'NUM_11': 12, 'NUM_12': 26
};

const calculateBestOutcome = async (roundId) => {
  // 1. Fetch all bets placed in the current round
  const bets = await Bet.find({ roundId });

  // 2. Setup an object to track how much the house owes for each possible dice total
  const houseLiability = {
    2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0
  };

  // 3. Calculate the payout for every bet and add it to the respective dice totals
  bets.forEach(bet => {
    const payout = bet.amount * (MULTIPLIERS[bet.betTarget] || 2);

    if (bet.betTarget === 'DOWN') {
      for (let i = 2; i <= 6; i++) houseLiability[i] += payout;
    } else if (bet.betTarget === 'UP') {
      for (let i = 8; i <= 12; i++) houseLiability[i] += payout;
    } else if (bet.betTarget === 'LUCKY_7') {
      houseLiability[7] += payout;
    } else if (bet.betTarget.startsWith('NUM_')) {
      const num = parseInt(bet.betTarget.split('_')[1]);
      houseLiability[num] += payout;
    }
  });

  // 4. Find the dice total(s) that result in the LOWEST payout for the house
  let minPayout = Infinity;
  let bestTotals = [];

  for (const [total, payout] of Object.entries(houseLiability)) {
    if (payout < minPayout) {
      minPayout = payout;
      bestTotals = [parseInt(total)];
    } else if (payout === minPayout) {
      bestTotals.push(parseInt(total)); // If multiple totals tie for lowest payout
    }
  }

  // 5. Pick one of the best totals randomly (to keep it unpredictable if there are ties)
  const targetTotal = bestTotals[Math.floor(Math.random() * bestTotals.length)];

  // 6. Generate the exact dice faces to equal that target total
  return generateDiceFaces(targetTotal);
};

// Helper function to find a valid dice combination for a specific total
const generateDiceFaces = (targetTotal) => {
  const possiblePairs = [];
  for (let i = 1; i <= 6; i++) {
    for (let j = 1; j <= 6; j++) {
      if (i + j === targetTotal) {
        possiblePairs.push({ dice1: i, dice2: j, total: targetTotal });
      }
    }
  }
  console.log("\n💰 --- HOUSE LIABILITY REPORT --- 💰");
  console.table(houseLiability);
  console.log(`🎯 The House chose total: ${targetTotal} to minimize payouts.`);
  console.log("-----------------------------------\n");
  // Return a random valid pair
  return possiblePairs[Math.floor(Math.random() * possiblePairs.length)];
};

module.exports = { calculateBestOutcome };