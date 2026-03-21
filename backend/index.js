require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'database.json');
const PLAYERS_DB_FILE = path.join(__dirname, 'players.db');

let playersDb; // SQLite
let PlayerModel; // MongoDB

const isMongoConfigured = !!process.env.MONGO_URI;

// ── Database Initializations ───────────────────────────────────────
if (isMongoConfigured) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB permanently for players database.'))
    .catch(err => console.error('MongoDB connection error:', err));
    
  const playerSchema = new mongoose.Schema({
    id: String,
    setName: String,
    name: String,
    category: String,
    nationality: String,
    basePrice: String
  });
  PlayerModel = mongoose.model('Player', playerSchema);
} else {
  // Initialize SQLite for players as fallback
  const initPlayersDB = async () => {
    try {
      const sqlite3 = require('sqlite3').verbose();
      const { open } = require('sqlite');
      
      playersDb = await open({
        filename: PLAYERS_DB_FILE,
        driver: sqlite3.Database
      });

      await playersDb.exec(`
        CREATE TABLE IF NOT EXISTS players (
          id TEXT PRIMARY KEY,
          setName TEXT,
          name TEXT,
          category TEXT,
          nationality TEXT,
          basePrice TEXT
        )
      `);
      console.log('⚠️ MONGO_URI not found. Using local SQLite database as fallback.');
    } catch (err) {
      console.error('Failed to initialize local SQLite database (this is expected on some cloud hosts without native binaries). Set MONGO_URI to use MongoDB instead.', err);
    }
  };
  initPlayersDB();
}

// ── JSON Database Helper for Room State ───────────────────────────
const readDB = () => {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading database:", err);
  }
  return { rooms: {}, auctionStates: {}, auctionStarted: {} };
};

const writeDB = (data) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Error writing database:", err);
  }
};

// Initialize JSON DB file if missing
if (!fs.existsSync(DB_FILE)) {
  writeDB({ rooms: {}, auctionStates: {}, auctionStarted: {} });
}

// ── Middleware ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'IPL Auction Game API is running!' });
});

// ── Room Endpoints ──────────────────────────────────────────────
app.get('/api/rooms/:roomId', (req, res) => {
  const db = readDB();
  const room = db.rooms[req.params.roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});

app.post('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const { participants } = req.body;
  const db = readDB();
  db.rooms[roomId] = { participants };
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/rooms/:roomId/join', (req, res) => {
  const { roomId } = req.params;
  const { participant } = req.body;
  const db = readDB();
  
  if (!db.rooms[roomId]) {
    db.rooms[roomId] = { participants: [] };
  }

  if (db.rooms[roomId].participants.some(p => p.teamId === participant.teamId)) {
    return res.status(409).json({ error: 'Team already taken' });
  }

  db.rooms[roomId].participants.push(participant);
  writeDB(db);
  res.json({ success: true, participants: db.rooms[roomId].participants });
});

// ── Auction Players (Separate Cloud/SQLite Database) ─────────────
app.get('/api/auction-players', async (req, res) => {
  try {
    const playersBySet = { marquee: [], set1: [], set2: [], set3: [], set4: [] };

    if (isMongoConfigured) {
      // MongoDB approach: Fetch all and group, or aggregate with $sample
      // Using an aggregation pipeline to group and randomly sort
      const players = await PlayerModel.aggregate([{ $sample: { size: 1000 } }]);
      players.forEach(p => {
        if (playersBySet[p.setName]) {
          playersBySet[p.setName].push(p);
        }
      });
    } else {
      // SQLite approach: ORDER BY RANDOM()
      const rows = await playersDb.all('SELECT * FROM players ORDER BY RANDOM()');
      rows.forEach(row => {
        const p = {
          id: row.id,
          name: row.name,
          category: row.category,
          nationality: row.nationality,
          basePrice: row.basePrice
        };
        if (playersBySet[row.setName]) {
          playersBySet[row.setName].push(p);
        }
      });
    }

    res.json(playersBySet);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching players' });
  }
});

app.post('/api/auction-players', async (req, res) => {
  const { playersBySet } = req.body;
  
  if (!playersBySet) return res.status(400).json({ error: "No players provided" });

  try {
    if (isMongoConfigured) {
      // MongoDB
      await PlayerModel.deleteMany({}); // Wipe old configurations
      const insertQueue = [];
      for (const [setName, players] of Object.entries(playersBySet)) {
        if (Array.isArray(players)) {
          for (const p of players) {
            insertQueue.push({
              id: p.id || Math.random().toString(36).substr(2, 9),
              setName,
              name: p.name,
              category: p.category,
              nationality: p.nationality,
              basePrice: p.basePrice
            });
          }
        }
      }
      if (insertQueue.length > 0) {
         await PlayerModel.insertMany(insertQueue);
      }
    } else {
      // SQLite
      await playersDb.exec('BEGIN TRANSACTION');
      await playersDb.run('DELETE FROM players');
      
      const stmt = await playersDb.prepare(
        'INSERT INTO players (id, setName, name, category, nationality, basePrice) VALUES (?, ?, ?, ?, ?, ?)'
      );

      for (const [setName, players] of Object.entries(playersBySet)) {
        if (Array.isArray(players)) {
          for (const p of players) {
            await stmt.run(p.id || Math.random().toString(36).substr(2, 9), setName, p.name, p.category, p.nationality, p.basePrice);
          }
        }
      }
      
      await stmt.finalize();
      await playersDb.exec('COMMIT');
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    if (!isMongoConfigured && playersDb) await playersDb.exec('ROLLBACK');
    res.status(500).json({ error: 'Failed to save players' });
  }
});

// ── Auction State ───────────────────────────────────────────────
app.get('/api/auction-state/:roomId', (req, res) => {
  const db = readDB();
  const state = db.auctionStates[req.params.roomId];
  if (!state) return res.status(404).json({ error: 'No auction state' });
  res.json(state);
});

app.post('/api/auction-state/:roomId', (req, res) => {
  const { roomId } = req.params;
  const { state } = req.body;
  const db = readDB();
  db.auctionStates[roomId] = state;
  writeDB(db);
  res.json({ success: true });
});

app.get('/api/auction-started/:roomId', (req, res) => {
  const db = readDB();
  res.json({ started: !!db.auctionStarted[req.params.roomId] });
});

app.post('/api/auction-started/:roomId', (req, res) => {
  const db = readDB();
  db.auctionStarted[req.params.roomId] = !!req.body.started;
  writeDB(db);
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

