import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SubstitutionRing
//
// SVG circular progress timer.  Driven by:
//   • progress  — 0 (empty) … 1 (full)
//   • status    — 'ready' | 'active' | 'cooling'
//   • seconds   — number displayed in the centre
//   • onActivate — called when user clicks / presses the key
// ─────────────────────────────────────────────────────────────────────────────
interface SubstitutionRingProps {
  progress:   number;
  status:     'ready' | 'active' | 'cooling';
  seconds:    number;
  onActivate: () => void;
  playerId:   1 | 2;
}

const RADIUS = 20;
const CIRC   = 2 * Math.PI * RADIUS; // ~125.66

export const SubstitutionRing: React.FC<SubstitutionRingProps> = ({
  progress, status, seconds, onActivate, playerId,
}) => {
  const dashOffset = CIRC * (1 - progress);
  const label      = status === 'ready'   ? 'READY'
                   : status === 'active'  ? 'SUB!'
                   : `${seconds}s`;

  return (
    <div className="sub-indicator">
      <span className="sub-label">
        P{playerId} SUB
      </span>

      <div
        id={`sub-ring-p${playerId}`}
        className={`sub-ring-container ${status}`}
        role="button"
        tabIndex={0}
        aria-label={`Player ${playerId} substitution: ${status === 'ready' ? 'ready' : `${seconds} seconds remaining`}`}
        onClick={onActivate}
        onKeyDown={e => e.key === 'Enter' && onActivate()}
        style={{ cursor: status === 'ready' ? 'pointer' : 'default', pointerEvents: 'all' }}
      >
        <svg className="sub-ring-svg" viewBox="0 0 50 50" aria-hidden="true">
          {/* track */}
          <circle
            className="sub-ring-bg"
            cx="25" cy="25"
            r={RADIUS}
          />
          {/* animated fill */}
          <circle
            className={`sub-ring-progress ${status}`}
            cx="25" cy="25"
            r={RADIUS}
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
          />
        </svg>

        {/* Centre text */}
        <div className="sub-ring-text">
          <span className="sub-seconds">
            {status === 'ready' ? '✓' : status === 'active' ? '!' : seconds}
          </span>
          <span className={`sub-status-text ${status}`}>{label}</span>
        </div>
      </div>
    </div>
  );
};
