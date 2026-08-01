import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';

export class SeaTigerIceState implements IState {
  readonly type = CharacterStateType.SKILL_ICE;
  private timer = 0;

  private trapSpawned = false;

  enter(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    this.timer = 0;
    this.trapSpawned = false;
    ctx.setPose('punch');
    ctx.setBodyTint(0x00aaff); // Ice color
    ctx.emitStateEvent();
    ctx.spawnMangaText('冰绝！', ctx.rect.x, ctx.rect.y, true);
  }

  update(ctx: BaseCharacter, delta: number): void {
    this.timer += delta;
    
    if (this.timer < 100) {
      // Startup
    } else if (this.timer < 500) {
      // Active: Spawn Ice Trap
      if (!this.trapSpawned) {
        this.trapSpawned = true;
        
        const dir = ctx.facingRight ? 1 : -1;
        const targetX = ctx.rect.x + 100 * dir;
        const targetY = ctx.rect.y;
        
        // Visual Sprite
        const ice = ctx.scene.add.sprite(targetX, targetY, 'snow_pole');
        ice.setOrigin(0.5, 1);
        ice.setScale(0.7); // Scaled down to fit hitbox
        ice.setDepth(15);
        
        // Precise Logical Hitbox
        const hitbox = ctx.scene.add.rectangle(targetX, targetY - 50, 260, 150, 0, 0);
        ctx.scene.physics.add.existing(hitbox);
        const body = hitbox.body as Phaser.Physics.Arcade.Body;
        body.allowGravity = false;
        body.immovable = true;
        
        let trapActive = true;
        
        if (ctx.opponent) {
           const collider = ctx.scene.physics.add.overlap(hitbox, ctx.opponent.rect, () => {
              if (trapActive && ctx.opponent && ctx.opponent.hp > 0) {
                 trapActive = false; // Only hit once
                 ctx.opponent.takeHit({
                    damage: 15,
                    pushbackSpeed: 0,
                    causesKnockdown: false,
                    freezeDuration: 3000
                 }, dir);
              }
           });
           
           ctx.scene.tweens.add({ targets: [ice, hitbox], alpha: 0, delay: 2500, duration: 500, onComplete: () => {
              collider.destroy();
              ice.destroy();
              hitbox.destroy();
           } });
        } else {
           ctx.scene.tweens.add({ targets: [ice, hitbox], alpha: 0, delay: 2500, duration: 500, onComplete: () => {
              ice.destroy();
              hitbox.destroy();
           } });
        }
        
        ctx.scene.cameras.main.shake(200, 0.015);
      }
    } else {
      ctx.fsm.transition(CharacterStateType.IDLE);
    }
  }

  exit(ctx: BaseCharacter): void {
    ctx.setBodyTint(ctx.baseColor);
  }
}
