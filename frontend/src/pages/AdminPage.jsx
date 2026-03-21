import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveAuctionPlayers } from '../utils/api';

const setsData = [
  { id: 'marquee', name: 'Marquee Set', limit: 25, basePrice: '2 Cr' },
  { id: 'set1', name: 'Set - 1', limit: 30, basePrice: '1.5 Cr' },
  { id: 'set2', name: 'Set - 2', limit: 30, basePrice: '1 Cr' },
  { id: 'set3', name: 'Set - 3', limit: 30, basePrice: '50 L' },
  { id: 'set4', name: 'Set - 4', limit: 40, basePrice: '30 L' }
];

// Fallback local suggestions if DB has no players yet
const FALLBACK_PLAYERS = [
  { name: 'Virat Kohli', category: 'Batsman', nationality: 'Indian' },
  { name: 'MS Dhoni', category: 'Wicketkeeper', nationality: 'Indian' },
  { name: 'Rashid Khan', category: 'Bowler', nationality: 'Foreign' },
  { name: 'Ben Stokes', category: 'All Rounder', nationality: 'Foreign' },
  { name: 'Jasprit Bumrah', category: 'Bowler', nationality: 'Indian' },
  { name: 'Rohit Sharma', category: 'Batsman', nationality: 'Indian' },
  { name: 'Glenn Maxwell', category: 'All Rounder', nationality: 'Foreign' },
  { name: 'KL Rahul', category: 'Wicketkeeper', nationality: 'Indian' }
];

