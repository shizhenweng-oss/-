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
    } else if (this.timer < 3000) {
      // Active: Freeze attack (lasts 3 seconds)
      if (!ctx.activeHitbox) {
        ctx.spawnHitbox(120, 200, 200);
        ctx.stateData.currentHitProps = {
          damage: 15,
          pushbackSpeed: 0, // Keep them in place
          causesKnockdown: false,
          freezeDuration: 3000 // 3 seconds freeze
        };
        
        // Ice smash visuals
        const dir = ctx.facingRight ? 1 : -1;
        const ice = ctx.scene.add.sprite(ctx.rect.x + 100 * dir, ctx.rect.y, 'snow_pole');
        ice.setOrigin(0.5, 1);
        ice.setDepth(15);
        ctx.scene.tweens.add({ targets: ice, alpha: 0, delay: 2500, duration: 500, onComplete: () => ice.destroy() });
        
        ctx.scene.cameras.main.shake(200, 0.015);
      }
    } else if (this.timer < 3300) {
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
