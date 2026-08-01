// ─────────────────────────────────────────────────────────────────────────────
// CharacterStateType — every valid FSM state across all characters.
//
// The base five (IDLE → KNOCKDOWN) apply to all characters.
// Character-specific states (COMBO, SKILL_*) are registered only on the
// characters that own them.
// ─────────────────────────────────────────────────────────────────────────────
export const CharacterStateType = {
  // ── Universal states ─────────────────────────────────────────────────────
  IDLE: 'IDLE',
  WALKING: 'WALKING',
  ATTACKING: 'ATTACKING',   // generic single-hit attack (BaseCharacter default)
  HITSTUN: 'HITSTUN',
  KNOCKDOWN: 'KNOCKDOWN',
  FROZEN: 'FROZEN',

  // ── SeaTiger-specific states ──────────────────────────────────────────────
  /** 4-hit normal attack combo */
  COMBO: 'COMBO',
  /** Skill 1 — Sea Tiger Blast Kick (ground-bounce sweep) */
  SKILL_BLAST_KICK: 'SKILL_BLAST_KICK',
  /** Skill 2 — Magnetic Cell Reconstruction */
  SKILL_HEAL: 'SKILL_HEAL',
  /** Ultimate Attack */
  ULTIMATE_ATTACK: 'ULTIMATE_ATTACK',

  // ── Five Elements Branching States ─────────────────────────────────────────
  SKILL_WIND: 'SKILL_WIND',
  SKILL_THUNDER: 'SKILL_THUNDER',
  SKILL_ICE: 'SKILL_ICE',
  SKILL_FIRE: 'SKILL_FIRE',

  // ── Buff States ───────────────────────────────────────────────────────────
  BUFF_THUNDER_ACTIVATE: 'BUFF_THUNDER_ACTIVATE',
  BLINK: 'BLINK',
  BACKDASH_PROJECTILE: 'BACKDASH_PROJECTILE',
} as const;

export type CharacterStateType = typeof CharacterStateType[keyof typeof CharacterStateType];
