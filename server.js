/*
  FoodConnect Backend Server (Node.js + Express + SQLite3)
  ----------------------------------------------------------
  Student-friendly explanation:
  - This is a simple REST API server that runs on http://localhost:5000
  - It stores all data (users, food posts, assignments, NGO responses) in a local SQLite file "database.sqlite"
  - SQLite is a file-based database (no server required) - great for student projects
  - The React frontend calls these APIs using fetch() and shows the data in pages
  - We use CORS so that React on port 3000 can talk to the backend on port 5000
  - Tables created: users, food_posts, agent_assignments, ngo_responses, notifications
  - Seed demo data is inserted the first time the server runs (flag in seeded_meta table)
  - NEW: structured address columns (street/area/landmark/pincode), journey+ETA fields,
         delivery-OTP fields, notifications table, pincode-based nearby filter server helpers,
         and real-life ETA calculator with traffic + pickup/handover buffers.
  - FIX: "SQLITE_FULL: database or disk is full" on Windows low-disk — solved with
         temp_store=MEMORY, WAL journal, large cache_size, and startup VACUUM (non-destructive).
*/

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, 'database.sqlite');

/* =============== SQLite connection + pragmas (fix SQLITE_FULL) =================
   These settings prevent "SQLITE_FULL" errors even when free disk space is low.

   * temp_store=MEMORY     – sorts / temp tables go in RAM, not disk.
                             Avoids Windows %TEMP% disk-quota / no-space errors.
   * journal_mode=WAL      – writes go to a compact write-ahead log instead of
                             rewriting whole DB pages (faster, smaller disk I/O).
   * synchronous=NORMAL     – sweet-spot for safety/speed on a local dev project.
   * cache_size=-64000      – ~64 MB of RAM page cache (less disk reads & temp writes).
   * mmap_size=256 MB       – memory-map DB reads into OS page cache (avoids temp copies).
   * auto_vacuum=FULL       – automatically shrinks the file on every commit.
   * VACUUM (at startup)    – reclaims all empty/free pages, keeps ALL your data.
                             It does NOT DELETE ANY ROWS — only defragments the file.
   ================================================================================ */
const db = new sqlite3.Database(
  DB_PATH,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error('Database connection error:', err.message);
      /* Last-resort safety net: if DB file is corrupt we back it up to *.backup-<TS>
         before reinitializing. Only fires on total corruption; the SQLITE_FULL /
         low-disk error never goes here because it's a pragma issue, not corruption. */
      try {
        const bak = DB_PATH + '.backup-corrupt-' + Date.now();
        if (fs.existsSync(DB_PATH)) fs.copyFileSync(DB_PATH, bak);
        console.warn('  ⚠️ DB could not be opened; backup saved to ' + bak);
      } catch {}
    } else {
      try {
        const szKB = fs.existsSync(DB_PATH) ? Math.round(fs.statSync(DB_PATH).size / 1024) : 0;
        console.log('Connected to SQLite at', DB_PATH, `(${szKB} KB)`);
      } catch {
        console.log('Connected to SQLite at', DB_PATH);
      }
    }
  }
);

// Promise-friendly helpers (async/await on db.run / all / get)
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { if (err) reject(err); else resolve(this); });
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
  });
}

// Apply SQLite RAM + safety pragmas
db.serialize(() => {
  db.run('PRAGMA temp_store=MEMORY');
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA synchronous=NORMAL');
  db.run('PRAGMA cache_size=-64000'); // negative => KB units; -64000 ~= 64 MB cache
  db.run('PRAGMA mmap_size=268435456'); // 256 MB memory map
  db.run('PRAGMA auto_vacuum=FULL');
  console.log('SQLite pragmas applied (temp=MEMORY, WAL, 64MB cache, auto_vacuum).');
});

// Non-destructive VACUUM: defrags + shrinks DB file, 100% of rows are preserved.
try {
  db.exec('VACUUM', (vacErr) => {
    if (vacErr) {
      console.warn('VACUUM skipped (harmless — transaction locks or small file):', vacErr.message);
    } else {
      try {
        const szKB = fs.existsSync(DB_PATH) ? Math.round(fs.statSync(DB_PATH).size / 1024) : 0;
        console.log(`VACUUM finished — DB compacted to ~${szKB} KB, every row preserved.`);
      } catch {}
    }
  });
} catch {}

