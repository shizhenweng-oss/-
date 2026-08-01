import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';

export class SeaTigerThunderState implements IState {
  readonly type = CharacterStateType.SKILL_THUNDER;
  private timer = 0;
  private eruptionEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  enter(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    this.timer = 0;
    ctx.setPose('punch');
    ctx.setBodyTint(0x00ffff); // Electric Blue
    ctx.emitStateEvent();
    ctx.spawnMangaText('雷绝！', ctx.rect.x, ctx.rect.y, true);

    // Apply the 5 second Thunder Array buff
    ctx.thunderBuffTimer = 5000;
    
    // Immediate eruption effect
    this.eruptionEmitter = ctx.scene.add.particles(0, 0, 'seatiger_idle', {
      lifespan: { min: 200, max: 400 },
      speed: { min: 200, max: 600 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: 0x00ffff,
      blendMode: 'ADD',
      quantity: 10,
      x: ctx.rect.x,
      y: ctx.rect.y
    });
    this.eruptionEmitter.explode(30); // Burst of 30 particles
    
    // Screen shake
    ctx.scene.cameras.main.shake(200, 0.015);
  }

  update(ctx: BaseCharacter, delta: number): void {
    this.timer += delta;
    
    // The actual lingering hitbox is handled in BaseCharacter.ts during the 5s buff
    
    if (this.timer > 400) {
      ctx.fsm.transition(CharacterStateType.IDLE);
    }
  }

  exit(ctx: BaseCharacter): void {
    ctx.setBodyTint(ctx.baseColor);
    if (this.eruptionEmitter) {
      this.eruptionEmitter.stop();
      setTimeout(() => this.eruptionEmitter?.destroy(), 500);
      this.eruptionEmitter = null;
    }
  }
}
