import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { teamsList } from '../utils/constants';
import { saveRoom } from '../utils/api';

const LandingPage = () => {
  const [playerName, setPlayerName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginCreds, setLoginCreds] = useState({ username: '', password: '' });
  const navigate = useNavigate();

  const handlePickTeam = (teamId) => {
    setSelectedTeam(teamId);
  };

  const handleCreateRoom = () => {
    if (!playerName) {
      alert("Please enter your name first!");
      return;
    }
    if (!selectedTeam) {
      alert("Please pick a team!");
      return;
    }
    const roomId = Math.random().toString(36).substring(2, 8);
    
    // Save to local storage for syncing
    const newRoom = {
      participants: [{ id: Date.now().toString(), name: playerName, teamId: selectedTeam, isHost: true }]
    };
    localStorage.setItem(`room_${roomId}`, JSON.stringify(newRoom));

    // Sync to backend API for cross-device access
    saveRoom(roomId, newRoom.participants);

    navigate(`/room/${roomId}`, { state: { myId: newRoom.participants[0].id } });
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (loginCreds.username === 'karthi' && loginCreds.password === 'karthi123') {
      setShowLoginModal(false);
      navigate('/admin');
    } else {
      alert('Invalid credentials! Username: karthi, Password: karthi123');
    }
  };

  return (
    <div className="landing-wrapper">
      <div className="glass-card">
        <h1 className="title">Get Ready For<br/><span className="highlight">IPL Auction</span></h1>
        
        <div className="input-group">
          <input 
            type="text" 
            placeholder="Enter your name" 
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="name-input"
          />
        </div>

        <h2 className="subtitle">Pick your team</h2>
        
        <div className="teams-grid">
          {teamsList.map((team) => (
            <div key={team.id} className={`team-card ${selectedTeam === team.id ? 'selected' : ''}`} onClick={() => handlePickTeam(team.id)}>
              <div className="team-logo-box" style={{ borderColor: team.color }}>
                <img src={team.logo} alt={team.name} className="team-logo-img" />
              </div>
              <button 
                className="pick-btn" 
                style={{ 
                  backgroundColor: selectedTeam === team.id ? team.color : 'transparent',
                  color: selectedTeam === team.id ? '#fff' : 'var(--text-main)',
                  borderColor: team.color
                }}
              >
                {selectedTeam === team.id ? 'Picked' : 'Pick'}
              </button>
            </div>
          ))}
        </div>

        <button className="create-room-btn" onClick={handleCreateRoom}>
          Create Your Room
        </button>

        <div className="admin-login-section">
          <button className="login-btn" onClick={() => setShowLoginModal(true)}>Login</button>
          <p className="admin-note">
            <span className="arrow">✓</span> admin can make changes to the list
          </p>
        </div>
      </div>

      {showLoginModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <h2 className="modal-title">Admin Login</h2>
            <form onSubmit={handleLoginSubmit} className="login-form">
              <input 
                type="text" 
                placeholder="Username" 
                className="name-input"
                value={loginCreds.username}
                onChange={(e) => setLoginCreds({...loginCreds, username: e.target.value})}
                required
              />
              <input 
                type="password" 
                placeholder="Password" 
                className="name-input"
                value={loginCreds.password}
                onChange={(e) => setLoginCreds({...loginCreds, password: e.target.value})}
                required
              />
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowLoginModal(false)}>Cancel</button>
                <button type="submit" className="submit-btn primary-btn">Login</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
