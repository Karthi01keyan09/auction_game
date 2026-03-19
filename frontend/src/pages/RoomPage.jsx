import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { teamsList, getTeamById } from '../utils/constants';

const RoomPage = () => {
  const { roomId } = useParams();
  const location = useLocation();
  
  const [participants, setParticipants] = useState([]);
  const [myId, setMyId] = useState(location.state?.myId || null);
  
  const [joinName, setJoinName] = useState('');
  const [joinTeam, setJoinTeam] = useState(null);

  const linkToShare = window.location.href;

  const navigate = useNavigate();

  useEffect(() => {
    const roomKey = `room_${roomId}`;
    
    // Sync room from local storage
    const syncRoom = () => {
      const data = localStorage.getItem(roomKey);
      if (data) {
        setParticipants(JSON.parse(data).participants);
      }
    };
    
    syncRoom();
    
    // Listen to storage changes across tabs
    const handleStorageChange = (e) => {
      if (e.key === roomKey) {
        syncRoom();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [roomId]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(linkToShare);
      alert('Room link copied to clipboard!');
    } catch (err) {
      const input = document.getElementById('room-link');
      if (input) {
        input.select();
        document.execCommand('copy');
        alert('Room link copied to clipboard!');
      }
    }
  };

  useEffect(() => {
    const handleAuctionStartSync = (e) => {
      if (e.key === `auctionStarted_${roomId}` && e.newValue === 'true') {
        navigate(`/auction/${roomId}`, { state: { myId } });
      }
    };
    window.addEventListener('storage', handleAuctionStartSync);
    
    // Check if it's already started
    if (localStorage.getItem(`auctionStarted_${roomId}`) === 'true') {
       navigate(`/auction/${roomId}`, { state: { myId } });
    }

    return () => window.removeEventListener('storage', handleAuctionStartSync);
  }, [roomId, navigate, myId]);

  const handleStart = () => {
    localStorage.setItem(`auctionStarted_${roomId}`, 'true');
    // Ensure the host itself navigates
    navigate(`/auction/${roomId}`, { state: { myId } });
  };

  const handleJoinRoom = () => {
    if (!joinName) return alert("Please enter your name");
    if (!joinTeam) return alert("Please pick a team");
    
    const roomKey = `room_${roomId}`;
    const data = localStorage.getItem(roomKey);
    let currentPart = data ? JSON.parse(data).participants : [];
    
    if(currentPart.some(p => p.teamId === joinTeam)) {
        return alert("This team was already taken!");
    }
    
    const me = { 
        id: Date.now().toString(), 
        name: joinName, 
        teamId: joinTeam, 
        isHost: currentPart.length === 0 // Become host if no one is in room
    };
    
    currentPart.push(me);
    localStorage.setItem(roomKey, JSON.stringify({ participants: currentPart }));
    
    setParticipants(currentPart);
    setMyId(me.id);
    
    // Trigger a storage event manually for same tab if needed (though local storage sets usually trigger cross-tab)
    window.dispatchEvent(new Event('storage'));
  };

  const myData = participants.find(p => p.id === myId);
  const isHost = myData?.isHost || false;
  const hasJoined = myId && myData;
  const takenTeams = participants.map(p => p.teamId);

  if (!hasJoined) {
     return (
        <div className="landing-wrapper">
          <div className="glass-card">
            <h1 className="title">Join Room <br/><span className="highlight">{roomId.toUpperCase()}</span></h1>
            <div className="input-group">
                <input 
                    type="text" 
                    placeholder="Enter your name" 
                    value={joinName} 
                    onChange={(e) => setJoinName(e.target.value)} 
                    className="name-input" 
                />
            </div>
            <h2 className="subtitle">Pick an available team</h2>
            <div className="teams-grid">
              {teamsList.map((team) => {
                const isTaken = takenTeams.includes(team.id);
                const isSelected = joinTeam === team.id;
                return (
                  <div 
                    key={team.id} 
                    className={`team-card ${isSelected ? 'selected' : ''}`} 
                    style={{ opacity: isTaken ? 0.3 : 1, pointerEvents: isTaken ? 'none' : 'auto' }} 
                    onClick={() => setJoinTeam(team.id)}
                  >
                    <div className="team-logo-box" style={{ borderColor: team.color }}>
                       <img src={team.logo} alt={team.name} className="team-logo-img" />
                    </div>
                    <button 
                        className="pick-btn" 
                        style={{ 
                            backgroundColor: isSelected ? team.color : 'transparent', 
                            color: isSelected ? '#fff' : 'var(--text-main)', 
                            borderColor: team.color 
                        }}
                    >
                       {isTaken ? 'Taken' : (isSelected ? 'Picked' : 'Pick')}
                    </button>
                  </div>
                )
              })}
            </div>
            <button className="create-room-btn" style={{marginTop: '1rem'}} onClick={handleJoinRoom}>
                Join Room
            </button>
          </div>
        </div>
     );
  }

  return (
    <div className="landing-wrapper room-wrapper">
      <div className="glass-card room-card">
        
        <div className="room-header">
          <h2 className="room-title">Room: <span className="highlight-text">{roomId.toUpperCase()}</span></h2>
          <div className="link-share-box">
            <input id="room-link" type="text" readOnly value={linkToShare} className="link-input-small" />
            <button onClick={copyToClipboard} className="copy-btn-small">Copy Link</button>
          </div>
          <p className="fcfs-note">
            <span className="arrow">→</span> Let the choosing of IPL Teams follow First Come First Serve!
          </p>
          <p className="host-note">
            <span className="arrow">→</span> Creator of the room is the host & has eligibility to play.
          </p>
        </div>

        <h1 className="title participants-title">Participants</h1>

        <div className="participants-grid">
          {participants.map((player) => {
            const team = getTeamById(player.teamId);
            return (
              <div key={player.id} className="participant-card" style={{ borderColor: team?.color || 'var(--glass-border)' }}>
                {player.isHost && <div className="host-badge">HOST</div>}
                <div className="participant-logo-box">
                  {team ? <img src={team.logo} alt={team.name} className="team-logo-img" /> : <span>?</span>}
                </div>
                <h3 className="player-name">{player.name} {player.id === myId ? '(You)' : ''}</h3>
                <p className="team-name" style={{ color: team?.color }}>{team?.name}</p>
              </div>
            );
          })}
        </div>

        {isHost ? (
          <div style={{display: 'flex', justifyContent: 'center', marginTop: '1rem'}}>
              <button className="create-room-btn start-btn" onClick={handleStart}>
                Start Auction
              </button>
          </div>
        ) : (
          <p className="waiting-text" style={{textAlign: 'center', marginTop: '1rem'}}>Waiting for host to start...</p>
        )}

      </div>
    </div>
  );
};

export default RoomPage;
