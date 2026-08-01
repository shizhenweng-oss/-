import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';
import { EventBus, EVENTS } from '../../EventBus';

export class SeaTigerBuffState implements IState {
  readonly type = CharacterStateType.BUFF_THUNDER_ACTIVATE;
  private timer = 0;

  enter(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    this.timer = 0;
    ctx.setPose('punch'); // Can reuse punch or idle pose for buff animation
    ctx.setBodyTint(0xffffff); // Flash white
    ctx.emitStateEvent();
    ctx.spawnMangaText('电绝力量强化！', ctx.rect.x, ctx.rect.y, true);
    
    // Apply buff
    ctx.thunderBuffTimer = 4000;
    ctx.blockCharges = 3;
    ctx.canInstantBranch = true; // Enables Blink -> element cancel
    EventBus.emit(EVENTS.UI_BUFF_EFFECT, { player: ctx.playerId, active: true, type: 'thunder' });
  }

  update(ctx: BaseCharacter, delta: number): void {
    this.timer += delta;
    
    // Tiny animation lock
    if (this.timer < 300) {
      if (this.timer % 100 < 50) ctx.setBodyTint(0xffffff);
      else ctx.setBodyTint(0x00ffff);
    } else {
      ctx.fsm.transition(CharacterStateType.IDLE);
    }
  }

  exit(ctx: BaseCharacter): void {
    ctx.setBodyTint(0x00ffff); // Maintain buff tint
  }
}
