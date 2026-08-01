import { useEffect, useRef, useState, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// useSubstitution
//
// Manages the 15-second substitution cooldown timer.
// Returns:
//   • secondsLeft  — remaining seconds (0 … COOLDOWN)
//   • status       — 'ready' | 'active' | 'cooling'
//   • progress     — 0…1 fraction of bar filled
//   • activate()   — call to trigger the substitution
// ─────────────────────────────────────────────────────────────────────────────
const COOLDOWN = 15; // seconds

type SubStatus = 'ready' | 'active' | 'cooling';

export function useSubstitution() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [status, setStatus]           = useState<SubStatus>('ready');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const activate = useCallback(() => {
    if (status !== 'ready') return;

    setStatus('active');
    setSecondsLeft(COOLDOWN);

    // Brief "active" window (0.5 s), then start countdown
    const activeTimeout = setTimeout(() => {
      setStatus('cooling');
      let remaining = COOLDOWN;

      intervalRef.current = setInterval(() => {
        remaining -= 1;
        setSecondsLeft(remaining);

        if (remaining <= 0) {
          clearTimer();
          setStatus('ready');
          setSecondsLeft(0);
        }
      }, 1000);
    }, 500);

    return () => clearTimeout(activeTimeout);
  }, [status]);

  // Cleanup on unmount
  useEffect(() => () => clearTimer(), []);

  const progress =
    status === 'ready'   ? 1 :
    status === 'active'  ? 1 :
    1 - secondsLeft / COOLDOWN;

  return { secondsLeft, status, progress, activate };
}
