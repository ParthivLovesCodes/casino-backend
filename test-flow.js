// test-flow.js
const API_URL = 'http://localhost:5000/api';

async function runTest() {
  console.log('🎰 STARTING CASINO SERVER TEST...\n');

  try {
    // --- 1. SETUP & LOGIN ADMIN ---
    console.log('1️⃣ Setting up Master Admin...');
    await fetch(`${API_URL}/auth/setup-admin`, { method: 'POST' });

    console.log('2️⃣ Logging in as Admin...');
    const adminLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'masteradmin', password: 'admin123' })
    });
    const adminData = await adminLoginRes.json();
    if (!adminLoginRes.ok) throw new Error(`Admin Login Failed: ${adminData.error}`);
    const adminToken = adminData.token;
    console.log(`✅ Admin Token Received!\n`);


    // --- 2. CREATE PLAYER & DEPOSIT ---
    const testUsername = `player_${Math.floor(Math.random() * 10000)}`;
    console.log(`3️⃣ Admin creating new player: ${testUsername}...`);
    const createRes = await fetch(`${API_URL}/auth/create-player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ username: testUsername, password: 'password123' })
    });
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(`Player Creation Failed: ${createData.error}`);
    console.log(`✅ Player Created!\n`);

    console.log(`4️⃣ Admin depositing 1,000 chips...`);
    const depositRes = await fetch(`${API_URL}/admin/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ targetUsername: testUsername, amount: 1000 })
    });
    const depositData = await depositRes.json();
    if (!depositRes.ok) throw new Error(`Deposit Failed: ${depositData.error}`);
    console.log(`✅ Deposit Success! New Balance: ${depositData.newBalance}\n`);


    // --- 3. PLAYER LOGIN & BETTING ---
    console.log(`5️⃣ Logging in as Player (${testUsername})...`);
    const playerLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUsername, password: 'password123' })
    });
    const playerData = await playerLoginRes.json();
    if (!playerLoginRes.ok) throw new Error(`Player Login Failed: ${playerData.error}`);
    const playerToken = playerData.token;
    console.log(`✅ Player Token Received!\n`);

    console.log(`6️⃣ Player placing bet...`);
    const betRes = await fetch(`${API_URL}/bet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${playerToken}` },
      body: JSON.stringify({ betTarget: 'LUCKY_7', amount: 200 })
    });
    const betData = await betRes.json();
    if (!betRes.ok) throw new Error(`Bet Failed: ${betData.error}`);
    console.log(`✅ Bet Placed Successfully! Remaining Balance: ${betData.newBalance}`);

    console.log('\n🎉 TEST SEQUENCE COMPLETE!');

  } catch (error) {
    console.error('\n❌ TEST STOPPED:', error.message);
  }
}

runTest();