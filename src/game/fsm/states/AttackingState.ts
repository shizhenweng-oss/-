import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';

// ─────────────────────────────────────────────────────────────────────────────
// AttackingState — three-phase attack: startup → active (hitbox live) → recovery
//
// Phase durations (ms):
//   STARTUP   80ms  — windup animation, no hitbox
//   ACTIVE   220ms  — hitbox exists, can connect once
//   RECOVERY 300ms  — hitbox gone, character locked
//
// Transitions:
//   • end of RECOVERY → IDLE
//   • takeHit() during any phase → HITSTUN (handled externally by BaseCharacter)
// ─────────────────────────────────────────────────────────────────────────────
const STARTUP_MS  =  80;
const ACTIVE_MS   = 220;
const RECOVERY_MS = 300;
const TOTAL_MS    = STARTUP_MS + ACTIVE_MS + RECOVERY_MS;

export class AttackingState implements IState {
  readonly type = CharacterStateType.ATTACKING;
  private tween: Phaser.Tweens.Tween | null = null;

  enter(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    ctx.stateData.attackTimer    = 0;
    ctx.stateData.hitRegistered  = false;
    ctx.setBodyTint(0xffcc00); // yellow windup flash
    ctx.setPose('punch');
    
    // Procedural windup/lunge animation
    if (ctx.sprite) {
      const dir = ctx.facingRight ? 1 : -1;
      this.tween = ctx.scene.tweens.add({
        targets: ctx.sprite,
        x: ctx.rect.x + (10 * dir),
        angle: 15 * dir,
        duration: STARTUP_MS,
        ease: 'Cubic.easeIn',
        yoyo: true,
        hold: ACTIVE_MS,
      });
    }

    ctx.emitStateEvent();
  }

  update(ctx: BaseCharacter, delta: number): void {
    ctx.stateData.attackTimer += delta;
    const t = ctx.stateData.attackTimer;

    if (t < STARTUP_MS) {
      // ── Startup ──────────────────────────────────────────────
      ctx.setBodyTint(0xffaa00);
    } else if (t < STARTUP_MS + ACTIVE_MS) {
      // ── Active ───────────────────────────────────────────────
      ctx.setBodyTint(0xff5500);
      if (!ctx.activeHitbox) {
        ctx.spawnHitbox();
      }
    } else if (t < TOTAL_MS) {
      // ── Recovery ─────────────────────────────────────────────
      if (ctx.activeHitbox) ctx.destroyHitbox();
      ctx.setBodyTint(0x886600);
    } else {
      // ── Done ─────────────────────────────────────────────────
      ctx.fsm.transition(CharacterStateType.IDLE);
    }
  }

  exit(ctx: BaseCharacter): void {
    ctx.destroyHitbox();
    ctx.setBodyTint(ctx.baseColor);
    
    if (this.tween) {
      this.tween.stop();
      this.tween = null;
    }
    if (ctx.sprite) {
      ctx.sprite.setAngle(0);
      ctx.sprite.setPosition(ctx.rect.x, ctx.rect.y);
    }
  }
}
