import { type IState } from '../CharacterFSM';
import { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';
import { EventBus, EVENTS } from '../../EventBus';

export class SeaTigerUltimateHiddenState implements IState {
  readonly type = CharacterStateType.ULTIMATE_HIDDEN;
  private timer = 0;
  private phase = 0;
  private impactDealt = false;

  enter(ctx: BaseCharacter): void {
    this.timer = 0;
    this.impactDealt = false;
    ctx.setVelocityX(0);

    const st = ctx as any;
    const isRibBurst = st.seaTigerData?.isRibBurstForm;

    if (!isRibBurst) {
      // PHASE 1: Transform to Rib Burst Form
      this.phase = 1;
      ctx.setPose('ultimate');
      
      // Permanently set Rib Burst
      if (st.seaTigerData) {
         st.seaTigerData.isRibBurstForm = true;
         if (ctx.spritesConfig) {
            ctx.spritesConfig.idle = 'sea_tiger_rib_burst';
            ctx.spritesConfig.punch = 'sea_tiger_rib_burst';
            ctx.spritesConfig.ultimate = 'sea_tiger_rib_burst';
         }
         // Set texture to rib burst
         if (ctx.sprite) {
            ctx.sprite.setTexture('sea_tiger_rib_burst');
            ctx.sprite.setAngle(0);
            ctx.sprite.setOrigin(0.5, 0.5);
         }

         // Add persistent blood steam hurricane emitter
         st.seaTigerData.ribBurstEmitter = ctx.scene.add.particles(0, 0, 'spark', {
            lifespan: { min: 600, max: 1200 },
            scale: { start: 1.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            tint: 0xff0000, // Blood red steam
            blendMode: 'ADD',
            speedY: { min: -500, max: -150 },
            speedX: { min: -150, max: 150 }, // Spreads out like a V (hurricane)
            accelerationY: -300,
            frequency: 5, // Extremely dense
            follow: ctx.hurtbox, // Track the jumping hurtbox!
            followOffset: { x: 0, y: 30 } // Starts near waist/legs
         });
         
         // Spotlight / Dim background
         st.seaTigerData.dimBg = ctx.scene.add.rectangle(0, 0, 9999, 9999, 0x000000, 0.8).setOrigin(0, 0).setDepth(9);
      }
      
      EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 1 });
      ctx.emitStateEvent();
    } else {
      // PHASE 2: Tracking and Strike
      this.phase = 2;
      ctx.scene.physics.pause(); // Stop frame
      EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 2 });
      
      if (ctx.opponent) {
         const oppX = ctx.opponent.rect.x;
         const onLeft = ctx.rect.x < oppX;
         const behindX = onLeft ? oppX + 80 : oppX - 80;
         ctx.getBody()?.reset(behindX, ctx.rect.y);
         ctx.facingRight = ctx.rect.x < oppX;
         if (ctx.sprite) ctx.sprite.setFlipX(!ctx.facingRight);
      }
    }
  }

  update(ctx: BaseCharacter, delta: number): void {
    this.timer += delta;
    ctx.setVelocityX(0);

    if (this.phase === 1) {
      // Violent shake
      ctx.spriteOffsetX = (Math.random() - 0.5) * 20;

      // Stay in Phase 1 for 4 seconds to let UI text grow
      if (this.timer > 4000) {
        ctx.spriteOffsetX = 0;
        const st = ctx as any;
        if (st.seaTigerData?.dimBg) {
           st.seaTigerData.dimBg.destroy();
           st.seaTigerData.dimBg = null;
        }
        EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 0 }); // clear UI
        ctx.fsm.transition(CharacterStateType.IDLE);
      }
    } 
    else if (this.phase === 2) {
      // Wait for Phase 2 UI (Crack + Flash + Text) to finish (about 4.2s)
      if (this.timer >= 4200) {
        this.phase = 3;
        this.timer = 0;
        
        ctx.scene.physics.resume();
        
        if (ctx.opponent) {
           ctx.scene.cameras.main.shake(2000, 0.1); // Massive Shake
           ctx.spawnShockwave(ctx.opponent.rect.x, ctx.opponent.rect.y, 0xff0000, 10.0);
           
           ctx.scene.add.particles(ctx.opponent.rect.x, ctx.opponent.rect.y, 'spark', {
              lifespan: 1000,
              scale: { start: 15, end: 0 },
              alpha: { start: 1, end: 0 },
              tint: 0xff0000, // SOLID RED TO PREVENT CRASH
              blendMode: 'ADD',
              speed: { min: 1000, max: 3500 },
              quantity: 400,
              duration: 200
           });
           
           // Emit Phase 3 UI (Moon Shatter)
           EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 3 });
           ctx.opponent.takeHit({ damage: 99999, pushbackSpeed: 3000, causesKnockdown: true }, ctx.facingRight ? 1 : -1);
        }
      }
    }
    else if (this.phase === 3) {
       // Wait for Moon Shatter UI to finish (3s)
       if (this.timer >= 3000 && !this.impactDealt) {
          this.impactDealt = true;
          this.phase = 4;
          this.timer = 0;
          
          const st = ctx as any;
          if (st.seaTigerData?.ribBurstEmitter) {
             st.seaTigerData.ribBurstEmitter.destroy();
             st.seaTigerData.ribBurstEmitter = null;
          }
          
          // Fall to the ground (lying pose)
          if (ctx.sprite) {
             ctx.sprite.setAngle(ctx.facingRight ? -90 : 90);
             ctx.spriteOffsetY = ctx.sprite.displayHeight / 2; // Shift down visually
          }
          ctx.setBodyTint(0x555555); // Exhausted
          
          const rng = Math.random();
          if (rng < 0.1) {
             EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 4 }); // Survive text
          } else {
             EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 5 }); // Die text
             ctx.takeHit({ damage: 99999, pushbackSpeed: 0, causesKnockdown: true }, 1);
          }
       }
    }
    else if (this.phase === 4) {
       if (this.timer > 4000) {
          ctx.spriteOffsetY = 0; // reset
          if (ctx.sprite) ctx.sprite.setAngle(0);
          EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 0 }); // clear
          if (ctx.hp > 0) {
            ctx.fsm.transition(CharacterStateType.IDLE);
          }
       }
    }
  }

  exit(ctx: BaseCharacter): void {
    ctx.spriteOffsetX = 0;
    ctx.spriteOffsetY = 0;
    if (ctx.sprite) ctx.sprite.setAngle(0);
    const st = ctx as any;
    if (st.seaTigerData?.dimBg) {
       st.seaTigerData.dimBg.destroy();
       st.seaTigerData.dimBg = null;
    }
    ctx.scene.physics.resume();
  }
}
