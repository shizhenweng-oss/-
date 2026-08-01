import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';

export class SeaTigerWindState implements IState {
  readonly type = CharacterStateType.SKILL_WIND;
  private timer = 0;
  
  private windBlade: Phaser.GameObjects.Rectangle | null = null;
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
    
    // Slight recoil for SeaTiger
    ctx.setVelocityX(ctx.facingRight ? -200 : 200);

    // Spawn Wind Blade
    const dir = ctx.facingRight ? 1 : -1;
    this.windBlade = ctx.scene.add.rectangle(ctx.rect.x + 50 * dir, ctx.rect.y - 30, 80, 160, 0xffffff, 0);
    ctx.scene.physics.add.existing(this.windBlade);
    const body = this.windBlade.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setVelocityX(2500 * dir);

    // Particle Emitter for Wind Blade
    this.windEmitter = ctx.scene.add.particles(0, 0, 'seatiger_idle', {
      lifespan: 150,
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: 0xffffff,
      blendMode: 'ADD',
      quantity: 2,
      follow: this.windBlade
    });
    // Create crescent trail shape using a fast emission rate
    
    if (ctx.opponent) {
      this.windCollider = ctx.scene.physics.add.overlap(this.windBlade, ctx.opponent.rect, () => {
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
