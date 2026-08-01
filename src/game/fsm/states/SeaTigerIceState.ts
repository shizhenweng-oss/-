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
        const ice = ctx.scene.add.sprite(ctx.rect.x + 100 * dir, ctx.rect.y, 'snow_pole');
        ice.setOrigin(0.5, 1);
        ice.setDepth(15);
        
        ctx.scene.physics.add.existing(ice, true); // true for static body
        const body = ice.body as Phaser.Physics.Arcade.StaticBody;
        body.setSize(200, 200);
        
        let trapActive = true;
        
        if (ctx.opponent) {
           const collider = ctx.scene.physics.add.overlap(ice, ctx.opponent.rect, () => {
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
           
           ctx.scene.tweens.add({ targets: ice, alpha: 0, delay: 2500, duration: 500, onComplete: () => {
              collider.destroy();
              ice.destroy();
           } });
        } else {
           ctx.scene.tweens.add({ targets: ice, alpha: 0, delay: 2500, duration: 500, onComplete: () => {
              ice.destroy();
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
