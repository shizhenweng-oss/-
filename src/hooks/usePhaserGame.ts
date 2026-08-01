import { useEffect, useRef, useCallback } from 'react';
import { createPhaserGame } from '../game/phaserGame';
import type Phaser from 'phaser';

// ─────────────────────────────────────────────────────────────────────────────
// usePhaserGame
//
// Safely mounts / unmounts a Phaser game instance inside the provided ref
// element.  Handles React Strict Mode double-invocation:
//   • We track whether the effect is still "live" with a cancelled flag.
//   • Phaser is only created once per real mount — the cleanup destroys it.
// ─────────────────────────────────────────────────────────────────────────────
export function usePhaserGame(containerRef: React.RefObject<HTMLDivElement | null>) {
  const gameRef = useRef<Phaser.Game | null>(null);

  // Expose a stable ref so callers can reach into the Phaser instance.
  const getGame = useCallback(() => gameRef.current, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Guard: if a game already exists (Strict Mode second run), do nothing.
    if (gameRef.current) return;

    // Small async tick gives the DOM a chance to fully paint before Phaser
    // tries to measure the container — avoids zero-size canvas on first mount.
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled || !containerRef.current) return;
      gameRef.current = createPhaserGame(containerRef.current);
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);

      if (gameRef.current) {
        // Phaser.Game.destroy(removeCanvas, noReturn)
        gameRef.current.destroy(true, false);
        gameRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run exactly once per real mount

  return { getGame };
}
