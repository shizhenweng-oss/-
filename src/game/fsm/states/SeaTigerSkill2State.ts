import type { IState } from '../CharacterFSM';
import { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';
import Phaser from 'phaser';
import { EventBus, EVENTS } from '../../EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// SeaTigerSkill2State — 磁场细胞重组 (Magnetic Cell Reconstruction)
//
// • Channeling heal: hold to continuously drain Force and recover HP.
// • Super Armor: Immune to normal attacks (handled in BaseCharacter.takeHit).
// • Vulnerable: Can be interrupted by Knockdown attacks (e.g. 5A sweep or ultimate).
// ─────────────────────────────────────────────────────────────────────────────

const FORCE_DRAIN_PER_SEC = 20;
const HP_HEAL_PER_SEC = 10;
const TICK_RATE_MS = 100; // Apply drain/heal every 100ms

export class SeaTigerSkill2State implements IState {
  readonly type = CharacterStateType.SKILL_HEAL;
  private tickTimer = 0;
  private fxTimer = 0;
  private cutinImage: Phaser.GameObjects.Image | null = null;
  private cutinTween: Phaser.Tweens.Tween | null = null;

  enter(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    ctx.setPose('ultimate'); // Use ultimate pose for charging
    ctx.setBodyTint(0x00ff00);
    this.tickTimer = 0;
    this.fxTimer = 0;

    // Cut-in Animation
    if (ctx.scene.textures.exists('cell_reconstruction')) {
      const cx = ctx.scene.scale.width / 2;
      const cy = ctx.scene.scale.height / 2;
      this.cutinImage = ctx.scene.add.image(cx, cy, 'cell_reconstruction');
      this.cutinImage.setDepth(100);
      this.cutinImage.setAlpha(0);
      this.cutinImage.setScale(1.2);
      
      this.cutinTween = ctx.scene.tweens.add({
        targets: this.cutinImage,
        alpha: 0.8,
        scale: 1,
        duration: 300,
        ease: 'Cubic.easeOut',
      });
    }

    ctx.emitStateEvent();
  }

  update(ctx: BaseCharacter, delta: number): void {
    if (!ctx.input.healHold || ctx.magneticForce <= 0) {
      ctx.fsm.transition(CharacterStateType.IDLE);
      return;
    }

    this.tickTimer += delta;
    this.fxTimer += delta;

    // Visual effect: High-frequency pulsing glow
    if (this.fxTimer > 50) {
      this.fxTimer = 0;
      ctx.setBodyTint(Math.random() > 0.5 ? 0x00ff00 : 0xaaffaa);
      
      // Spawn particles
      if (ctx.sprite || ctx.rect) {
        const cx = ctx.rect.x;
        const cy = ctx.rect.y - (ctx.z || 0) - ctx.height / 2;
        const spark = ctx.scene.add.circle(
          cx + Phaser.Math.Between(-30, 30),
          cy + Phaser.Math.Between(-50, 50),
          Phaser.Math.Between(2, 5),
          0x00ff00
        );
        spark.setDepth(20);
        ctx.scene.tweens.add({
          targets: spark,
          y: spark.y - 40,
          alpha: 0,
          duration: 400,
          onComplete: () => spark.destroy()
        });
      }
    }

    // Apply continuous drain and heal
    if (this.tickTimer >= TICK_RATE_MS) {
      this.tickTimer -= TICK_RATE_MS;
      
      const drainAmount = (FORCE_DRAIN_PER_SEC * TICK_RATE_MS) / 1000;
      const healAmount = (HP_HEAL_PER_SEC * TICK_RATE_MS) / 1000;

      // Check if enough force
      if (ctx.magneticForce < drainAmount) {
        ctx.fsm.transition(CharacterStateType.IDLE);
        return;
      }

      ctx.magneticForce = Math.max(0, ctx.magneticForce - drainAmount);
      ctx.hp = Math.min(ctx.maxHp, ctx.hp + healAmount);

      EventBus.emit(EVENTS.PLAYER_FORCE_CHANGED, {
        player:   ctx.playerId,
        force:    ctx.magneticForce,
        maxForce: BaseCharacter.MAX_FORCE,
      });

      EventBus.emit(EVENTS.PLAYER_HP_CHANGED, {
        player:   ctx.playerId,
        hp:       ctx.hp,
        maxHp:    ctx.maxHp,
      });
    }
  }

  exit(ctx: BaseCharacter): void {
    ctx.setBodyTint(ctx.baseColor);

    if (this.cutinTween) {
      this.cutinTween.stop();
      this.cutinTween = null;
    }
    if (this.cutinImage) {
      // Fade out
      const img = this.cutinImage;
      ctx.scene.tweens.add({
        targets: img,
        alpha: 0,
        x: img.x - 100,
        duration: 200,
        onComplete: () => img.destroy()
      });
      this.cutinImage = null;
    }
  }
}
