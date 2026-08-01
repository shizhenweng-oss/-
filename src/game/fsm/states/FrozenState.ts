import Phaser from 'phaser';
import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';

export class FrozenState implements IState {
  readonly type = CharacterStateType.FROZEN;
  private timer = 0;
  private freezeDuration = 3000;
  
  private iceBlock: Phaser.GameObjects.Rectangle | null = null;
  private particles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  enter(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    this.timer = 0;
    
    // Check if hit props provided a specific duration
    if ((ctx.stateData.lastReceivedHitProps as any)?.freezeDuration) {
      this.freezeDuration = (ctx.stateData.lastReceivedHitProps as any).freezeDuration;
    } else {
      this.freezeDuration = 3000;
    }
    
    ctx.setBodyTint(0x00aaff); // Ice blue
    ctx.emitStateEvent();
    
    // Spawn an ice block visual over the character
    this.iceBlock = ctx.scene.add.rectangle(ctx.rect.x, ctx.rect.y - ctx.height / 2, ctx.width + 20, ctx.height + 20, 0x00aaff, 0.5);
    this.iceBlock.setDepth(ctx.rect.depth + 1);
    
    // Add some snow particles
    this.particles = ctx.scene.add.particles(ctx.rect.x, ctx.rect.y - ctx.height / 2, 'seatiger_idle', {
      lifespan: 1000,
      speedY: { min: -20, max: 20 },
      speedX: { min: -20, max: 20 },
      scale: { start: 0.1, end: 0 },
      tint: 0xffffff,
      blendMode: 'ADD',
      frequency: 100,
      bounds: new Phaser.Geom.Rectangle(-40, -60, 80, 120)
    });
    this.particles.setDepth(ctx.rect.depth + 2);
  }

  update(ctx: BaseCharacter, delta: number): void {
    this.timer += delta;
    ctx.setVelocityX(0);
    
    if (this.iceBlock) {
       this.iceBlock.setPosition(ctx.rect.x, ctx.rect.y - ctx.height / 2);
    }
    if (this.particles) {
       this.particles.setPosition(ctx.rect.x, ctx.rect.y - ctx.height / 2);
    }
    
    if (this.timer >= this.freezeDuration) {
      // Unfreeze
      ctx.fsm.transition(CharacterStateType.IDLE);
    }
  }

  exit(ctx: BaseCharacter): void {
    ctx.setBodyTint(ctx.baseColor);
    
    if (this.iceBlock) {
      // Shatter effect
      ctx.scene.tweens.add({
        targets: this.iceBlock,
        alpha: 0,
        scale: 1.5,
        duration: 200,
        onComplete: () => this.iceBlock?.destroy()
      });
      this.iceBlock = null;
    }
    if (this.particles) {
      this.particles.stop();
      setTimeout(() => this.particles?.destroy(), 1000);
      this.particles = null;
    }
    
    // Spawn shatter shockwave
    if (typeof (ctx as any).spawnShockwave === 'function') {
      (ctx as any).spawnShockwave(ctx.rect.x, ctx.rect.y, 0x00ffff, 1);
    }
  }
}
