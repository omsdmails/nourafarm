require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// إعداد قاعدة البيانات
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ميدلوير
app.use(cors());
app.use(express.json());

// دالة مساعدة للتحقق من JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// ==================== Auth Endpoints ====================
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id', [username, hashed]);
    const userId = result.rows[0].id;
    // إنشاء سجل للاعب
    await pool.query('INSERT INTO players (user_id, gold, inventory) VALUES ($1, $2, $3)', [userId, 50, { Wheat: 3, Carrot: 2 }]);
    const token = jwt.sign({ id: userId, username }, process.env.JWT_SECRET);
    res.json({ token, username, userId });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Username already exists' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET);
    res.json({ token, username: user.username, userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== Player Data ====================
app.get('/api/user/data', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT gold, score, inventory, fields, animals, game_data FROM players WHERE user_id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== Farm Endpoints ====================
app.post('/api/farm/plant', authenticateToken, async (req, res) => {
  const { fieldIndex, cropKey, buyPrice } = req.body;
  if (fieldIndex === undefined || !cropKey) return res.status(400).json({ error: 'Missing data' });
  try {
    // بدء المعاملة
    await pool.query('BEGIN');
    const playerRes = await pool.query('SELECT gold, fields FROM players WHERE user_id = $1 FOR UPDATE', [req.user.id]);
    const player = playerRes.rows[0];
    if (!player) return res.status(404).json({ error: 'Player not found' });
    const fields = player.fields;
    if (fields[fieldIndex] !== null) throw new Error('Field occupied');
    if (player.gold < buyPrice) throw new Error('Not enough gold');
    const newGold = player.gold - buyPrice;
    fields[fieldIndex] = { crop: cropKey, plantedAt: Date.now() };
    await pool.query('UPDATE players SET gold = $1, fields = $2 WHERE user_id = $3', [newGold, fields, req.user.id]);
    await pool.query('COMMIT');
    res.json({ success: true, gold: newGold, fields });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/farm/harvest', authenticateToken, async (req, res) => {
  const { fieldIndex, crop, sellPrice } = req.body;
  if (fieldIndex === undefined) return res.status(400).json({ error: 'Missing field index' });
  try {
    await pool.query('BEGIN');
    const playerRes = await pool.query('SELECT gold, score, inventory, fields FROM players WHERE user_id = $1 FOR UPDATE', [req.user.id]);
    const player = playerRes.rows[0];
    const fields = player.fields;
    const field = fields[fieldIndex];
    if (!field || field.crop !== crop) throw new Error('No crop to harvest');
    const elapsed = (Date.now() - field.plantedAt) / 1000;
    const growTime = { Wheat: 5, Carrot: 4, Potato: 6, Tomato: 7, Corn: 8, Pepper: 9, Strawberry: 10, Watermelon: 12 }[crop];
    if (elapsed < growTime) throw new Error('Crop not ready');
    const newGold = player.gold + sellPrice;
    const newScore = player.score + 1;
    let inventory = player.inventory;
    if (!inventory[crop]) inventory[crop] = 0;
    inventory[crop]++;
    fields[fieldIndex] = null;
    await pool.query('UPDATE players SET gold = $1, score = $2, inventory = $3, fields = $4 WHERE user_id = $5', [newGold, newScore, inventory, fields, req.user.id]);
    await pool.query('COMMIT');
    res.json({ success: true, gold: newGold, score: newScore, inventory, fields });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  }
});

// ==================== Market Listings ====================
app.post('/api/market/create', authenticateToken, async (req, res) => {
  const { item, quantity, pricePerUnit } = req.body;
  if (!item || !quantity || !pricePerUnit) return res.status(400).json({ error: 'Missing data' });
  try {
    await pool.query('BEGIN');
    const playerRes = await pool.query('SELECT inventory FROM players WHERE user_id = $1 FOR UPDATE', [req.user.id]);
    let inventory = playerRes.rows[0].inventory;
    if (!inventory[item] || inventory[item] < quantity) throw new Error('Not enough items');
    inventory[item] -= quantity;
    await pool.query('UPDATE players SET inventory = $1 WHERE user_id = $2', [inventory, req.user.id]);
    await pool.query('INSERT INTO market_listings (seller_id, item_name, quantity, price_per_unit) VALUES ($1, $2, $3, $4)', [req.user.id, item, quantity, pricePerUnit]);
    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/market/listings', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.id, l.seller_id, u.username as seller_name, l.item_name, l.quantity, l.price_per_unit, l.listed_at
       FROM market_listings l
       JOIN users u ON l.seller_id = u.id
       WHERE l.status = 'active'
       ORDER BY l.listed_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.post('/api/market/buy', authenticateToken, async (req, res) => {
  const { listingId, quantity, pricePerUnit, itemName, sellerId } = req.body;
  if (!listingId) return res.status(400).json({ error: 'Missing listing id' });
  try {
    await pool.query('BEGIN');
    // 1. الحصول على بيانات المشتري
    const buyerRes = await pool.query('SELECT gold, inventory FROM players WHERE user_id = $1 FOR UPDATE', [req.user.id]);
    const buyer = buyerRes.rows[0];
    const totalCost = quantity * pricePerUnit;
    if (buyer.gold < totalCost) throw new Error('Not enough gold');
    // 2. تحديث البائع
    const sellerRes = await pool.query('SELECT gold FROM players WHERE user_id = $1 FOR UPDATE', [sellerId]);
    const sellerGold = sellerRes.rows[0].gold;
    await pool.query('UPDATE players SET gold = $1 WHERE user_id = $2', [sellerGold + totalCost, sellerId]);
    // 3. تحديث المشتري
    const newGold = buyer.gold - totalCost;
    let buyerInventory = buyer.inventory;
    if (!buyerInventory[itemName]) buyerInventory[itemName] = 0;
    buyerInventory[itemName] += quantity;
    await pool.query('UPDATE players SET gold = $1, inventory = $2 WHERE user_id = $3', [newGold, buyerInventory, req.user.id]);
    // 4. حذف الإعلان (أو تحديث الحالة)
    await pool.query('UPDATE market_listings SET status = $1 WHERE id = $2', ['sold', listingId]);
    await pool.query('COMMIT');
    res.json({ success: true, gold: newGold, inventory: buyerInventory });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  }
});

// إضافة باقي الـ endpoints: تحويل الأموال، النقل، المصنع، إلخ (نفس المبدأ).

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
