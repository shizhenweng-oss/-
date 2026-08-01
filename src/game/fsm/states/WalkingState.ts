import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';

// ─────────────────────────────────────────────────────────────────────────────
// WalkingState — character is moving horizontally.
//
// Transitions:
//   • attack (JustDown)        → ATTACKING
//   • no movement keys held    → IDLE
// ─────────────────────────────────────────────────────────────────────────────
const BASE_WALK_SPEED = 350; // px per second

export class WalkingState implements IState {
  readonly type = CharacterStateType.WALKING;
  private tween: Phaser.Tweens.Tween | null = null;

  enter(ctx: BaseCharacter): void {
    ctx.setBodyTint(ctx.baseColor);
    ctx.setPose('idle');
    
    // Procedural Walking Animation (Bob and tilt)
    if (ctx.sprite) {
      this.tween = ctx.scene.tweens.add({
        targets: ctx.sprite,
        angle: 5,
        y: ctx.rect.y - 10,
        duration: 250,
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

    const { input } = ctx;

    if (!input.moveLeft && !input.moveRight) {
      ctx.fsm.transition(CharacterStateType.IDLE);
      return;
    }

    const speed = ctx.thunderBuffTimer > 0 ? BASE_WALK_SPEED * 1.5 : BASE_WALK_SPEED;

    if (input.moveLeft) {
      ctx.setVelocityX(-speed);
      if (this.tween) this.tween.updateTo('angle', -5, true);
    } else if (input.moveRight) {
      ctx.setVelocityX(speed);
      if (this.tween) this.tween.updateTo('angle', 5, true);
    } else {
      ctx.setVelocityX(0);
    }

    ctx.getBody()?.setVelocityY(0);
  }

  exit(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    ctx.getBody()?.setVelocityY(0);
    if (this.tween) {
      this.tween.stop();
      this.tween = null;
    }
    if (ctx.sprite) {
      ctx.sprite.setAngle(0);
    }
  }
}
