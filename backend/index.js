const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'database.json');

// ── Database Helper ──────────────────────────────────────────────
const readDB = () => {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading database:", err);
  }
  return { rooms: {}, auctionPlayers: { global: null }, auctionStates: {}, auctionStarted: {} };
};

const writeDB = (data) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Error writing database:", err);
  }
};

// Initialize DB file if missing
if (!fs.existsSync(DB_FILE)) {
  writeDB({ rooms: {}, auctionPlayers: { global: null }, auctionStates: {}, auctionStarted: {} });
}

// ── Middleware ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'IPL Auction Game API with JSON DB is running!' });
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

// ── Auction Players (Admin) ─────────────────────────────────────
app.get('/api/auction-players', (req, res) => {
  const db = readDB();
  const players = db.auctionPlayers.global;
  if (!players) return res.status(404).json({ error: 'No players configured' });
  res.json(players);
});

app.post('/api/auction-players', (req, res) => {
  const { playersBySet } = req.body;
  const db = readDB();
  db.auctionPlayers.global = playersBySet;
  writeDB(db);
  res.json({ success: true });
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

app.listen(PORT, () => console.log(`Server running on port ${PORT} with DB support`));
