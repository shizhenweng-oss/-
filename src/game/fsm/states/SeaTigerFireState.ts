import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';

export class SeaTigerFireState implements IState {
  readonly type = CharacterStateType.SKILL_FIRE;
  private timer = 0;

  enter(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    this.timer = 0;
    ctx.setPose('punch');
    ctx.setBodyTint(0xff3300); // Fire red
    ctx.emitStateEvent();
    ctx.spawnMangaText('火绝！', ctx.rect.x, ctx.rect.y, true);
  }

  update(ctx: BaseCharacter, delta: number): void {
    this.timer += delta;
    
    if (this.timer < 300) {
      // Charge Startup
      ctx.setBodyTint(this.timer % 100 < 50 ? 0xffffff : 0xff0000);
    } else if (this.timer < 500) {
      // Massive Active Hit
      ctx.setBodyTint(0xff3300);
      if (!ctx.activeHitbox) {
        ctx.spawnHitbox(150, 200, 200); // Huge hitbox
        ctx.stateData.currentHitProps = {
          damage: 40,
          pushbackSpeed: 800,
          causesKnockdown: true,
          launchVelocityY: 1500,
          groundBounce: true
        };
        
        // Fire Cut-in close-up
        const cx = ctx.scene.cameras.main.width / 2;
        const cy = ctx.scene.cameras.main.height / 2;
        const cutin = ctx.scene.add.sprite(cx, cy, 'fire_pole');
        cutin.setScrollFactor(0); // Attach to screen
        cutin.setDepth(2000);
        cutin.setAlpha(0);
        cutin.setScale(1.125); // 75% of 1.5
        ctx.scene.tweens.add({
           targets: cutin,
           scale: 0.75, // 75% of 1.0
           alpha: 1,
           duration: 150,
           ease: 'Back.easeOut',
           yoyo: true,
           hold: 500,
           onComplete: () => cutin.destroy()
        });
        
        // Massive explosive particles
        const explosion = ctx.scene.add.particles(ctx.rect.x + (ctx.facingRight ? 100 : -100), ctx.rect.y, 'seatiger_idle', {
          lifespan: { min: 200, max: 600 },
          speed: { min: 300, max: 800 },
          scale: { start: 1.5, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0xff0000, 0xff8800, 0xffff00],
          blendMode: 'ADD',
          quantity: 30,
        });
        explosion.explode(50);
        setTimeout(() => explosion.destroy(), 1000);
        
        // Screen shake
        ctx.scene.cameras.main.shake(400, 0.04);
        ctx.spawnShockwave(ctx.rect.x, ctx.rect.y, 0xff3300, 3);
        
        // Environment destruction
        if (typeof (ctx.scene as any).spawnDestruction === 'function') {
          (ctx.scene as any).spawnDestruction(ctx.rect.x + (ctx.facingRight ? 80 : -80), ctx.rect.y, true);
        }
      }
    } else if (this.timer < 1000) {
      // Long Recovery
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