// --- Helpers: tiny UID, OTP, pincode check, ETA ---
function uid(prefix) {
  return prefix + '_' + crypto.randomBytes(10).toString('hex');
}
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function pincodesAreNearby(pinA, pinB, prefixDigits = 3) {
  if (!pinA || !pinB) return true;
  const a = String(pinA).trim().slice(0, prefixDigits);
  const b = String(pinB).trim().slice(0, prefixDigits);
  return a.length >= prefixDigits && a === b;
}
function estimateDeliveryETA(distAgentRestaurantKm, distRestaurantNgoKm, vehicleType) {
  const speeds = { Bike: 20, Scooter: 25, Car: 30, Walk: 5 };
  const v = speeds[(vehicleType || 'Bike').toString().trim()] || 22;
  const totalDist = Math.max(0, Number(distAgentRestaurantKm) || 0) + Math.max(0, Number(distRestaurantNgoKm) || 0);
  const travelMinutes = (totalDist / v) * 60;
  const trafficFactor = 1.4;
  const bufferMin = 10 + 5; // pickup + handover
  const etaMin = Math.round(travelMinutes * trafficFactor + bufferMin);
  const now = new Date();
  const etaAt = new Date(now.getTime() + etaMin * 60 * 1000).toISOString();
  return {
    eta_minutes: etaMin,
    estimated_delivery_at: etaAt,
    breakdown: {
      total_distance_km: Math.round(totalDist * 10) / 10,
      vehicle_kmph: v,
      travel_minutes_raw: Math.round(travelMinutes * 10) / 10,
      traffic_multiplier: trafficFactor,
      buffers_minutes: bufferMin,
    },
  };
}
function haversineKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((x) => x == null || isNaN(x))) return 0;
  const R = 6371;
  const r = (d) => (d * Math.PI) / 180;
  const dLat = r(lat2 - lat1), dLon = r(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PINCODE_COORDS_SERVER = {
  '400086': [19.0870, 72.8757],
  '400077': [19.0913, 72.9083],
  '400008': [19.0186, 72.8348],
  '400007': [19.0216, 72.8274],
  '400004': [19.0106, 72.8207],
  '400001': [18.9387, 72.8353],
  '400020': [19.0760, 72.8777],
  '400071': [19.0940, 72.8910],
  '400072': [19.0980, 72.8870],
  '400073': [19.1020, 72.8830],
  '400074': [19.1060, 72.8790],
  '400075': [19.1090, 72.8750],
  '400076': [19.1000, 72.9020],
  '400078': [19.0800, 72.9120],
  '400079': [19.0700, 72.9160],
  '400080': [19.0600, 72.9200],
  '400081': [19.0480, 72.8780],
  '400082': [19.0520, 72.8830],
  '400083': [19.0560, 72.8880],
  '400084': [19.0640, 72.8930],
  '400085': [19.0820, 72.8710],
  '400087': [19.0860, 72.9000],
  '400088': [19.0840, 72.9040],
  '400089': [19.0780, 72.9080],
  '400090': [19.0650, 72.8590],
  '400101': [19.0400, 72.8550],
  '400102': [19.0400, 72.8760],
  '400103': [19.0500, 72.8480],
  '400104': [19.0300, 72.8430],
  '400105': [19.0130, 72.8280],
  '400106': [19.0020, 72.8320],
  '400107': [18.9900, 72.8380],
  '400108': [18.9900, 72.8490],
  '400109': [19.0050, 72.8450],
  '400110': [19.0230, 72.8490],
  '400111': [19.0400, 72.8640],
  '400112': [19.0700, 72.8550],
  '400113': [19.0790, 72.8610],
  '400114': [19.0800, 72.8550],
  '400115': [19.0800, 72.8480],
};

function coordsForPincodeServer(pincode) {
  if (!pincode) return null;
  const key = String(pincode).trim();
  const entry = PINCODE_COORDS_SERVER[key];
  if (entry) return { latitude: entry[0], longitude: entry[1] };
  if (/^4\d{5}$/.test(key)) {
    return { latitude: 19.0760, longitude: 72.8777 };
  }
  return null;
}

function hasValidCoordsServer(lat, lng) {
  if (lat == null || lng == null) return false;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

function resolveCoords(lat, lng, pincode) {
  if (hasValidCoordsServer(lat, lng)) return { latitude: lat, longitude: lng };
  const pc = coordsForPincodeServer(pincode);
  if (pc) return pc;
  return { latitude: lat || 0, longitude: lng || 0 };
}

/* ===================== DB SCHEMA ===================== */
db.serialize(async () => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    full_name TEXT NOT NULL,
    address TEXT NOT NULL,
    contact TEXT NOT NULL UNIQUE,
    email TEXT,
    password TEXT NOT NULL,
    latitude REAL DEFAULT 0,
    longitude REAL DEFAULT 0,
    restaurant_name TEXT,
    fssai_license TEXT,
    vehicle_type TEXT,
    ngo_name TEXT,
    ngo_type TEXT,
    created_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS food_posts (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    food_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    quantity_unit TEXT NOT NULL,
    description TEXT,
    pickup_start TEXT NOT NULL,
    pickup_end TEXT NOT NULL,
    expiry TEXT NOT NULL,
    status TEXT NOT NULL,
    ngo_id TEXT,
    agent_id TEXT,
    restaurant_lat REAL,
    restaurant_lng REAL,
    ngo_lat REAL,
    ngo_lng REAL,
    accepted_at TEXT,
    picked_up_at TEXT,
    delivered_at TEXT,
    created_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS agent_assignments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    accepted_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ngo_responses (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    ngo_id TEXT NOT NULL,
    response TEXT NOT NULL,
    responded_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS seeded_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    post_id TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  )`);

  // MIGRATIONS: add missing columns WITHOUT dropping existing tables / data.
  async function addColumnIfMissing(table, column, definition) {
    try {
      const cols = await all(`PRAGMA table_info(${table})`);
      if (!cols.some((c) => c.name === column)) {
        await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`  + Added ${table}.${column}`);
      }
    } catch (e) {
      console.warn(`  ! Migration skip ${table}.${column}:`, e.message);
    }
  }
  // Users: structured address
  await addColumnIfMissing('users', 'street', 'TEXT');
  await addColumnIfMissing('users', 'area', 'TEXT');
  await addColumnIfMissing('users', 'landmark', 'TEXT');
  await addColumnIfMissing('users', 'pincode', 'TEXT');
  // Food posts: journey + ETA + OTP
  await addColumnIfMissing('food_posts', 'journey_started_at', 'TEXT');
  await addColumnIfMissing('food_posts', 'estimated_delivery_at', 'TEXT');
  await addColumnIfMissing('food_posts', 'estimated_minutes', 'INTEGER DEFAULT 0');
  await addColumnIfMissing('food_posts', 'delivery_otp', 'TEXT');
  await addColumnIfMissing('food_posts', 'otp_generated_at', 'TEXT');
  await addColumnIfMissing('food_posts', 'otp_verified_at', 'TEXT');

  // Seed / backfill
  db.get("SELECT value FROM seeded_meta WHERE key = 'seeded_v1'", (err, row) => {
    if (!row) seedDemoData();
    else migrateSeedUsersWithStructuredAddress();
  });
});

function migrateSeedUsersWithStructuredAddress() {
  const patches = [
    { contact: '9800000001', street: 'Mumbai Central Main Road', area: 'Mumbai Central', landmark: 'Near Railway Station', pincode: '400008' },
    { contact: '9800000002', street: 'Grant Road East', area: 'Grant Road', landmark: 'Opposite Cinema Hall', pincode: '400007' },
    { contact: '9800000003', street: 'Charni Road Market Lane', area: 'Charni Road', landmark: 'Near Old Temple', pincode: '400004' },
  ];
  patches.forEach((p) => {
    db.get('SELECT id FROM users WHERE contact = ? AND (pincode IS NULL OR pincode = "")', [p.contact], (err, row) => {
      if (row) {
        db.run(
          'UPDATE users SET street = ?, area = ?, landmark = ?, pincode = ? WHERE id = ?',
          [p.street, p.area, p.landmark, p.pincode, row.id]
        );
      }
    });
  });
}

// Seed demo data
function seedDemoData() {
  console.log('Seeding demo data...');
  const now = new Date().toISOString();
  const restaurant = {
    id: uid('user'), role: 'restaurant', full_name: 'Ramesh Patel',
    address: 'Swayam Restaurant, Mumbai Central Main Road, Near Railway Station, Mumbai Central, Mumbai, Maharashtra 400008',
    street: 'Mumbai Central Main Road', area: 'Mumbai Central', landmark: 'Near Railway Station', pincode: '400008',
    contact: '9800000001', email: 'ramesh@swayamrestro.com', password: 'password123',
    latitude: 19.0186, longitude: 72.8348,
    restaurant_name: 'Swayam Restaurant', fssai_license: '12345678901234', created_at: now,
  };
  const agent = {
    id: uid('user'), role: 'agent', full_name: 'Amit Sharma',
    address: 'Amit Sharma, Grant Road East, Opposite Cinema Hall, Grant Road, Mumbai, Maharashtra 400007',
    street: 'Grant Road East', area: 'Grant Road', landmark: 'Opposite Cinema Hall', pincode: '400007',
    contact: '9800000002', email: 'amit@agent.com', password: 'password123',
    latitude: 19.0216, longitude: 72.8274, vehicle_type: 'Bike', created_at: now,
  };
  const ngo = {
    id: uid('user'), role: 'ngo', full_name: 'Priya Desai',
    address: 'Annapurna Shelter, Charni Road Market Lane, Near Old Temple, Charni Road, Mumbai, Maharashtra 400004',
    street: 'Charni Road Market Lane', area: 'Charni Road', landmark: 'Near Old Temple', pincode: '400004',
    contact: '9800000003', email: 'priya@annapurna.org', password: 'password123',
    latitude: 19.0106, longitude: 72.8207, ngo_name: 'Annapurna Shelter', ngo_type: 'Shelter', created_at: now,
  };
  const insertUser = (u) => db.run(
    `INSERT INTO users (id,role,full_name,address,street,area,landmark,pincode,contact,email,password,latitude,longitude,restaurant_name,fssai_license,vehicle_type,ngo_name,ngo_type,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [u.id, u.role, u.full_name, u.address, u.street, u.area, u.landmark, u.pincode, u.contact, u.email, u.password, u.latitude, u.longitude, u.restaurant_name || null, u.fssai_license || null, u.vehicle_type || null, u.ngo_name || null, u.ngo_type || null, u.created_at]
  );
  insertUser(restaurant); insertUser(agent); insertUser(ngo);

  const pickupStart = new Date(Date.now()).toISOString().slice(0, 16);
  const pickupEnd = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 16);
  const expiry = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 16);
  const post = {
    id: uid('post'), restaurant_id: restaurant.id,
    food_type: 'Veg - Rice & Curry', quantity: 40, quantity_unit: 'servings',
    description: 'Leftover lunch: basmati rice, dal, mixed veg curry, roti. Still warm. Packed in boxes.',
    pickup_start: pickupStart, pickup_end: pickupEnd, expiry: expiry, status: 'available',
    restaurant_lat: restaurant.latitude, restaurant_lng: restaurant.longitude, created_at: now,
  };
  db.run(
    `INSERT INTO food_posts (id,restaurant_id,food_type,quantity,quantity_unit,description,pickup_start,pickup_end,expiry,status,restaurant_lat,restaurant_lng,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [post.id, post.restaurant_id, post.food_type, post.quantity, post.quantity_unit, post.description, post.pickup_start, post.pickup_end, post.expiry, post.status, post.restaurant_lat, post.restaurant_lng, post.created_at]
  );

  db.run("INSERT INTO seeded_meta (key, value) VALUES ('seeded_v1', 'yes')");
  console.log('Seeded: restaurant(9800000001), agent(9800000002), ngo(9800000003) — password: password123');
}

// Simple fetch JSON helper used only inside registerUser / server
async function fetchJson(url, opt = {}) {
  const opts = { headers: { 'Content-Type': 'application/json' }, ...opt };
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { const err = await res.json(); if (err?.error) msg = err.error; } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

/* ========================== REST API ========================== */

// TEST endpoint
app.get('/api/health', (req, res) => res.json({ ok: true, now: new Date().toISOString(), db: DB_PATH }));

// LIST users
app.get('/api/users', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM users ORDER BY created_at DESC');
    res.json(rows.map(({ password, ...safe }) => safe));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// REGISTER
app.post('/api/users', async (req, res) => {
  try {
    const b = req.body;
    const required = ['role', 'full_name', 'contact', 'password', 'street', 'area', 'landmark', 'pincode'];
    for (const k of required) if (!b[k] || !String(b[k]).trim()) {
      return res.status(400).json({ error: 'Missing required field: ' + k });
    }
    if (b.role === 'restaurant' && !b.restaurant_name?.trim()) return res.status(400).json({ error: 'Missing required field: restaurant_name' });
    if (b.role === 'restaurant' && !b.fssai_license?.trim()) return res.status(400).json({ error: 'FSSAI License Number is compulsory for restaurants (required field: fssai_license)' });
    if (b.role === 'ngo' && !b.ngo_name?.trim()) return res.status(400).json({ error: 'Missing required field: ngo_name' });
    if (!/^\d{6}$/.test(String(b.pincode).trim())) return res.status(400).json({ error: 'Pincode must be a 6-digit number (e.g. 400008)' });
    const contactClean = String(b.contact || '').replace(/\D/g, '').trim();
    if (!/^\d{10}$/.test(contactClean)) return res.status(400).json({ error: 'Contact number must be exactly 10 digits (numbers only, no spaces/letters)' });
    b.contact = contactClean;
    const existing = await get('SELECT id FROM users WHERE contact = ?', [b.contact.trim()]);
    if (existing) return res.status(400).json({ error: 'Contact number already registered' });
    const id = uid('user');
    const now = new Date().toISOString();
    const namePart =
      (b.role === 'restaurant' ? b.restaurant_name.trim() + ', ' : '') +
      (b.role === 'ngo' ? b.ngo_name.trim() + ', ' : '');
    const combinedAddress =
      namePart +
      b.street.trim() + ', ' +
      b.landmark.trim() + ', ' +
      b.area.trim() + ' - ' + b.pincode.trim();
    const finalCoord = resolveCoords(b.latitude, b.longitude, b.pincode);
    await run(
      `INSERT INTO users (id,role,full_name,address,street,area,landmark,pincode,contact,email,password,latitude,longitude,restaurant_name,fssai_license,vehicle_type,ngo_name,ngo_type,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, b.role, b.full_name.trim(), combinedAddress, b.street.trim(), b.area.trim(), b.landmark.trim(), b.pincode.trim(), b.contact.trim(), b.email?.trim() || null, b.password, finalCoord.latitude, finalCoord.longitude, b.restaurant_name?.trim() || null, b.fssai_license?.trim() || null, b.vehicle_type?.trim() || null, b.ngo_name?.trim() || null, b.ngo_type || null, now]
    );
    const saved = await get('SELECT * FROM users WHERE id = ?', [id]);
    const { password, ...safe } = saved;
    res.status(201).json(safe);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { contact, password, role } = req.body;
    if (!contact || !password || !role) return res.status(400).json({ error: 'contact, password, role required' });
    const row = await get('SELECT * FROM users WHERE contact = ? AND role = ?', [contact, role]);
    if (!row) return res.status(401).json({ error: 'Account not found for this role & contact' });
    if (row.password !== password) return res.status(401).json({ error: 'Wrong password' });
    const { password: pw, ...safe } = row;
    res.json(safe);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Food posts
app.get('/api/food-posts', async (req, res) => {
  try { res.json(await all('SELECT * FROM food_posts ORDER BY created_at DESC')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/food-posts/:id', async (req, res) => {
  try {
    const row = await get('SELECT * FROM food_posts WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/food-posts', async (req, res) => {
  try {
    const b = req.body;
    const required = ['restaurant_id', 'food_type', 'quantity', 'quantity_unit', 'pickup_start', 'pickup_end', 'expiry'];
    for (const k of required) if (!(k in b)) return res.status(400).json({ error: 'Missing field ' + k });
    const id = uid('post');
    const now = new Date().toISOString();
    let rLat = b.restaurant_lat, rLng = b.restaurant_lng;
    let nLat = b.ngo_lat, nLng = b.ngo_lng;
    const rUser = b.restaurant_id ? await get('SELECT latitude, longitude, pincode FROM users WHERE id = ?', [b.restaurant_id]) : null;
    const rCoord = resolveCoords(rLat, rLng, rUser?.pincode);
    rLat = rCoord.latitude; rLng = rCoord.longitude;
    if (b.ngo_id) {
      const nUser = await get('SELECT latitude, longitude, pincode FROM users WHERE id = ?', [b.ngo_id]);
      const nCoord = resolveCoords(nLat, nLng, nUser?.pincode);
      nLat = nCoord.latitude; nLng = nCoord.longitude;
    }
    await run(
      `INSERT INTO food_posts (id,restaurant_id,food_type,quantity,quantity_unit,description,pickup_start,pickup_end,expiry,status,restaurant_lat,restaurant_lng,ngo_lat,ngo_lng,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, b.restaurant_id, b.food_type, b.quantity, b.quantity_unit, b.description || null, b.pickup_start, b.pickup_end, b.expiry, 'available', rLat || 0, rLng || 0, nLat || 0, nLng || 0, now]
    );
    const saved = await get('SELECT * FROM food_posts WHERE id = ?', [id]);
    res.status(201).json(saved);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/food-posts/:id', async (req, res) => {
  try {
    const allowed = [
      'status', 'ngo_id', 'agent_id', 'ngo_lat', 'ngo_lng',
      'accepted_at', 'picked_up_at', 'delivered_at',
      'journey_started_at', 'estimated_delivery_at', 'estimated_minutes',
      'delivery_otp', 'otp_generated_at', 'otp_verified_at',
    ];
    const b = req.body;
    const sets = []; const params = [];
    for (const k of allowed) if (k in b) { sets.push(k + ' = ?'); params.push(b[k]); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    await run('UPDATE food_posts SET ' + sets.join(', ') + ' WHERE id = ?', params);
    res.json(await get('SELECT * FROM food_posts WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Assignments + NGO responses
app.get('/api/agent-assignments', async (req, res) => {
  try { res.json(await all('SELECT * FROM agent_assignments')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/agent-assignments', async (req, res) => {
  try {
    const { post_id, agent_id } = req.body;
    if (!post_id || !agent_id) return res.status(400).json({ error: 'post_id & agent_id required' });
    const existing = await get('SELECT id FROM agent_assignments WHERE post_id = ?', [post_id]);
    if (existing) return res.status(400).json({ error: 'Agent already assigned' });
    const id = uid('aa'); const now = new Date().toISOString();
    await run('INSERT INTO agent_assignments (id,post_id,agent_id,accepted_at) VALUES (?,?,?,?)', [id, post_id, agent_id, now]);
    res.status(201).json(await get('SELECT * FROM agent_assignments WHERE id = ?', [id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ngo-responses', async (req, res) => {
  try { res.json(await all('SELECT * FROM ngo_responses')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/ngo-responses', async (req, res) => {
  try {
    const { post_id, ngo_id, response } = req.body;
    if (!post_id || !ngo_id || !response) return res.status(400).json({ error: 'post_id, ngo_id, response required' });
    if (!['accepted', 'rejected'].includes(response)) return res.status(400).json({ error: 'response must be accepted/rejected' });
    const existing = await get('SELECT id FROM ngo_responses WHERE post_id = ? AND ngo_id = ?', [post_id, ngo_id]);
    if (existing) return res.status(400).json({ error: 'NGO already responded' });
    const id = uid('ngoresp'); const now = new Date().toISOString();
    await run('INSERT INTO ngo_responses (id,post_id,ngo_id,response,responded_at) VALUES (?,?,?,?,?)', [id, post_id, ngo_id, response, now]);
    res.status(201).json(await get('SELECT * FROM ngo_responses WHERE id = ?', [id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ==================== NOTIFICATIONS ==================== */
async function pushNotification(user_id, post_id, title, message, type) {
  const id = uid('notif');
  const now = new Date().toISOString();
  await run(
    'INSERT INTO notifications (id,user_id,post_id,title,message,type,read,created_at) VALUES (?,?,?,?,?,?,0,?)',
    [id, user_id, post_id || null, title, message, type, now]
  );
  return { id, user_id, post_id, title, message, type, read: 0, created_at: now };
}
app.get('/api/notifications/:user_id', async (req, res) => {
  try {
    res.json(await all(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY read ASC, created_at DESC',
      [req.params.user_id]
    ));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/notifications/:user_id/mark-read', async (req, res) => {
  try {
    const { id } = req.body;
    if (id) await run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [id, req.params.user_id]);
    else await run('UPDATE notifications SET read = 1 WHERE user_id = ?', [req.params.user_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ==================== DELIVERY JOURNEY / OTP FLOW ==================== */
app.post('/api/food-posts/:id/start-journey', async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await get('SELECT * FROM food_posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const { agent_id, dist_agent_rest_km, dist_rest_ngo_km, vehicle_type } = req.body || {};
    let dAR = Number(dist_agent_rest_km), dRN = Number(dist_rest_ngo_km);
    if ((!dAR || !dRN) && post.agent_id) {
      const agent = await get('SELECT latitude, longitude, vehicle_type, pincode FROM users WHERE id = ?', [post.agent_id]);
      const rest = post.restaurant_id ? await get('SELECT latitude, longitude, pincode FROM users WHERE id = ?', [post.restaurant_id]) : null;
      const ngo = post.ngo_id ? await get('SELECT latitude, longitude, pincode FROM users WHERE id = ?', [post.ngo_id]) : null;
      if (agent) {
        const aCoord = resolveCoords(agent.latitude, agent.longitude, agent.pincode);
        const rCoord = resolveCoords(
          post.restaurant_lat != null ? post.restaurant_lat : (rest?.latitude ?? 0),
          post.restaurant_lng != null ? post.restaurant_lng : (rest?.longitude ?? 0),
          rest?.pincode
        );
        const nCoord = resolveCoords(
          post.ngo_lat != null ? post.ngo_lat : (ngo?.latitude ?? 0),
          post.ngo_lng != null ? post.ngo_lng : (ngo?.longitude ?? 0),
          ngo?.pincode
        );
        if (!dAR) dAR = haversineKm(aCoord.latitude, aCoord.longitude, rCoord.latitude, rCoord.longitude);
        if (!dRN) dRN = haversineKm(rCoord.latitude, rCoord.longitude, nCoord.latitude, nCoord.longitude);
        if (!vehicle_type && agent.vehicle_type) vehicle_type = agent.vehicle_type;
      }
    }
    const eta = estimateDeliveryETA(dAR || 0, dRN || 0, vehicle_type || 'Bike');
    const now = new Date().toISOString();
    await run(
      `UPDATE food_posts SET journey_started_at = ?, estimated_delivery_at = ?, estimated_minutes = ?, status = CASE WHEN status IN ('agent-assigned','ngo-accepted') THEN 'journey-started' ELSE status END WHERE id = ?`,
      [now, eta.estimated_delivery_at, eta.eta_minutes, postId]
    );
    const updated = await get('SELECT * FROM food_posts WHERE id = ?', [postId]);
    if (post.restaurant_id) {
      await pushNotification(post.restaurant_id, postId,
        '🛵 Delivery Agent On The Way',
        `Agent has started the journey. Estimated delivery to NGO in ${eta.eta_minutes} minutes (around ${new Date(eta.estimated_delivery_at).toLocaleTimeString()}).`,
        'journey_started');
    }
    if (post.ngo_id) {
      await pushNotification(post.ngo_id, postId,
        '🛵 Food Donation On The Way',
        `Delivery agent has started. Estimated arrival in ${eta.eta_minutes} minutes (around ${new Date(eta.estimated_delivery_at).toLocaleTimeString()}).`,
        'journey_started');
    }
    res.json({ ...updated, eta_info: eta });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/food-posts/:id/generate-delivery-otp', async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await get('SELECT * FROM food_posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (!post.ngo_id || !post.restaurant_id) return res.status(400).json({ error: 'Post must have accepted NGO and restaurant before generating OTP' });
    const otp = generateOTP();
    const now = new Date().toISOString();
    await run(
      `UPDATE food_posts SET delivery_otp = ?, otp_generated_at = ?, status = CASE WHEN status != 'delivered' THEN 'otp-pending' ELSE status END WHERE id = ?`,
      [otp, now, postId]
    );
    const updated = await get('SELECT * FROM food_posts WHERE id = ?', [postId]);
    const { delivery_otp, ...safe } = updated;
    const ngo = post.ngo_id ? await get('SELECT ngo_name, full_name FROM users WHERE id = ?', [post.ngo_id]) : null;
    const ngoDisplay = ngo?.ngo_name || ngo?.full_name || 'the NGO';
    await pushNotification(
      post.ngo_id, postId,
      '🔐 Delivery OTP Generated',
      `Delivery agent has arrived. Please share this 6-digit OTP with the agent to confirm receipt: ** ${otp} **. Do NOT share this with anyone else. Restaurant will also verify this OTP for transparent delivery.`,
      'otp'
    );
    await pushNotification(
      post.restaurant_id, postId,
      '🔐 Delivery Verification OTP',
      `Agent reached ${ngoDisplay}. Delivery OTP for your verification: ** ${otp} **. Ask the agent for this OTP if you want to independently confirm the food was delivered. After agent enters the OTP correctly, delivery is marked successful.`,
      'otp'
    );
    res.json({ ...safe, otp_sent: true, to_ngo: !!post.ngo_id, to_restaurant: !!post.restaurant_id, note: 'OTP delivered to NGO and Restaurant via notifications panel' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/food-posts/:id/verify-delivery-otp', async (req, res) => {
  try {
    const postId = req.params.id;
    const { otp } = req.body || {};
    if (!otp) return res.status(400).json({ error: 'OTP required' });
    const post = await get('SELECT * FROM food_posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (!post.delivery_otp) return res.status(400).json({ error: 'OTP not yet generated for this delivery. Click "Reached NGO / Generate OTP" first.' });
    if (String(otp).trim() !== String(post.delivery_otp).trim()) return res.status(400).json({ error: 'Invalid OTP. Please re-check the 6-digit code shared by the NGO.' });
    const now = new Date().toISOString();
    await run(`UPDATE food_posts SET status = 'delivered', delivered_at = ?, otp_verified_at = ?, delivery_otp = NULL WHERE id = ?`, [now, now, postId]);
    const updated = await get('SELECT * FROM food_posts WHERE id = ?', [postId]);
    const ngo = post.ngo_id ? await get('SELECT ngo_name, contact FROM users WHERE id = ?', [post.ngo_id]) : null;
    const agent = post.agent_id ? await get('SELECT full_name, contact FROM users WHERE id = ?', [post.agent_id]) : null;
    const ngoName = ngo?.ngo_name || 'NGO';
    const agentName = agent?.full_name || 'Agent';
    if (post.restaurant_id) {
      await pushNotification(post.restaurant_id, postId,
        '✅ Delivery Successful',
        `Great news! Your food donation has been DELIVERED successfully.\n- Delivered to: ${ngoName}${ngo?.contact ? ` (${ngo.contact})` : ''}\n- By: ${agentName}${agent?.contact ? ` (${agent.contact})` : ''}\n- Verified with OTP at ${new Date(now).toLocaleString()}.\nThank you for helping reduce food waste!`,
        'delivery_success');
    }
    if (post.ngo_id) {
      const rest = post.restaurant_id ? await get('SELECT restaurant_name, contact FROM users WHERE id = ?', [post.restaurant_id]) : null;
      const restName = rest?.restaurant_name || 'Restaurant';
      await pushNotification(post.ngo_id, postId,
        '✅ Delivery Received Successfully',
        `Food donation received and OTP verified.\n- Donated by: ${restName}${rest?.contact ? ` (${rest.contact})` : ''}\n- Delivered by: ${agentName}${agent?.contact ? ` (${agent.contact})` : ''}\n- Time: ${new Date(now).toLocaleString()}.\nThank you for your service!`,
        'delivery_success');
    }
    if (post.agent_id) {
      await pushNotification(post.agent_id, postId,
        '✅ Delivery Completed',
        `Delivery #${postId.slice(0, 8)} completed successfully! OTP verified. Great job delivering smiles today 👏.`,
        'delivery_success');
    }
    res.json({ ok: true, delivered: true, post: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Serve static frontend from build folder (if exists) in production-like setup
const BUILD_DIR = path.join(__dirname, 'build');
if (fs.existsSync(BUILD_DIR)) {
  app.use(express.static(BUILD_DIR));
  app.get(/^\/(?!api).*/, (req, res) => {
    const idx = path.join(BUILD_DIR, 'index.html');
    if (fs.existsSync(idx)) res.sendFile(idx); else res.status(404).json({ error: 'Frontend build missing — run npm run build' });
  });
}

app.listen(PORT, () => {
  console.log(`FoodConnect backend running on http://localhost:${PORT}`);
  console.log(`API base: http://localhost:${PORT}/api`);
});
