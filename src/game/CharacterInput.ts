// ─────────────────────────────────────────────────────────────────────────────
// CharacterInput — per-frame input snapshot populated by GameScene.pollInput()
// ─────────────────────────────────────────────────────────────────────────────
export interface CharacterInput {
  moveLeft:   boolean;
  moveRight:  boolean;
  moveUp:     boolean;
  moveDown:   boolean;
  /** Normal attack key — JustDown (true for exactly 1 frame) */
  attack:     boolean;
  /** Normal attack key — Hold state */
  attackHold: boolean;
  /** Substitute key (Cellular Reconstruction) — JustDown */
  substitute: boolean;
  /** Skill 1 key — JustDown */
  skill1:     boolean;
  /** Skill 2 key — JustDown */
  skill2:     boolean;
  /** Skill 2 hold state */
  skill2Hold: boolean;
  /** Ultimate key — JustDown */
  ultimate:   boolean;
  /** Q key — Hold state for chords */
  keyQ:       boolean;
  /** E key — Hold state for chords */
  keyE:       boolean;
  /** R key — Hold state for chords */
  keyR:       boolean;
  /** Shift key — Hold state for chords */
  keyShift:   boolean;
}

export const emptyInput = (): CharacterInput => ({
  moveLeft:   false,
  moveRight:  false,
  moveUp:     false,
  moveDown:   false,
  attack:     false,
  attackHold: false,
  substitute: false,
  skill1:     false,
  skill2:     false,
  skill2Hold: false,
  ultimate:   false,
  keyQ:       false,
  keyE:       false,
  keyR:       false,
  keyShift:   false,
});
