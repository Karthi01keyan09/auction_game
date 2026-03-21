import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { teamsList, getTeamById } from '../utils/constants';
import { getRoom, saveRoom, joinRoom as apiJoinRoom, getAuctionStarted, setAuctionStarted } from '../utils/api';

const RoomPage = () => {
  const { roomId } = useParams();
  const location = useLocation();
  
  const [participants, setParticipants] = useState(() => {
    const saved = localStorage.getItem(`room_${roomId}`);
    return saved ? JSON.parse(saved).participants : [];
  });
  const [myId, setMyId] = useState(location.state?.myId || localStorage.getItem(`myId_${roomId}`) || null);
  
  const [joinName, setJoinName] = useState('');
  const [joinTeam, setJoinTeam] = useState(null);

  const linkToShare = window.location.href;

  const navigate = useNavigate();

  // Fetch room data from API first, then localStorage
  const syncRoom = useCallback(async () => {
    // Try API first
    const apiData = await getRoom(roomId);
    if (apiData && apiData.participants) {
      setParticipants(apiData.participants);
      // Also update localStorage for cross-tab sync
      localStorage.setItem(`room_${roomId}`, JSON.stringify(apiData));
      return;
    }
    // Fallback to localStorage
    const data = localStorage.getItem(`room_${roomId}`);
    if (data) {
      setParticipants(JSON.parse(data).participants);
    }
  }, [roomId]);

  useEffect(() => {
    syncRoom();
    
    // Poll API every 3 seconds for participant updates from other devices
    const pollInterval = setInterval(syncRoom, 3000);

    // Also listen to localStorage changes for same-device tab sync
    const handleStorageChange = (e) => {
      if (e.key === `room_${roomId}`) {
        const data = localStorage.getItem(`room_${roomId}`);
        if (data) setParticipants(JSON.parse(data).participants);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [roomId, syncRoom]);

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

  // Check if auction has started (API + localStorage)
  useEffect(() => {
    const checkStarted = async () => {
      const apiRes = await getAuctionStarted(roomId);
      if (apiRes && apiRes.started) {
        navigate(`/auction/${roomId}`, { state: { myId } });
        return;
      }
      if (localStorage.getItem(`auctionStarted_${roomId}`) === 'true') {
        navigate(`/auction/${roomId}`, { state: { myId } });
      }
    };
    checkStarted();

    // Poll for auction start every 2 seconds
    const pollStart = setInterval(checkStarted, 2000);

    const handleAuctionStartSync = (e) => {
      if (e.key === `auctionStarted_${roomId}` && e.newValue === 'true') {
        navigate(`/auction/${roomId}`, { state: { myId } });
      }
    };
    window.addEventListener('storage', handleAuctionStartSync);

    return () => {
      clearInterval(pollStart);
      window.removeEventListener('storage', handleAuctionStartSync);
    };
  }, [roomId, navigate, myId]);

  const handleStart = async () => {
    localStorage.setItem(`auctionStarted_${roomId}`, 'true');
    await setAuctionStarted(roomId, true);
    navigate(`/auction/${roomId}`, { state: { myId } });
  };

  const handleJoinRoom = async () => {
    if (!joinName) return alert("Please enter your name");
    if (!joinTeam) return alert("Please pick a team");
    
    const roomKey = `room_${roomId}`;
    
    // Get current participants from API or localStorage
    let currentPart = [];
    const apiData = await getRoom(roomId);
    if (apiData && apiData.participants) {
      currentPart = apiData.participants;
    } else {
      const data = localStorage.getItem(roomKey);
      currentPart = data ? JSON.parse(data).participants : [];
    }
    
    if (currentPart.some(p => p.teamId === joinTeam)) {
      return alert("This team was already taken!");
    }
    
    const me = { 
      id: Date.now().toString(), 
      name: joinName, 
      teamId: joinTeam, 
      isHost: currentPart.length === 0
    };
    
    // Try to join via API
    const apiResult = await apiJoinRoom(roomId, me);
    if (apiResult && apiResult.participants) {
      currentPart = apiResult.participants;
    } else {
      // Fallback: add locally
      currentPart.push(me);
    }

    localStorage.setItem(roomKey, JSON.stringify({ participants: currentPart }));
    localStorage.setItem(`myId_${roomId}`, me.id);
    setParticipants(currentPart);
    setMyId(me.id);
    
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
