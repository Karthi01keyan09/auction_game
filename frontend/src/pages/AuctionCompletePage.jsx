import React, { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getTeamById } from '../utils/constants';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

const formatPrice = (lakhs) => {
  if (lakhs >= 100) return (lakhs / 100) + ' Cr';
  return lakhs + ' L';
};

const AuctionCompletePage = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { purchasedLog = [], participants = [], myId = null, isHostUser = false } = location.state || {};

  const [expandedId, setExpandedId] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null); // { top3, teamReports }
  const [validationError, setValidationError] = useState('');

  const teamStats = participants.map(part => {
    const bought = purchasedLog.filter(log => log.boughtBy === part.id);
    const amountSpent = bought.reduce((sum, log) => sum + log.amount, 0);
    const remainingPurse = 12000 - amountSpent;
    return { ...part, bought, amountSpent, remainingPurse };
  });

  const handleSave = (stat) => {
    const t = getTeamById(stat.teamId);
    let text = `${stat.name} (${t?.name}) - IPL Auction Summary\n`;
    text += `Players Bought: ${stat.bought.length}\n`;
    text += `Amount Spent: ${formatPrice(stat.amountSpent)}\n`;
    text += `Remaining Purse: ${formatPrice(stat.remainingPurse)}\n\n`;
    stat.bought.forEach(b => {
      text += `• ${b.player.name} (${b.player.category}, ${b.player.nationality || 'Indian'}) — ${formatPrice(b.amount)}\n`;
    });
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${stat.name}_auction_summary.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async (stat) => {
    const t = getTeamById(stat.teamId);
    const text = `🏏 ${stat.name} (${t?.name}) bought ${stat.bought.length} players for ${formatPrice(stat.amountSpent)} in the IPL Auction!`;
    if (navigator.share) {
      await navigator.share({ title: 'IPL Auction Result', text });
    } else {
      await navigator.clipboard.writeText(text);
      alert('Share text copied to clipboard!');
    }
  };

  const buildPrompt = () => {
    let prompt = `You are an expert IPL cricket analyst. Analyze and rank these auction teams based on STRICT rules and player quality.

VALIDATION RULES (violations result in disqualification):
1. A team MUST have at least 1 Wicketkeeper.
2. A team MUST have at least 3 Bowlers.
3. A team CANNOT have more than 4 Foreign players.

After checking eligibility, rank valid teams from 1st to 3rd based on:
- Player quality & current form (use real cricket knowledge about these players)
- Team balance (batting depth, bowling variety, all-rounders)
- Value for money spent
- Overall squad strength

Teams Data:
`;
    teamStats.forEach(stat => {
      const t = getTeamById(stat.teamId);
      prompt += `\n--- ${stat.name} (IPL Team: ${t?.name}) ---\n`;
      prompt += `Budget Spent: ${formatPrice(stat.amountSpent)} | Remaining: ${formatPrice(stat.remainingPurse)}\n`;
      prompt += `Players (${stat.bought.length} total):\n`;
      stat.bought.forEach(b => {
        prompt += `  • ${b.player.name} | ${b.player.category} | ${b.player.nationality || 'Indian'} | Bought at ${formatPrice(b.amount)}\n`;
      });
    });

    prompt += `
Respond ONLY with valid JSON in this exact format:
{
  "rankings": [
    { "rank": 1, "ownerName": "name", "teamName": "IPL team", "score": 85, "reason": "2-line reason" },
    { "rank": 2, "ownerName": "name", "teamName": "IPL team", "score": 80, "reason": "2-line reason" },
    { "rank": 3, "ownerName": "name", "teamName": "IPL team", "score": 75, "reason": "2-line reason" }
  ],
  "disqualified": [
    { "ownerName": "name", "teamName": "IPL team", "reason": "violation reason" }
  ],
  "analysis": "2-sentence overall auction analysis"
}`;
    return prompt;
  };

  // ─── LOCAL CRICKET INTELLIGENCE ENGINE ───────────────────────────────────
  // A database of real player tiers / known quality level (from public cricket knowledge)
  const ELITE_PLAYERS = new Set([
    'virat kohli','rohit sharma','ms dhoni','kl rahul','hardik pandya',
    'jasprit bumrah','ravindra jadeja','suryakumar yadav','shubman gill',
    'shreyas iyer','rishabh pant','mohammed shami','kuldeep yadav',
    'yuzvendra chahal','ravichandran ashwin','axar patel',
    'pat cummins','mitchell starc','david warner','steve smith',
    'jos buttler','ben stokes','joe root','moeen ali','sam curran',
    'quinton de kock','kagiso rabada','anrich nortje','rashid khan',
    'mohammed nabi','wanindu hasaranga','mustafizur rahman','shakib al hasan',
    'babar azam','shaheen afridi','naseem shah','sunil narine','andre russell',
    'nicholas pooran','shimron hetmyer','mark wood','liam livingstone',
    'dawid malan','faf du plessis','heinrich klaasen','aiden markram',
    'trent boult','lockie ferguson','devon conway','glen maxwell',
    'tim david','matthew wade','travis head','cameron green','jim curry'
  ]);

  const GOOD_PLAYERS = new Set([
    'prithvi shaw','ishan kishan','sanju samson','devdutt padikkal',
    'ruturaj gaikwad','ritesh pant','umran malik','arshdeep singh',
    'bhuvneshwar kumar','deepak chahar','harshal patel','avesh khan',
    'washington sundar','krunal pandya','venkatesh iyer','rahul tripathi',
    'tilak varma','dewald brevis','rinku singh','yashasvi jaiswal',
    'rachin ravindra','phil salt','tom curran','reece topley','will jacks',
    'marco jansen','tristan stubbs','ryan rickelton','matheesha pathirana',
    'dushmantha chameera','akeal hosein','odean smith'
  ]);

  const getPlayerTier = (name) => {
    const lower = (name || '').toLowerCase();
    if (ELITE_PLAYERS.has(lower)) return 3; // Elite
    if (GOOD_PLAYERS.has(lower)) return 2;  // Good
    return 1;                                // Unknown / average
  };

  const localValidateAndScore = (stats) => {
    const results = [];
    const disqualified = [];

    stats.forEach(stat => {
      const t = getTeamById(stat.teamId);
      const players = stat.bought.map(b => b.player);

      // ── Rule checks ──
      const wk = players.filter(p => p.category === 'Wicketkeeper');
      const bowlers = players.filter(p => p.category === 'Bowler');
      const foreign = players.filter(p => (p.nationality || '').toLowerCase() === 'foreign');

      const violations = [];
      if (wk.length < 1) violations.push('No Wicketkeeper in squad');
      if (bowlers.length < 3) violations.push(`Only ${bowlers.length} Bowler(s) — minimum 3 required`);
      if (foreign.length > 4) violations.push(`${foreign.length} Foreign players — maximum 4 allowed`);

      if (violations.length > 0) {
        disqualified.push({ ownerName: stat.name, teamName: t?.name || '', reason: violations.join('; ') });
        return;
      }

      // ── Scoring ──
      let score = 40; // Base

      // 1. Player quality tier scoring (max 25 pts)
      const tierScore = players.reduce((sum, p) => sum + getPlayerTier(p.name) * 3, 0);
      score += Math.min(tierScore, 25);

      // 2. Squad balance (max 15 pts)
      const bats = players.filter(p => p.category === 'Batsman').length;
      const ar = players.filter(p => p.category === 'All Rounder').length;
      const bowlCount = bowlers.length;
      if (bats >= 3 && bats <= 6) score += 5;
      if (ar >= 2) score += 5;
      if (bowlCount >= 4) score += 5;

      // 3. Budget efficiency (max 10 pts) — lower spend with good players = better
      const efficiency = (12000 - stat.amountSpent) / 120; // % remaining
      score += Math.round(efficiency * 0.1);

      // 4. Foreign balance bonus (2-4 foreign players = 5 pts)
      if (foreign.length >= 2 && foreign.length <= 4) score += 5;

      // 5. Squad depth (more players = safer bench)
      if (players.length >= 12) score += 5;
      else if (players.length >= 9) score += 3;

      // ── Build reason ──
      const elites = players.filter(p => getPlayerTier(p.name) === 3).map(p => p.name);
      const eliteStr = elites.length > 0 ? `Key stars: ${elites.slice(0,3).join(', ')}.` : 'Balanced squad with no marquee names.';
      const reason = `${eliteStr} ${players.length} players | ${foreign.length} foreign | ${bowlCount} bowlers | Budget used: ${formatPrice(stat.amountSpent)}.`;

      results.push({ stat, teamName: t?.name || '', score: Math.min(score, 99), reason });
    });

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    const rankings = results.slice(0, 3).map((r, i) => ({
      rank: i + 1,
      ownerName: r.stat.name,
      teamName: r.teamName,
      score: r.score,
      reason: r.reason
    }));

    const totalPlayers = stats.reduce((s, t) => s + t.bought.length, 0);
    const analysis = `A total of ${totalPlayers} players were auctioned across ${stats.length} teams. ${
      rankings[0] ? `${rankings[0].ownerName}'s squad edges out the competition with the strongest overall balance and player quality.` : ''
    }`;

    return { rankings, disqualified, analysis };
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleAIValidate = async () => {
    setIsValidating(true);
    setValidationError('');
    setValidationResult(null);

    try {
      if (GEMINI_API_KEY) {
        // ── Real Gemini AI ──
        const prompt = buildPrompt();
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.25, maxOutputTokens: 1200 }
            })
          }
        );
        const data = await res.json();
        const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Could not parse Gemini response');
        setValidationResult(JSON.parse(jsonMatch[0]));
      } else {
        // ── Local Intelligence Engine ──
        await new Promise(r => setTimeout(r, 2000)); // Simulate thinking
        const result = localValidateAndScore(teamStats);
        setValidationResult(result);
      }
    } catch (err) {
      setValidationError('Validation error: ' + err.message);
    } finally {
      setIsValidating(false);
    }
  };

  const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const medalLabels = ['🥇 1st', '🥈 2nd', '🥉 3rd'];

  return (
    <div className="landing-wrapper" style={{ alignItems: 'flex-start', paddingTop: '2rem' }}>
      <div className="glass-card" style={{ maxWidth: '900px', width: '100%' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '4rem' }}>🏆</div>
          <h1 className="title">Auction Complete!</h1>
          <p style={{ color: 'var(--text-muted)' }}>Here's the full breakdown of every team's squad</p>
        </div>

        {/* Teams Summary */}
        {teamStats.map(stat => {
          const t = getTeamById(stat.teamId);
          const isOpen = expandedId === stat.id;
          const bats = stat.bought.filter(b => b.player.category === 'Batsman');
          const bowl = stat.bought.filter(b => b.player.category === 'Bowler');
          const ar   = stat.bought.filter(b => b.player.category === 'All Rounder');
          const wk   = stat.bought.filter(b => b.player.category === 'Wicketkeeper');

          return (
            <div key={stat.id} className="complete-team-block" style={{ borderColor: t?.color }}>
              <div className="complete-team-header" onClick={() => setExpandedId(isOpen ? null : stat.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <img src={t?.logo} alt={t?.name} style={{ width: '40px', height: '40px' }} />
                  <div>
                    <h3 style={{ margin: 0, color: t?.color }}>{t?.name}</h3>
                    <small style={{ color: 'var(--text-muted)' }}>Owned by {stat.name}</small>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.3rem' }}>{stat.bought.length}</div>
                    <small style={{ color: 'var(--text-muted)' }}>Players</small>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.3rem', color: '#10b981' }}>{formatPrice(stat.remainingPurse)}</div>
                    <small style={{ color: 'var(--text-muted)' }}>Remaining</small>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.3rem', color: '#ef4444' }}>{formatPrice(stat.amountSpent)}</div>
                    <small style={{ color: 'var(--text-muted)' }}>Spent</small>
                  </div>
                  <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>

              {isOpen && (
                <div className="complete-team-details">
                  {[['Batsmen', bats], ['Wicketkeepers', wk], ['All Rounders', ar], ['Bowlers', bowl]].map(([label, group]) => (
                    <div key={label} className="category-group">
                      <h4>{label}</h4>
                      {group.length === 0
                        ? <span className="empty-dash">—</span>
                        : group.map((b, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{b.player.name} <small style={{ color: 'var(--text-muted)' }}>({b.player.nationality || 'IND'})</small></span>
                            <small style={{ color: 'var(--primary)' }}>{formatPrice(b.amount)}</small>
                          </div>
                        ))
                      }
                    </div>
                  ))}
                  <div className="share-actions" style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                    <button className="outline-btn" onClick={() => handleSave(stat)}>💾 Save</button>
                    <button className="outline-btn" onClick={() => handleShare(stat)}>📤 Share</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* AI Validation (Host-only) */}
        {isHostUser && !validationResult && (
          <div style={{ textAlign: 'center', margin: '2rem 0' }}>
            <button
              className="create-room-btn"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', width: 'auto', minWidth: '280px' }}
              onClick={handleAIValidate}
              disabled={isValidating}
            >
              {isValidating ? (
                <span>🤖 AI Analyzing Teams...</span>
              ) : (
                <span>🤖 AI Validate & Announce Winners</span>
              )}
            </button>
            {validationError && (
              <p style={{ color: '#ef4444', marginTop: '1rem', fontSize: '0.9rem' }}>{validationError}</p>
            )}
            {isValidating && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div className="ai-loading-bar"></div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Analyzing player stats, team balance & form...
                </p>
              </div>
            )}
          </div>
        )}

        {/* ==================== WINNER ANNOUNCEMENT ==================== */}
        {validationResult && (
          <div className="winner-section">
            <h2 className="winner-title">🏆 Winner Announcement</h2>

            {/* 1st Place - Big Card */}
            {validationResult.rankings?.[0] && (() => {
              const w = validationResult.rankings[0];
              const winnerStat = teamStats.find(s => s.name === w.ownerName);
              const t = winnerStat ? getTeamById(winnerStat.teamId) : null;
              return (
                <div className="winner-first-card" style={{ borderColor: t?.color || '#FFD700' }}>
                  <div className="winner-medal">🥇</div>
                  {t && <img src={t.logo} alt={t.name} style={{ width: '70px', height: '70px', marginBottom: '0.5rem' }} />}
                  <h2 style={{ color: t?.color || '#FFD700', fontSize: '2rem', fontWeight: 900, margin: '0.5rem 0' }}>{w.teamName}</h2>
                  <h3 style={{ color: '#fff', margin: '0.2rem 0', opacity: 0.8 }}>{w.ownerName}</h3>
                  <div className="winner-score">{w.score}/100</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.5rem', textAlign: 'center' }}>{w.reason}</p>
                </div>
              );
            })()}

            {/* 2nd and 3rd Place */}
            <div className="winner-runner-row">
              {validationResult.rankings?.slice(1, 3).map((w, idx) => {
                const winnerStat = teamStats.find(s => s.name === w.ownerName);
                const t = winnerStat ? getTeamById(winnerStat.teamId) : null;
                return (
                  <div key={idx} className="winner-runner-card" style={{ borderColor: medalColors[idx + 1] }}>
                    <div className="winner-medal" style={{ fontSize: '1.8rem' }}>{medalLabels[idx + 1]}</div>
                    {t && <img src={t.logo} alt={t.name} style={{ width: '45px', height: '45px' }} />}
                    <h3 style={{ color: t?.color || '#fff', fontWeight: 800, margin: '0.5rem 0', fontSize: '1.2rem' }}>{w.teamName}</h3>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>{w.ownerName}</p>
                    <div style={{ color: medalColors[idx + 1], fontWeight: 700, marginTop: '0.4rem' }}>{w.score}/100</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem', textAlign: 'center' }}>{w.reason}</p>
                  </div>
                );
              })}
            </div>

            {/* Disqualified */}
            {validationResult.disqualified?.length > 0 && (
              <div className="disqualified-section">
                <h4 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>⚠️ Disqualified Teams</h4>
                {validationResult.disqualified.map((d, i) => (
                  <div key={i} style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                    ❌ <strong style={{ color: '#fff' }}>{d.ownerName}</strong> ({d.teamName}) — {d.reason}
                  </div>
                ))}
              </div>
            )}

            {/* AI Analysis */}
            {validationResult.analysis && (
              <div className="ai-analysis-box">
                <span style={{ color: '#6366f1', marginRight: '0.5rem' }}>🤖 AI Analysis:</span>
                {validationResult.analysis}
              </div>
            )}
          </div>
        )}

        {/* Bottom Buttons */}
        <div style={{ textAlign: 'center', marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button className="create-room-btn" style={{ width: 'auto', minWidth: '200px' }} onClick={() => navigate('/')}>
            🏠 Back to Home
          </button>
        </div>

      </div>
    </div>
  );
};

export default AuctionCompletePage;
