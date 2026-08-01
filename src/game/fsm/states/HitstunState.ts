import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';

// ─────────────────────────────────────────────────────────────────────────────
// HitstunState — character is reeling from a hit.
//
// • Interrupts IDLE / WALKING / ATTACKING (attack inputs ignored).
// • Pushback velocity decelerates naturally via physics drag.
// • Body flashes white rapidly for the duration.
//
// Transitions after duration:
//   hp > 0  → IDLE
//   hp ≤ 0  → KNOCKDOWN
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_HITSTUN_MS   = 450;
const FLASH_INTERVAL_MS    =  55;

export class HitstunState implements IState {
  readonly type = CharacterStateType.HITSTUN;
  private isAirborne = false;
  private hitstunMs = DEFAULT_HITSTUN_MS;

  enter(ctx: BaseCharacter): void {
    ctx.stateData.hitstunTimer = 0;
    ctx.setBodyTint(0xffaaaa);
    ctx.setPose('idle'); // fallback since we don't have a hurt pose
    ctx.destroyHitbox();
    
    const props = ctx.stateData.lastReceivedHitProps;
    this.hitstunMs = props?.hitstunDuration ?? DEFAULT_HITSTUN_MS;

    ctx.getBody();
    if (ctx.vz > 0 || ctx.z > 0) {
      this.isAirborne = true;
    } else {
      this.isAirborne = false;
    }
    
    ctx.emitStateEvent();
  }

  update(ctx: BaseCharacter, delta: number): void {
    // ── Cellular Reconstruction escape ────────────────────────────────────
    // Player pressed the sub key while in hitstun with enough Force + no CD.
    if (ctx.input.substitute && ctx.canSubstitute) {
      ctx.performSubstitution(); // internally → IDLE; early-exit this update
      return;
    }

    ctx.stateData.hitstunTimer += delta;

    // Alternating white-flash effect
    const cycle = Math.floor(ctx.stateData.hitstunTimer / FLASH_INTERVAL_MS);
    ctx.setBodyTint(cycle % 2 === 0 ? 0xffffff : ctx.baseColor);

    // Gradual pushback deceleration (both X and Y for 2.5D)
    const body = ctx.getBody();
    if (body) {
      body.setVelocityX(body.velocity.x * 0.88);
      body.setVelocityY(body.velocity.y * 0.88);
    }

    if (this.isAirborne) {
      if (ctx.z <= 0) {
        this.isAirborne = false;
      }
    }

    if (!this.isAirborne && ctx.stateData.hitstunTimer >= this.hitstunMs) {
      if (ctx.hp <= 0) {
        ctx.fsm.transition(CharacterStateType.KNOCKDOWN);
      } else {
        ctx.fsm.transition(CharacterStateType.IDLE);
      }
    }
  }

  exit(ctx: BaseCharacter): void {
    ctx.setBodyTint(ctx.baseColor);
    const body = ctx.getBody();
    if (body) {
      body.setVelocity(0, 0);
    }
  }
}
