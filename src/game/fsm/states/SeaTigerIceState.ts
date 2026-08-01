import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';

export class SeaTigerIceState implements IState {
  readonly type = CharacterStateType.SKILL_ICE;
  private timer = 0;

  enter(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    this.timer = 0;
    ctx.setPose('punch');
    ctx.setBodyTint(0x00aaff); // Ice color
    ctx.emitStateEvent();
    ctx.spawnMangaText('冰绝！', ctx.rect.x, ctx.rect.y, true);
  }

  update(ctx: BaseCharacter, delta: number): void {
    this.timer += delta;
    
    if (this.timer < 100) {
      // Startup
    } else if (this.timer < 300) {
      // Active: Freeze attack
      if (!ctx.activeHitbox) {
        ctx.spawnHitbox(120, 150, 150);
        ctx.stateData.currentHitProps = {
          damage: 10,
          pushbackSpeed: 0, // Keep them in place
          causesKnockdown: false,
          freezeDuration: 3000 // 3 seconds freeze
        };
        
        // Ice smash visuals
        ctx.spawnShockwave(ctx.rect.x + (ctx.facingRight ? 80 : -80), ctx.rect.y, 0x00aaff, 1.5);
        ctx.scene.cameras.main.shake(200, 0.015);
      }
    } else if (this.timer < 600) {
      // Recovery
      ctx.destroyHitbox();
    } else {
      ctx.fsm.transition(CharacterStateType.IDLE);
    }
  }

  exit(ctx: BaseCharacter): void {
    ctx.destroyHitbox();
    ctx.setBodyTint(ctx.baseColor);
  }
}
