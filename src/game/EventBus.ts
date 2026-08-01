import Phaser from 'phaser';

// ─────────────────────────────────────────────────────────────────────────────
// EventBus — singleton Phaser EventEmitter bridging game → React UI.
// ─────────────────────────────────────────────────────────────────────────────
export const EventBus = new Phaser.Events.EventEmitter();

export const EVENTS = {
  /** { player: 1|2, hp: number, maxHp: number } */
  PLAYER_HP_CHANGED:    'player-hp-changed',
  /** { player: 1|2, force: number, maxForce: number } */
  PLAYER_FORCE_CHANGED: 'player-force-changed',
  /** { player: 1|2, overloaded: boolean } */
  PLAYER_FORCE_OVERLOAD: 'player-force-overload',
  /** { player: 1|2, state: string } */
  PLAYER_STATE_CHANGED: 'player-state-changed',
  /** { player: 1|2, secondsLeft: number, status: 'ready'|'active'|'cooling', progress: number } */
  PLAYER_SUB_CHANGED:   'player-sub-changed',
  /** { winner: 1|2|'draw' } */
  ROUND_OVER:           'round-over',
  /** { text: string } */
  PLAY_NARRATION:       'play-narration',
  /** { player: 1|2, text: string } */
  UI_TEXT_CUTIN:        'ui-text-cutin',
  /** { player: 1|2, active: boolean, type: 'thunder'|'ice'|'fire' } */
  UI_BUFF_EFFECT:       'ui-buff-effect',
  /** { phase: 1 | 2 | 3 | 4 } */
  UI_CINEMATIC_ULTIMATE: 'ui-cinematic-ultimate',
} as const;

export type EventPayloads = {
  [EVENTS.PLAYER_HP_CHANGED]:    { player: 1 | 2; hp: number; maxHp: number };
  [EVENTS.PLAYER_FORCE_CHANGED]: { player: 1 | 2; force: number; maxForce: number };
  [EVENTS.PLAYER_FORCE_OVERLOAD]: { player: 1 | 2; overloaded: boolean };
  [EVENTS.PLAYER_STATE_CHANGED]: { player: 1 | 2; state: string };
  [EVENTS.PLAYER_SUB_CHANGED]:   {
    player:     1 | 2;
    secondsLeft: number;
    /** ready = available; active = i-frames running; cooling = on cooldown */
    status:     'ready' | 'active' | 'cooling';
    /** 0–1 fill fraction for the ring (1 = full / ready) */
    progress:   number;
  };
  [EVENTS.ROUND_OVER]:           { winner: 1 | 2 | 'draw' };
  [EVENTS.PLAY_NARRATION]:       { text: string, imageUrl?: string };
  [EVENTS.UI_TEXT_CUTIN]:        { player: 1 | 2; text: string };
  [EVENTS.UI_BUFF_EFFECT]:       { player: 1 | 2; active: boolean; type: 'thunder'|'ice'|'fire' };
  [EVENTS.UI_CINEMATIC_ULTIMATE]: { phase: 1 | 2 | 3 | 4 | 0 }; // 0 to clear
};
