import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getTeamById, teamsList } from '../utils/constants';
import { getRoom, getAuctionPlayers, getAuctionState, saveAuctionState } from '../utils/api';

const parseBasePrice = (str) => {
  if (!str) return 0;
  if (str.includes('Cr')) return parseFloat(str.replace('Cr', '').trim()) * 100;
  if (str.includes('L')) return parseFloat(str.replace('L', '').trim());
  return 0;
};

const formatPrice = (lakhs) => {
  if (lakhs >= 100) return (lakhs / 100) + ' Cr';
  return lakhs + ' L';
};

const getNextBid = (currentBidLakhs, basePriceLakhs) => {
  if (basePriceLakhs === 200) return currentBidLakhs < 500 ? currentBidLakhs + 50 : currentBidLakhs + 60;
  if (basePriceLakhs === 150) return currentBidLakhs < 400 ? currentBidLakhs + 30 : currentBidLakhs + 40;
  if (basePriceLakhs === 100) return currentBidLakhs < 300 ? currentBidLakhs + 20 : currentBidLakhs + 20;
  if (basePriceLakhs === 50) return currentBidLakhs < 200 ? currentBidLakhs + 10 : currentBidLakhs + 10;
  if (basePriceLakhs === 30) return currentBidLakhs < 100 ? currentBidLakhs + 10 : currentBidLakhs + 5;
  return currentBidLakhs + 10;
};

