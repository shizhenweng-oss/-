import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';

export class SeaTigerBlinkState implements IState {
  readonly type = CharacterStateType.BLINK;
  private timer = 0;
  private dir = 1;

  enter(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    this.timer = 0;
    
    // Determine direction based on input
    if (ctx.input.moveLeft) this.dir = -1;
    else if (ctx.input.moveRight) this.dir = 1;
    else this.dir = ctx.facingRight ? 1 : -1;
    
    // I-frames
    ctx.setBodyTint(0xffffff);
    ctx.rect.setAlpha(0.5);
    ctx.emitStateEvent();
  }

  update(ctx: BaseCharacter, delta: number): void {
    this.timer += delta;
    
    if (this.timer < 150) {
      // Teleporting dash
      ctx.setVelocityX(this.dir * 2500);
    } else {
      ctx.setVelocityX(0);
    }

    // Allow instant branch into Elementals during and shortly after blink (up to 500ms)
    if (ctx.canInstantBranch && this.timer < 500) {
      if (ctx.input.keyQ) { ctx.fsm.transition(CharacterStateType.SKILL_WIND); return; }
      if (ctx.input.keyE) { ctx.fsm.transition(CharacterStateType.SKILL_THUNDER); return; }
      if (ctx.input.keyR) { ctx.fsm.transition(CharacterStateType.SKILL_ICE); return; }
      if (ctx.input.attackHold && ctx.attackHoldTime >= 1000) { ctx.fsm.transition(CharacterStateType.SKILL_FIRE); return; }
    }
    
    if (this.timer >= 500) {
      ctx.fsm.transition(CharacterStateType.IDLE);
    }
  }

  exit(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    ctx.rect.setAlpha(1);
    ctx.setBodyTint(ctx.baseColor);
  }
}
