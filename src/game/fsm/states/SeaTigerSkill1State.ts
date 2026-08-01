import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';

// ─────────────────────────────────────────────────────────────────────────────
// SeaTigerSkill1State — 磁场转动·狂鲨三连噬 (Magnetic Rotation: Crazy Shark Triple Bite)
// ─────────────────────────────────────────────────────────────────────────────

export class SeaTigerSkill1State implements IState {
  readonly type = CharacterStateType.SKILL_BLAST_KICK;
  private stage = 1;
  private timer = 0;
  private hasGrabbed = false;

  enter(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    this.timer = 0;
    this.stage = ctx.skill1ComboStage;
    this.hasGrabbed = false;
    ctx.setPose('idle'); 
    ctx.emitStateEvent();

    if (this.stage === 2) {
      // Stage 2: Teleport Start
      ctx.setBodyTint(0x00ffff); // Electric blue
      // Leave afterimage
      if (ctx.sprite) {
        const ghost = ctx.scene.add.sprite(ctx.rect.x, ctx.rect.y - (ctx.z || 0), ctx.sprite.texture.key);
        ghost.setFlipX(!ctx.facingRight);
        ghost.setScale(ctx.sprite.scaleX, ctx.sprite.scaleY);
        ghost.setTint(0x00ffff);
        ghost.setAlpha(0.8);
        ctx.scene.tweens.add({ targets: ghost, alpha: 0, duration: 300, onComplete: () => ghost.destroy() });
      }
      
      // Teleport above opponent
      if (ctx.opponent) {
        ctx.rect.setPosition(ctx.opponent.rect.x, ctx.opponent.rect.y);
        ctx.z = (ctx.opponent.z || 0) + 200; // High above
      }
      ctx.vz = -1500; // Slam down fast!
      ctx.setPose('punch');
    }
  }

  update(ctx: BaseCharacter, delta: number): void {
    this.timer += delta;

    if (this.stage === 1) {
      // ── Stage 1: Dash ──
      const STARTUP = 60;
      const DASH = 350;
      
      if (this.timer < STARTUP) {
        ctx.setBodyTint(Math.random() > 0.5 ? 0x00aaff : 0xffffff); // Shark water/electric charging
      } else if (this.timer < STARTUP + DASH) {
        ctx.setBodyTint(0x00aaff);
        ctx.setVelocityX(ctx.facingRight ? 2000 : -2000);
        
        if (!this.hasGrabbed && ctx.opponent) { // Using hasGrabbed as "hasHit"
          const distX = Math.abs(ctx.rect.x - ctx.opponent.rect.x);
          const distY = Math.abs(ctx.rect.y - ctx.opponent.rect.y);
          const distZ = Math.abs(ctx.z - (ctx.opponent.z || 0));

          if (distX < 140 && distY < 60 && distZ < 80) {
            this.hasGrabbed = true;
            ctx.applyHitStop(100, 0); // Brief hit stop for "嘭" feel
            ctx.opponent.takeHit({ damage: 10, pushbackSpeed: 200, causesKnockdown: false }, ctx.facingRight ? 1 : -1);
          }
        }
      } else {
        // End of Stage 1
        ctx.skill1ComboStage = 2;
        ctx.skill1ComboWindow = 3000;
        ctx.fsm.transition(CharacterStateType.IDLE);
      }

    } else if (this.stage === 2) {
      // ── Stage 2: Teleport Grab ──
      
      if (!this.hasGrabbed) {
        if (ctx.z <= 0) {
          ctx.z = 0;
          ctx.vz = 0;
          
          // Landed, check grab
          if (ctx.opponent) {
            const distX = Math.abs(ctx.rect.x - ctx.opponent.rect.x);
            const distY = Math.abs(ctx.rect.y - ctx.opponent.rect.y);
            const distZ = Math.abs(ctx.z - (ctx.opponent.z || 0));

            if (distX < 90 && distY < 40 && distZ < 60) {
              this.hasGrabbed = true;
              ctx.applyHitStop(150, 0); // Heavy hit stop
              ctx.scene.cameras.main.shake(200, 0.02);
              
              // Force stun ignoring armor
              ctx.opponent.fsm.transition(CharacterStateType.HITSTUN);
              ctx.opponent.stateData.hitstunTimer = -100000; // Locked
              ctx.opponent.setVelocityX(0);
              
              this.timer = 0; // Reset timer for grab hold
            } else {
              // Missed grab
              ctx.skill1ComboStage = 1;
              ctx.skill1Cooldown = 8000;
              ctx.skill1ComboWindow = 0;
              ctx.fsm.transition(CharacterStateType.IDLE);
            }
          }
        }
      } else {
        // Holding grabbed opponent
        if (ctx.opponent) {
          ctx.opponent.fsm.transition(CharacterStateType.HITSTUN);
          ctx.opponent.rect.setPosition(ctx.rect.x + (ctx.facingRight ? 30 : -30), ctx.rect.y);
          ctx.opponent.z = ctx.z;
        }
        
        if (this.timer > 300) {
          // Finished holding stage 2
          ctx.skill1ComboStage = 3;
          ctx.skill1ComboWindow = 3000;
          ctx.fsm.transition(CharacterStateType.IDLE); // Can stand there holding them conceptually, or they drop slightly
          if (ctx.opponent) {
             ctx.opponent.stateData.hitstunTimer = 0; // Release lock slightly so they fall if no followup
          }
        }
      }

    } else if (this.stage === 3) {
      // ── Stage 3: Zero-Distance Blast ──
      const STARTUP = 100;
      
      if (this.timer < STARTUP) {
        ctx.setBodyTint(0xff0000); // Heating up
      } else if (this.timer === STARTUP || (this.timer > STARTUP && !this.hasGrabbed)) {
        this.hasGrabbed = true; // used as a "has blown up" flag
        
        // Screen flash white
        const flash = ctx.scene.add.rectangle(0, 0, ctx.scene.scale.width, ctx.scene.scale.height, 0xffffff);
        flash.setOrigin(0, 0);
        flash.setDepth(1000);
        ctx.scene.tweens.add({ targets: flash, alpha: 0, duration: 150, onComplete: () => flash.destroy() });
        
        // Manga text
        ctx.spawnMangaText('破！！', ctx.rect.x + (ctx.facingRight ? 40 : -40), ctx.rect.y, true);
        
        ctx.scene.cameras.main.shake(300, 0.04);
        ctx.applyHitStop(200, 0.05);

        // Blast opponent
        if (ctx.opponent) {
          ctx.opponent.takeHit({ damage: 45, pushbackSpeed: 1000, causesKnockdown: true, launchVelocityY: -800, groundBounce: true }, ctx.facingRight ? 1 : -1);
        }
        
        // Self pushback
        ctx.vz = -500;
        ctx.setVelocityX(ctx.facingRight ? -600 : 600);
      } else {
        if (ctx.z <= 0 && this.timer > STARTUP + 300) {
          // Finished
          ctx.skill1ComboStage = 1;
          ctx.skill1Cooldown = 12000;
          ctx.skill1ComboWindow = 0;
          ctx.fsm.transition(CharacterStateType.IDLE);
        }
      }
    }
  }

  exit(ctx: BaseCharacter): void {
    ctx.setBodyTint(ctx.baseColor);
    if (this.stage !== 2 || !this.hasGrabbed) { 
      // If we exit normally and not holding grab
      ctx.setVelocityX(0);
    }
  }
}
