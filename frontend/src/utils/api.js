const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const apiFetch = async (path, options = {}) => {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`API fetch error on ${path}:`, err);
    return null;
  }
};

// ── Room API ────────────────────────────────────────────────────

export const getRoom = (roomId) => apiFetch(`/api/rooms/${roomId}`);

export const saveRoom = (roomId, participants) =>
  apiFetch(`/api/rooms/${roomId}`, {
    method: 'POST',
    body: JSON.stringify({ participants }),
  });

export const joinRoom = (roomId, participant) =>
  apiFetch(`/api/rooms/${roomId}/join`, {
    method: 'POST',
    body: JSON.stringify({ participant }),
  });

// ── Auction Players API ─────────────────────────────────────────

export const getAuctionPlayers = () => apiFetch('/api/auction-players');

export const saveAuctionPlayers = (playersBySet) =>
  apiFetch('/api/auction-players', {
    method: 'POST',
    body: JSON.stringify({ playersBySet }),
  });

// ── Auction State API ───────────────────────────────────────────

export const getAuctionState = (roomId) =>
  apiFetch(`/api/auction-state/${roomId}`);

export const saveAuctionState = (roomId, state) =>
  apiFetch(`/api/auction-state/${roomId}`, {
    method: 'POST',
    body: JSON.stringify({ state }),
  });

// ── Auction Started Flag ────────────────────────────────────────

export const getAuctionStarted = (roomId) =>
  apiFetch(`/api/auction-started/${roomId}`);

export const setAuctionStarted = (roomId, started) =>
  apiFetch(`/api/auction-started/${roomId}`, {
    method: 'POST',
    body: JSON.stringify({ started }),
  });
