import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// PlayerPanel
//
// Renders a player's:
//   • name tag
//   • HP bar (with danger pulse under 25 %)
//   • Magnetic Force bar (with "full" glow at 100 %)
// ─────────────────────────────────────────────────────────────────────────────
interface PlayerPanelProps {
  playerId:   1 | 2;
  name:       string;
  hp:         number;   // 0 … 100
  maxHp?:     number;
  force:      number;   // 0 … 100
  maxForce?:  number;
  overloaded?: boolean;
  avatarUrl?: string;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  playerId,
  name,
  hp,
  maxHp    = 100,
  force,
  maxForce = 100,
  overloaded = false,
  avatarUrl,
}) => {
  const hpPct     = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const forcePct  = Math.max(0, Math.min(100, (force / maxForce) * 100));
  const isDanger  = hpPct < 25;
  const forceFull = forcePct >= 100;
  const pClass    = `p${playerId}`;

  const forceDisplay = overloaded ? "999,999 匹" : "";

  return (
    <div className={`player-panel ${pClass}`} role="region" aria-label={`Player ${playerId} stats`}>
      <div className="player-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <div 
          className="player-avatar" 
          style={{ 
            width: '50px', height: '50px', 
            border: '2px solid #fff', borderRadius: '4px',
            backgroundColor: '#333',
            backgroundImage: avatarUrl ? `url(${avatarUrl})` : 'none',
            backgroundSize: 'cover', backgroundPosition: 'center'
          }} 
        />
        <span className="player-name" style={{ margin: 0 }}>{name}</span>
      </div>

      {/* ── HP Bar ───────────────────────────────────────────── */}
      <div className="bar-wrapper">
        <span className="bar-label">HP</span>
        <div
          id={`hp-bar-p${playerId}`}
          className="bar-track"
          role="progressbar"
          aria-valuenow={Math.round(hpPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Player ${playerId} health`}
        >
          <div
            className={`bar-fill hp-fill${isDanger ? ' danger' : ''}`}
            style={{ '--pct': `${hpPct}%` } as React.CSSProperties}
          />
          <span className="bar-value">{Math.round(hpPct)}%</span>
        </div>
      </div>

      {/* ── Magnetic Force Bar ───────────────────────────────── */}
      <div className="bar-wrapper">
        <span className="bar-label">MAGNETIC FORCE</span>
        <div
          id={`force-bar-p${playerId}`}
          className={`bar-track force-track${forceFull ? ' force-full' : ''}${overloaded ? ' force-overload' : ''}`}
          role="progressbar"
          aria-valuenow={Math.round(forcePct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Player ${playerId} magnetic force`}
        >
          <div
            className={`bar-fill force-fill${overloaded ? ' overload-fill' : ''}`}
            style={{ '--pct': overloaded ? '100%' : `${forcePct}%` } as React.CSSProperties}
          />
          {overloaded && <span className="bar-value overload-value">{forceDisplay}</span>}
        </div>
      </div>
    </div>
  );
};
