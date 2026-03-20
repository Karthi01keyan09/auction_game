const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// ── In-Memory Data Stores ──────────────────────────────────────
const rooms = new Map();          // roomId → { participants: [...] }
const auctionPlayers = new Map(); // 'global' → { marquee: [], set1: [], ... }
const auctionStates = new Map();  // roomId → { currentPlayerIdx, ... }
const auctionStarted = new Map(); // roomId → boolean

// ── Middleware ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── Health Check ────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'IPL Auction Game API is running!' });
});

// ── Room Endpoints ──────────────────────────────────────────────

// Get room data
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});

// Create or update room
app.post('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const { participants } = req.body;
  if (!participants) return res.status(400).json({ error: 'participants required' });
  rooms.set(roomId, { participants });
  res.json({ success: true });
});

// Add a participant to a room
app.post('/api/rooms/:roomId/join', (req, res) => {
  const { roomId } = req.params;
  const { participant } = req.body;
  if (!participant) return res.status(400).json({ error: 'participant required' });

  let room = rooms.get(roomId);
  if (!room) {
    room = { participants: [] };
  }

  // Check if team is already taken
  if (room.participants.some(p => p.teamId === participant.teamId)) {
    return res.status(409).json({ error: 'Team already taken' });
  }

  room.participants.push(participant);
  rooms.set(roomId, room);
  res.json({ success: true, participants: room.participants });
});

// ── Auction Players (Admin) ─────────────────────────────────────

// Get auction players
app.get('/api/auction-players', (req, res) => {
  const players = auctionPlayers.get('global');
  if (!players) return res.status(404).json({ error: 'No players configured' });
  res.json(players);
});

// Save auction players
app.post('/api/auction-players', (req, res) => {
  const { playersBySet } = req.body;
  if (!playersBySet) return res.status(400).json({ error: 'playersBySet required' });
  auctionPlayers.set('global', playersBySet);
  res.json({ success: true });
});

// ── Auction State ───────────────────────────────────────────────

// Get auction state for a room
app.get('/api/auction-state/:roomId', (req, res) => {
  const { roomId } = req.params;
  const state = auctionStates.get(roomId);
  if (!state) return res.status(404).json({ error: 'No auction state' });
  res.json(state);
});

// Save auction state for a room
app.post('/api/auction-state/:roomId', (req, res) => {
  const { roomId } = req.params;
  const { state } = req.body;
  if (!state) return res.status(400).json({ error: 'state required' });
  auctionStates.set(roomId, state);
  res.json({ success: true });
});

// ── Auction Started Flag ────────────────────────────────────────

app.get('/api/auction-started/:roomId', (req, res) => {
  const { roomId } = req.params;
  res.json({ started: auctionStarted.get(roomId) || false });
});

app.post('/api/auction-started/:roomId', (req, res) => {
  const { roomId } = req.params;
  const { started } = req.body;
  auctionStarted.set(roomId, !!started);
  res.json({ success: true });
});

// ── Start Server ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
