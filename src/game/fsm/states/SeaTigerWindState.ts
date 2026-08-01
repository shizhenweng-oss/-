import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';

export class SeaTigerWindState implements IState {
  readonly type = CharacterStateType.SKILL_WIND;
  private timer = 0;
  
  private windBlade: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle | null = null;
  private windCollider: Phaser.Physics.Arcade.Collider | null = null;
  private windEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private hitRegistered = false;

  enter(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    this.timer = 0;
    this.hitRegistered = false;
    ctx.setPose('punch');
    ctx.setBodyTint(0x00ffaa); // Wind color
    ctx.emitStateEvent();
    ctx.spawnMangaText('风绝！', ctx.rect.x, ctx.rect.y, true);
    
    // Slight recoil for SeaTiger (Backstep)
    ctx.setVelocityX(ctx.facingRight ? -400 : 400);

    // Spawn Wind Blade
    const dir = ctx.facingRight ? 1 : -1;
    const windSprite = ctx.scene.add.sprite(ctx.rect.x + 80 * dir, ctx.rect.y - 60, 'wind_pole');
    windSprite.setScale(1.5);
    if (!ctx.facingRight) windSprite.setFlipX(true);

    ctx.scene.physics.add.existing(windSprite);
    this.windBlade = windSprite as any; // Reusing reference for cleanup and collision
    const body = windSprite.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setSize(100, 160);
    body.setVelocityX(2000 * dir);

    // Particle Emitter for Wind Blade
    this.windEmitter = ctx.scene.add.particles(0, 0, 'spark', {
      lifespan: 200,
      scale: { start: 1, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: 0x000000, // Black wind
      blendMode: 'NORMAL',
      quantity: 3,
      follow: windSprite
    });
    // Create crescent trail shape using a fast emission rate
    
    if (ctx.opponent) {
      this.windCollider = ctx.scene.physics.add.overlap(windSprite, ctx.opponent.rect, () => {
        if (this.hitRegistered || !ctx.opponent) return;
        this.hitRegistered = true;
        
        ctx.opponent.takeHit({
          damage: 15,
          pushbackSpeed: 2500, // Massive pushback
          causesKnockdown: true,
          groundBounce: true
        }, dir);
        
        // Add hit spark
        ctx.spawnShockwave(ctx.opponent.rect.x, ctx.opponent.rect.y, 0xffffff, 1.5);
      });
    }
  }

  update(ctx: BaseCharacter, delta: number): void {
    this.timer += delta;
    
    if (this.timer > 600) {
      ctx.fsm.transition(CharacterStateType.IDLE);
    }
  }

  exit(ctx: BaseCharacter): void {
    ctx.setBodyTint(ctx.baseColor);
    if (this.windCollider) {
      this.windCollider.destroy();
      this.windCollider = null;
    }
    if (this.windBlade) {
      this.windBlade.destroy();
      this.windBlade = null;
    }
    if (this.windEmitter) {
      this.windEmitter.stop();
      setTimeout(() => this.windEmitter?.destroy(), 500); // let particles fade
      this.windEmitter = null;
    }
  }
}
