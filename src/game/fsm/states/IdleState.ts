import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';

// ─────────────────────────────────────────────────────────────────────────────
// IdleState — character is standing still, waiting for input.
//
// Transitions:
//   • moveLeft | moveRight → WALKING
//   • attack (JustDown)    → ATTACKING
// ─────────────────────────────────────────────────────────────────────────────
export class IdleState implements IState {
  readonly type = CharacterStateType.IDLE;
  private tween: Phaser.Tweens.Tween | null = null;

  enter(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    ctx.setBodyTint(ctx.baseColor);
    ctx.setPose('idle');
    
    // Procedural Breathing Animation
    if (ctx.sprite) {
      this.tween = ctx.scene.tweens.add({
        targets: ctx.sprite,
        scaleY: ctx.sprite.scaleY * 1.05,
        scaleX: ctx.sprite.scaleX * 0.98,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    ctx.emitStateEvent();
  }

  update(ctx: BaseCharacter, _delta: number): void {
    if (ctx.handleActionInput()) {
      return;
    }

    if (ctx.input.moveLeft || ctx.input.moveRight) {
      ctx.fsm.transition(CharacterStateType.WALKING);
    }
  }

  exit(ctx: BaseCharacter): void {
    if (this.tween) {
      this.tween.stop();
      this.tween = null;
    }
    // Reset scale to base scale
    if (ctx.sprite) {
      const scale = Math.min(ctx.width / ctx.sprite.width, ctx.height / ctx.sprite.height) * 3;
      ctx.sprite.setScale(scale);
    }
  }
}