const AdminPage = () => {
  const navigate = useNavigate();
  const [playersBySet, setPlayersBySet] = useState({ marquee: [], set1: [], set2: [], set3: [], set4: [] });
  const [isLoading, setIsLoading] = useState(true);
  // ALL players from DB (flat list) used as autocomplete source
  const [allPlayersDB, setAllPlayersDB] = useState(FALLBACK_PLAYERS);

  const [expandedSet, setExpandedSet] = useState(null);
  const [addModalSet, setAddModalSet] = useState(null);

  const [newPlayer, setNewPlayer] = useState({ name: '', category: 'Batsman', nationality: 'Indian' });
  const [suggestions, setSuggestions] = useState([]);

  // 1. Fetch from Backend on Mount to avoid wiping out the database
  useEffect(() => {
    const initData = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auction-players`);
        if (res.ok) {
          const data = await res.json();
          // Build a flat list of all players from DB for autocomplete suggestions
          const validSetIds = ['marquee', 'set1', 'set2', 'set3', 'set4'];
          const flat = [];
          validSetIds.forEach(key => {
            if (Array.isArray(data[key])) data[key].forEach(p => flat.push(p));
          });
          // Also include any unassigned players from DB
          if (Array.isArray(data.unassigned)) data.unassigned.forEach(p => flat.push(p));

          // Merge with local fallback so suggestions always have content
          const dbNames = new Set(flat.map(p => p.name.toLowerCase()));
          const merged = [...flat, ...FALLBACK_PLAYERS.filter(p => !dbNames.has(p.name.toLowerCase()))];
          setAllPlayersDB(merged);

          // Only populate the sets if there's actual set data
          const hasData = validSetIds.some(k => data[k]?.length > 0);
          if (hasData) {
            const cleanSets = {};
            validSetIds.forEach(k => { cleanSets[k] = data[k] || []; });
            setPlayersBySet(cleanSets);
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error('Could not fetch players from backend:', e);
      }

      // Fallback to localStorage if backend has nothing or fails
      const saved = localStorage.getItem('auctionPlayers');
      if (saved) setPlayersBySet(JSON.parse(saved));
      setIsLoading(false);
    };
    initData();
  }, []);

  // 2. Only sync to local storage automatically. Require MANUAL clicks to sync to database!
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('auctionPlayers', JSON.stringify(playersBySet));
    }
  }, [playersBySet, isLoading]);

  const toggleSet = (setId) => {
    setExpandedSet(expandedSet === setId ? null : setId);
  };

  const openAddModal = (e, setId) => {
    e.stopPropagation(); // prevent accordion toggle
    setAddModalSet(setId);
    setNewPlayer({ name: '', category: 'Batsman', nationality: 'Indian' });
    setSuggestions([]);
  };

  const handleNameChange = (val) => {
    setNewPlayer({ ...newPlayer, name: val });
    if (val.length > 1) {
      // Search from the live DB-sourced list (includes all players stored in MongoDB)
      const lower = val.toLowerCase();
      const filtered = allPlayersDB.filter(p => p.name.toLowerCase().includes(lower));
      setSuggestions(filtered.slice(0, 8)); // cap at 8 suggestions
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (player) => {
    setNewPlayer({ name: player.name, category: player.category, nationality: player.nationality });
    setSuggestions([]);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    const targetSetData = setsData.find(s => s.id === addModalSet);
    
    if (playersBySet[addModalSet].length >= targetSetData.limit) {
      alert(`Cannot add more players. ${targetSetData.name} has reached its limit of ${targetSetData.limit}!`);
      return;
    }

    const playerObj = {
      id: Math.random().toString(36).substr(2, 9),
      ...newPlayer,
      basePrice: targetSetData.basePrice
    };

    setPlayersBySet(prev => ({
      ...prev,
      [addModalSet]: [...prev[addModalSet], playerObj]
    }));
    
    setAddModalSet(null);
  };

  const handleDeletePlayer = (setId, playerId) => {
    setPlayersBySet(prev => ({
      ...prev,
      [setId]: prev[setId].filter(p => p.id !== playerId)
    }));
  };

  const handleBegin = () => {
    // Ensure API has the latest player data
    saveAuctionPlayers(playersBySet);
    alert("Auction parameters saved! Ready to begin.");
    navigate('/');
  };

  const handleManualSave = async () => {
    await saveAuctionPlayers(playersBySet);
    alert("Players successfully saved to database!");
  };

  return (
    <div className="landing-wrapper admin-wrapper">
      <div className="glass-card admin-card">
        
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
           <h1 className="title admin-title">Admin Dashboard</h1>
           <button className="create-room-btn" style={{width: 'auto', padding: '0.5rem 1rem', fontSize: '1rem', backgroundColor: '#3b82f6'}} onClick={handleManualSave}>
             Save Players
           </button>
        </div>
        <h2 className="subtitle">Manage Players & Sets</h2>

        <div className="sets-container">
          {setsData.map((setObj, index) => {
            const players = playersBySet[setObj.id] || [];
            const isFull = players.length >= setObj.limit;

            return (
              <React.Fragment key={setObj.id}>
                <div className="set-bar-wrapper">
                  <div className={`set-bar ${expandedSet === setObj.id ? 'expanded' : ''}`} onClick={() => toggleSet(setObj.id)}>
                    <div className="set-info">
                      <h3 className="set-name">{setObj.name}</h3>
                      <span className="set-limit">max limit {setObj.limit}</span>
                    </div>
                    
                    <div className="set-actions">
                      <span className="player-count" style={{ color: isFull ? '#ef4444' : 'var(--text-muted)' }}>
                        {players.length} / {setObj.limit}
                      </span>
                      <button 
                        className="add-plus-btn" 
                        onClick={(e) => openAddModal(e, setObj.id)}
                        disabled={isFull}
                        title={isFull ? "Set is full" : "Add Player"}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {expandedSet === setObj.id && (
                    <div className="players-list-container">
                      {players.length === 0 ? (
                        <p className="waiting-text" style={{ padding: '1rem', textAlign: 'center' }}>No players added yet.</p>
                      ) : (
                        <table className="players-table">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Role</th>
                              <th>Origin</th>
                              <th>Base Price</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {players.map(p => (
                              <tr key={p.id}>
                                <td>{p.name}</td>
                                <td>{p.category}</td>
                                <td>{p.nationality}</td>
                                <td>{p.basePrice}</td>
                                <td>
                                  <button 
                                    className="delete-btn"
                                    onClick={(e) => { e.stopPropagation(); handleDeletePlayer(setObj.id, p.id); }}
                                    style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', padding: '0.3rem 0.8rem', cursor: 'pointer', transition: 'all 0.2s', fontWeight: '600' }}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
                {index < setsData.length - 1 && (
                  <div className="down-arrow-connector">↓</div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        <button className="create-room-btn start-btn" style={{ marginTop: '2.5rem', width: '100%' }} onClick={handleBegin}>
          Let's Begin
        </button>
      </div>

      {addModalSet && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ overflow: 'visible' }}>
            <h2 className="modal-title">Add to {setsData.find(s => s.id === addModalSet)?.name}</h2>
            <form onSubmit={handleAddSubmit} className="login-form">
              
              <div className="input-group" style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <label className="input-label">Player Name</label>
                <input 
                  type="text" 
                  className="name-input"
                  style={{ width: '100%' }}
                  value={newPlayer.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  placeholder="e.g. Virat Kohli"
                />
                {suggestions.length > 0 && (
                  <ul className="suggestions-list">
                    {suggestions.map((s, i) => (
                      <li key={i} onClick={() => selectSuggestion(s)}>{s.name} <small>({s.category})</small></li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="input-group" style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <label className="input-label">Category</label>
                <select 
                  className="name-input" 
                  style={{ width: '100%' }}
                  value={newPlayer.category}
                  onChange={(e) => setNewPlayer({...newPlayer, category: e.target.value})}
                >
                  <option value="Batsman">Batsman</option>
                  <option value="Bowler">Bowler</option>
                  <option value="All Rounder">All Rounder</option>
                  <option value="Wicketkeeper">Wicketkeeper</option>
                </select>
              </div>

              <div className="input-group" style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <label className="input-label">Nationality</label>
                <select 
                  className="name-input" 
                  style={{ width: '100%' }}
                  value={newPlayer.nationality}
                  onChange={(e) => setNewPlayer({...newPlayer, nationality: e.target.value})}
                >
                  <option value="Indian">Indian</option>
                  <option value="Foreign">Foreign</option>
                </select>
              </div>

              <div className="input-group" style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <label className="input-label">Base Price (Fixed for this set)</label>
                <input 
                  type="text" 
                  className="name-input" 
                  style={{ width: '100%', opacity: 0.6 }}
                  readOnly 
                  value={setsData.find(s => s.id === addModalSet)?.basePrice || ''}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setAddModalSet(null)}>Cancel</button>
                <button type="submit" className="submit-btn primary-btn">Add Player</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
