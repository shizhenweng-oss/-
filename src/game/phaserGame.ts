import Phaser from 'phaser';
import { GameScene } from './GameScene';

// ─────────────────────────────────────────────────────────────────────────────
// createPhaserGame
//
// Factory that builds a Phaser.Game instance pinned to a specific DOM element.
// Arcade Physics is enabled with debug outlines visible during development
// so hitboxes / hurtboxes are clearly visible.
// ─────────────────────────────────────────────────────────────────────────────
export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,            // WebGL with Canvas fallback
    parent,                       // attach to this div, NOT document.body
    width:  '100%',
    height: '100%',
    scale: {
      mode:       Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    backgroundColor: '#020210',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 }, // no gravity — 2D plane fighter
        debug:   true,            // ← shows hurtboxes (blue) and hitboxes (red/green)
      },
    },
    render: {
      antialias:  true,
      pixelArt:   false,
    },
    fps: {
      target:          60,
      forceSetTimeOut: false,
    },
    scene: [GameScene],
  };

  return new Phaser.Game(config);
}