const AuctionPage = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const myId = location.state?.myId || null;

  const [participants, setParticipants] = useState([]);
  const [unauctionedList, setUnauctionedList] = useState([]);
  
  // The Single Sync State Object
  const [auctionState, setAuctionState] = useState({
    currentPlayerIdx: 0,
    currentBidLakhs: 0,
    currentBidderId: '',
    expirationTime: Date.now() + 15000, 
    timerDuration: 15,
    purchasedLog: [],
    isFinished: false,
    isPaused: false,
    pausedTimeLeft: 0,
    notification: null
  });

  const [timeLeft, setTimeLeft] = useState(15);
  const audioCtxRef = useRef(null);
  const lastBeepTime = useRef(0);
  const isHost = participants.find(p => p.id === myId)?.isHost || false;

  const [expandedTeamId, setExpandedTeamId] = useState(null);

  // Initial Sync from Room and Admin (API + fallback)
  useEffect(() => {
    const fetchInitialData = async () => {
      // 1. Fetch Room Participants
      const apiRoom = await getRoom(roomId);
      if (apiRoom && apiRoom.participants) {
        setParticipants(apiRoom.participants);
      } else {
        const pData = localStorage.getItem(`room_${roomId}`);
        if (pData) setParticipants(JSON.parse(pData).participants);
      }

      // 2. Fetch Auction Players
      let flat = [];
      const apiPlayers = await getAuctionPlayers();
      if (apiPlayers && apiPlayers.marquee) {
        const order = ['marquee', 'set1', 'set2', 'set3', 'set4'];
        order.forEach(s => flat = [...flat, ...(apiPlayers[s] || [])]);
      } else {
        const apData = localStorage.getItem('auctionPlayers');
        if (apData) {
          const parsed = JSON.parse(apData);
          const order = ['marquee', 'set1', 'set2', 'set3', 'set4'];
          order.forEach(s => flat = [...flat, ...(parsed[s] || [])]);
        }
      }
      setUnauctionedList(flat);

      // 3. Init or Fetch Auction State
      const apiState = await getAuctionState(roomId);
      if (apiState && Object.keys(apiState).length > 0) {
        setAuctionState(apiState);
      } else {
        const existingSync = localStorage.getItem(`auctionSync_${roomId}`);
        if (existingSync) {
          setAuctionState(JSON.parse(existingSync));
        } else if (flat.length > 0) {
          const initSt = {
            currentPlayerIdx: 0,
            currentBidLakhs: parseBasePrice(flat[0].basePrice),
            currentBidderId: '',
            expirationTime: Date.now() + 15000,
            timerDuration: 15,
            purchasedLog: [],
            isFinished: false,
            isPaused: false,
            pausedTimeLeft: 0,
            notification: null
          };
          localStorage.setItem(`auctionSync_${roomId}`, JSON.stringify(initSt));
          saveAuctionState(roomId, initSt);
          setAuctionState(initSt);
        }
      }
    };

    fetchInitialData();
  }, [roomId]);

  // Poll for Auction State updates from API every 1.5 seconds
  useEffect(() => {
    const pollState = async () => {
      const apiState = await getAuctionState(roomId);
      if (apiState && Object.keys(apiState).length > 0) {
        // Only update if expiration timer has changed or other major state change
        // To avoid jitter, we update local state securely
        setAuctionState(prevState => {
           // We might be slightly out of sync on timers, so trust the API
           // We could optimize by comparing timestamps
           return { ...prevState, ...apiState };
        });
        localStorage.setItem(`auctionSync_${roomId}`, JSON.stringify(apiState));
      }
    };

    const interval = setInterval(pollState, 500); // 500ms sync for rapid multi-user bidding
    return () => clearInterval(interval);
  }, [roomId]);

  // Sync state across tabs within same device
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === `auctionSync_${roomId}`) {
        setAuctionState(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [roomId]);

  // Helper to publish state changes immediately to all tabs & API
  const updateSyncState = async (newStateUpdates) => {
    const merged = { ...auctionState, ...newStateUpdates };
    setAuctionState(merged);
    localStorage.setItem(`auctionSync_${roomId}`, JSON.stringify(merged));
    await saveAuctionState(roomId, merged);
  };

  const beep = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtxRef.current.createOscillator();
    const gainNode = audioCtxRef.current.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioCtxRef.current.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtxRef.current.currentTime + 0.5);
    oscillator.stop(audioCtxRef.current.currentTime + 0.5);
  };

  useEffect(() => {
    if (auctionState.isPaused) {
      setTimeLeft(auctionState.pausedTimeLeft);
    }
  }, [auctionState.isPaused, auctionState.pausedTimeLeft]);

  // Timer Tick
  useEffect(() => {
    if (auctionState.isFinished || unauctionedList.length === 0 || auctionState.isPaused) return;

    const interval = setInterval(() => {
      const remainingBytes = auctionState.expirationTime - Date.now();
      const secondsLeft = Math.ceil(remainingBytes / 1000);

      if (secondsLeft <= 5 && secondsLeft > 0 && secondsLeft !== lastBeepTime.current) {
        beep();
        lastBeepTime.current = secondsLeft;
      }

      if (secondsLeft <= 0) {
        setTimeLeft(0);
        if (isHost && remainingBytes <= 0 && remainingBytes > -1500) { 
           handleTimeoutSold();
        }
      } else {
        setTimeLeft(secondsLeft);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [auctionState.expirationTime, auctionState.isFinished, isHost, unauctionedList, auctionState.currentBidderId, auctionState.isPaused]);

  const teamStats = participants.map(part => {
    const bought = auctionState.purchasedLog.filter(log => log.boughtBy === part.id);
    const amountSpent = bought.reduce((sum, log) => sum + log.amount, 0);
    const remainingPurse = 12000 - amountSpent;
    return { ...part, bought, amountSpent, remainingPurse };
  });

  const handleTimeoutSold = () => {
    const cp = unauctionedList[auctionState.currentPlayerIdx];
    const newLog = [...auctionState.purchasedLog];
    let notification = null;

    if (auctionState.currentBidderId) {
      newLog.push({ player: cp, boughtBy: auctionState.currentBidderId, amount: auctionState.currentBidLakhs });
      const winnerPart = participants.find(p => p.id === auctionState.currentBidderId);
      const winnerTeam = winnerPart ? getTeamById(winnerPart.teamId) : null;
      notification = {
        type: 'sold',
        playerName: cp.name,
        teamName: winnerTeam?.name || 'Unknown',
        teamColor: winnerTeam?.color || '#fff',
        amount: formatPrice(auctionState.currentBidLakhs)
      };
    } else {
      notification = { type: 'unsold', playerName: cp.name };
    }

    const showAndProceed = (nextUpdates) => {
      updateSyncState({ ...nextUpdates, notification, isPaused: true });
      setTimeout(() => {
        if (isHost) {
          // Check if this was the last player
          const nextIdx = nextUpdates.currentPlayerIdx !== undefined ? nextUpdates.currentPlayerIdx : auctionState.currentPlayerIdx + 1;
          if (nextIdx < unauctionedList.length) {
            updateSyncState({ ...nextUpdates, notification: null, isPaused: false });
          } else {
            // Once sold notification is done for last player, show final complete message!
            updateSyncState({ purchasedLog: newLog, isFinished: true, notification: { type: 'finished' } });
          }
        }
      }, 3000); // Give 3s to read the sold/unsold message
    };

    const nextIdx = auctionState.currentPlayerIdx + 1;
    if (nextIdx < unauctionedList.length) {
      showAndProceed({
        purchasedLog: newLog,
        currentPlayerIdx: nextIdx,
        currentBidderId: '',
        currentBidLakhs: parseBasePrice(unauctionedList[nextIdx].basePrice),
        expirationTime: Date.now() + (auctionState.timerDuration * 1000)
      });
    } else {
      showAndProceed({
        purchasedLog: newLog,
        currentPlayerIdx: nextIdx,
        isPaused: true
      });
    }
  };

  const handlePause = () => {
    if (auctionState.isFinished || auctionState.isPaused) return;
    const remaining = Math.ceil((auctionState.expirationTime - Date.now()) / 1000);
    updateSyncState({
      isPaused: true,
      pausedTimeLeft: remaining > 0 ? remaining : 0
    });
  };

  const handleResume = () => {
    if (auctionState.isFinished || !auctionState.isPaused) return;
    updateSyncState({
      isPaused: false,
      expirationTime: Date.now() + (auctionState.pausedTimeLeft * 1000)
    });
  };

  const handleFinish = () => {
    const confirmation = window.confirm("Are you sure you want to forcibly end the auction completely?");
    if (confirmation) {
      // First show the notification, then finish to allow rendering the message
      updateSyncState({ isFinished: true, isPaused: true, notification: { type: 'finished' } });
    }
  };

  const handleBidClick = () => {
    if (!myId) return alert("You must join the room to bid!");
    if (auctionState.isFinished) return;
    if (auctionState.currentBidderId === myId) return alert("You are already the highest bidder!");

    const myStats = teamStats.find(t => t.id === myId);
    if (!myStats) return;

    const cp = unauctionedList[auctionState.currentPlayerIdx];
    const baseLakhs = parseBasePrice(cp.basePrice);
    
    // Determine next amount. If NO ONE has bid yet, clicking the button accepts the base price.
    // Otherwise, increment logically.
    let nextAmount = auctionState.currentBidLakhs;
    if (auctionState.currentBidderId !== '') {
       nextAmount = getNextBid(auctionState.currentBidLakhs, baseLakhs);
    }

    if (nextAmount > myStats.remainingPurse) {
      alert("Bid Exceeds Purse! You cannot afford this bid.");
      return;
    }

    updateSyncState({
      currentBidLakhs: nextAmount,
      currentBidderId: myId,
      expirationTime: Date.now() + (auctionState.timerDuration * 1000)
    });
  };

  const handleTimerSelect = (val) => {
     // Admin can change default timer length
     updateSyncState({
        timerDuration: val,
        expirationTime: Date.now() + (val * 1000)
     });
  };

  // Redirect all clients when auction is finished AND the notification has completed
  useEffect(() => {
    if (auctionState.isFinished) {
      // Show the 'Auction Complete' notification for 3.5 seconds to let the host process it.
      const timer = setTimeout(() => {
        navigate(`/auction-complete/${roomId}`, { 
          state: { purchasedLog: auctionState.purchasedLog, participants, myId, isHostUser: isHost } 
        });
      }, 3500); 
      return () => clearTimeout(timer);
    }
  }, [auctionState.isFinished, navigate, roomId, participants, myId, isHost, auctionState.purchasedLog]);

  if (unauctionedList.length === 0) return <div className="landing-wrapper"><div className="glass-card"><h2 className="title">No players in DB</h2></div></div>;

  const currentPlayer = unauctionedList[auctionState.currentPlayerIdx];
  const currentBidderStats = teamStats.find(t => t.id === auctionState.currentBidderId);
  const bidderTeamData = currentBidderStats ? getTeamById(currentBidderStats.teamId) : null;
  const myStats = teamStats.find(t => t.id === myId);
  const myTeamColor = myStats ? getTeamById(myStats.teamId)?.color : '#fff';

  return (
    <div className="auction-page-wrapper">

      {/* NOTIFICATION OVERLAY */}
      {auctionState.notification && (
        <div className="notif-overlay">
          {auctionState.notification.type === 'sold' && (
            <div className="notif-card sold">
              <div className="notif-icon">🔨</div>
              <h2 className="notif-player">{auctionState.notification.playerName}</h2>
              <p className="notif-label">SOLD TO</p>
              <h1 className="notif-team" style={{ color: auctionState.notification.teamColor }}>
                {auctionState.notification.teamName}
              </h1>
              <p className="notif-amount">@ {auctionState.notification.amount}</p>
            </div>
          )}
          {auctionState.notification.type === 'unsold' && (
            <div className="notif-card unsold">
              <div className="notif-icon">❌</div>
              <h2 className="notif-player">{auctionState.notification.playerName}</h2>
              <p className="notif-label">UNSOLD</p>
            </div>
          )}
          {auctionState.notification.type === 'finished' && (
            <div className="notif-card finished">
              <div className="notif-icon">🏆</div>
              <h2 className="notif-player">Auction Complete!</h2>
              <p className="notif-label">Redirecting to results...</p>
            </div>
          )}
        </div>
      )}

      <div className="auction-main-content">
        
        {/* TOP SECTION: PLAYER BIDDING */}
        <div className="glass-card top-bid-section" style={{ borderTop: `4px solid ${myTeamColor}` }}>
          
          <div className="player-header">
            <h1 className="cricketer-name">{currentPlayer.name}</h1>
            
            <div className="timer-box">
              {isHost ? (
                  <>
                    <select className="timer-select" value={auctionState.timerDuration} onChange={(e) => handleTimerSelect(Number(e.target.value))} disabled={auctionState.isPaused || (timeLeft > 0 && timeLeft < auctionState.timerDuration)}>
                      <option value={5}>5s</option>
                      <option value={10}>10s</option>
                      <option value={15}>15s</option>
                      <option value={20}>20s</option>
                      <option value={30}>30s</option>
                    </select>
                    {!auctionState.isPaused ? (
                        <button className="timer-btn stop" onClick={handlePause} title="Pause">॥</button>
                    ) : (
                        <button className="timer-btn" onClick={handleResume} title="Resume">▶</button>
                    )}
                    <button className="timer-btn stop" style={{backgroundColor:'#ef4444', borderRadius:'8px', width:'auto', padding:'0 10px'}} onClick={handleFinish} title="End">End</button>
                  </>
              ) : (
                  <span style={{color: '#fff', paddingRight: '1rem'}}>&nbsp;Timer{auctionState.isPaused ? ' (Paused)' : ''}:</span>
              )}
              <div className={`timer-display ${timeLeft <= 5 && timeLeft > 0 ? 'red-alert' : ''}`}>
                {timeLeft > 0 ? `${timeLeft}s` : '0s'}
              </div>
            </div>
          </div>

          <div className="player-profile-row">
            <div className="player-image-box">
               <div className="player-placeholder-img">
                 {currentPlayer.name.split(' ').map(n=>n[0]).join('')}
               </div>
            </div>
            
            <div className="player-details">
               <p className="detail-line"><strong>Category:</strong> {currentPlayer.category}</p>
               <p className="detail-line"><strong>Base Price:</strong> {currentPlayer.basePrice}</p>
               
               <div className="bid-controls mt-4">
                  <div className="control-row">
                    <span className="control-label">Current Bid:</span>
                    <button className="bid-amount-box" onClick={handleBidClick} title="Click to increment bid">
                      {formatPrice(auctionState.currentBidLakhs)}
                    </button>
                  </div>
                  
                  <div className="control-row mt-3">
                    <span className="control-label">Current Bidder:</span>
                    <div className="bidder-select" style={{ display: 'flex', alignItems: 'center' }}>
                       {currentBidderStats ? (
                          <span style={{ color: bidderTeamData.color, fontWeight: 'bold' }}>
                            {currentBidderStats.name} ({bidderTeamData.name})
                          </span>
                       ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-- Waiting for Bids --</span>
                       )}
                    </div>
                  </div>

                  <div className="control-row mt-3">
                    <span className="control-label">Purse Remaining:</span>
                    <div className="purse-display">
                      {currentBidderStats ? formatPrice(currentBidderStats.remainingPurse) : '---'}
                    </div>
                  </div>

               </div>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: TEAMS DASHBOARD */}
        <div className="glass-card bottom-teams-section mt-4">
           <table className="teams-dashboard-table">
             <thead>
               <tr>
                 <th>Player Name (Team)</th>
                 <th>Total no. of players bought</th>
                 <th>Remaining Purse</th>
                 <th>Amount spent</th>
                 <th>Details</th>
               </tr>
             </thead>
             <tbody>
               {teamStats.map(stat => {
                 const t = getTeamById(stat.teamId);
                 const isExpanded = expandedTeamId === stat.id;
                 const bats = stat.bought.filter(b => b.player.category === 'Batsman');
                 const bowl = stat.bought.filter(b => b.player.category === 'Bowler');
                 const ar = stat.bought.filter(b => b.player.category === 'All Rounder');
                 const wk = stat.bought.filter(b => b.player.category === 'Wicketkeeper');

                 return (
                   <React.Fragment key={stat.id}>
                     <tr className="team-row" onClick={() => setExpandedTeamId(isExpanded ? null : stat.id)}>
                       <td>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <img src={t?.logo} alt="logo" style={{ width: '30px', height: '30px' }} />
                            <span>{stat.name} <strong style={{ color: t?.color }}>({t?.name})</strong> {stat.id === myId && '(You)'}</span>
                         </div>
                       </td>
                       <td>{stat.bought.length}</td>
                       <td>{formatPrice(stat.remainingPurse)}</td>
                       <td>{formatPrice(stat.amountSpent)}</td>
                       <td style={{ textAlign: 'center' }}>
                         <span className="dropdown-arrow">{isExpanded ? '▲' : '▼'}</span>
                       </td>
                     </tr>
                     {isExpanded && (
                       <tr className="expanded-details-row">
                         <td colSpan="5">
                           <div className="expanded-details-card">
                              <div className="category-group">
                                <h4>Batsmen</h4>
                                {bats.length === 0 ? <span className="empty-dash">-</span> : bats.map((b, i) => <div key={i}>{b.player.name} &nbsp; <small style={{color:'var(--primary)'}}>{formatPrice(b.amount)}</small></div>)}
                              </div>
                              <div className="category-group">
                                <h4>Wicketkeepers</h4>
                                {wk.length === 0 ? <span className="empty-dash">-</span> : wk.map((b, i) => <div key={i}>{b.player.name} &nbsp; <small style={{color:'var(--primary)'}}>{formatPrice(b.amount)}</small></div>)}
                              </div>
                              <div className="category-group">
                                <h4>All Rounders</h4>
                                {ar.length === 0 ? <span className="empty-dash">-</span> : ar.map((b, i) => <div key={i}>{b.player.name} &nbsp; <small style={{color:'var(--primary)'}}>{formatPrice(b.amount)}</small></div>)}
                              </div>
                              <div className="category-group">
                                <h4>Bowlers</h4>
                                {bowl.length === 0 ? <span className="empty-dash">-</span> : bowl.map((b, i) => <div key={i}>{b.player.name} &nbsp; <small style={{color:'var(--primary)'}}>{formatPrice(b.amount)}</small></div>)}
                              </div>
                              <div className="share-actions">
                                <button className="outline-btn">Save</button>
                                <button className="outline-btn">Share</button>
                              </div>
                           </div>
                         </td>
                       </tr>
                     )}
                   </React.Fragment>
                 )
               })}
             </tbody>
           </table>
        </div>

      </div>
    </div>
  );
};

export default AuctionPage;
