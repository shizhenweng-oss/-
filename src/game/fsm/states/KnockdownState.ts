import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';

// ─────────────────────────────────────────────────────────────────────────────
// KnockdownState — character has been downed (HP hit 0).
//
// Visual: squash the rect vertically (simulates lying on the ground).
// During this state the character is fully invincible.
//
// On recovery:
//   • HP is refilled to 30 % of max (so the round can continue for testing)
//   • Transitions → IDLE
//
// Transitions:
//   • After KNOCKDOWN_MS → IDLE
// ─────────────────────────────────────────────────────────────────────────────
const KNOCKDOWN_MS     = 1600;
const HP_REVIVE_RATIO  = 0.30; // fraction of maxHp restored on standup

export class KnockdownState implements IState {
  readonly type = CharacterStateType.KNOCKDOWN;

  private isAirborne = false;

  enter(ctx: BaseCharacter): void {
    ctx.stateData.knockdownTimer = 0;
    ctx.setBodyTint(0xff5555);
    ctx.setPose('idle'); // fallback since we don't have a hurt pose
    
    // In 2.5D, gravity is handled globally. 
    // If we were smashed straight into the ground or already on the ground
    if (ctx.z <= 0 && ctx.vz < 0 && ctx.stateData.lastReceivedHitProps?.groundBounce) {
      if (typeof (ctx.scene as any).spawnDestruction === 'function') {
        (ctx.scene as any).spawnDestruction(ctx.rect.x, ctx.rect.y, true);
      }
      ctx.vz = 500; // Bounce up!
      ctx.z = 1; // Detach from ground
      ctx.stateData.lastReceivedHitProps.groundBounce = false;
      this.isAirborne = true;
    }
    else if (ctx.z > 0 || ctx.vz > 0) {
      // Launched into the air!
      this.isAirborne = true;
    } else {
      // Immediate ground knockdown
      this.isAirborne = false;
      this.squash(ctx);
    }

    ctx.emitStateEvent();
  }

  private squash(ctx: BaseCharacter): void {
    ctx.getBody()?.setVelocity(0, 0);
    ctx.rect.setScale(1.4, 0.25);
  }

  update(ctx: BaseCharacter, delta: number): void {
    if (this.isAirborne) {
      if (ctx.z <= 0) {
        // Hit the ground
        
        // Ground bounce logic (e.g. from 5A smash)
        if (ctx.stateData.lastReceivedHitProps?.groundBounce) {
          if (typeof (ctx.scene as any).spawnDestruction === 'function') {
             (ctx.scene as any).spawnDestruction(ctx.rect.x, ctx.rect.y, true);
          }
          ctx.vz = 500; // Bounce back up!
          ctx.stateData.lastReceivedHitProps.groundBounce = false; // consume
          return;
        }

        this.isAirborne = false;
        
        // Stop movement
        const body = ctx.getBody();
        if (body) {
          body.setVelocity(0, 0);
        }
        
        this.squash(ctx);
      }
      return; // Timer doesn't start until they hit the ground
    }

    ctx.stateData.knockdownTimer += delta;

    if (ctx.stateData.knockdownTimer >= KNOCKDOWN_MS) {
      // Only revive HP if HP <= 0 (e.g. for testing old logic)
      if (ctx.hp <= 0) {
        ctx.hp = Math.round(ctx.maxHp * HP_REVIVE_RATIO);
      }
      ctx.fsm.transition(CharacterStateType.IDLE);
    }
  }

  exit(ctx: BaseCharacter): void {
    const body = ctx.getBody();
    if (body) {
      body.setVelocity(0, 0);
    }
    if (!this.isAirborne) {
      // Restore from squash
      ctx.rect.setScale(1, 1);
    }
    ctx.setBodyTint(ctx.baseColor);
  }
}
