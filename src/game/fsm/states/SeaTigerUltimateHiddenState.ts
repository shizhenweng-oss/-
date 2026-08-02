import { type IState } from '../CharacterFSM';
import { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';
import { EventBus, EVENTS } from '../../EventBus';

export class SeaTigerUltimateHiddenState implements IState {
  readonly type = CharacterStateType.ULTIMATE_HIDDEN;
  private timer: number = 0;
  phase: number = 0;
  impactDealt: boolean = false;
  videoFinished: boolean = false;
  private onVideoEndHandler: () => void;
  
  constructor() {
    this.onVideoEndHandler = () => {
      this.videoFinished = true;
    };
  }

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

         // Add persistent blood steam hurricane emitter (Red)
         st.seaTigerData.ribBurstEmitter = ctx.scene.add.particles(0, 0, 'spark', {
            lifespan: { min: 600, max: 1200 },
            scale: { start: 0.8, end: 0 },
            alpha: { start: 0.8, end: 0 },
            tint: 0xff0000, // Blood red steam
            blendMode: 'ADD',
            speedY: { min: -500, max: -150 },
            speedX: { min: -150, max: 150 }, // Spreads out like a V (hurricane)
            accelerationY: -300,
            frequency: 2, // Even more dense
            follow: ctx.hurtbox, // Track the jumping hurtbox!
            followOffset: { x: 0, y: 30 } // Starts near waist/legs
         });
         
         // Add black smoke for realism (NORMAL blend mode to be visible)
         st.seaTigerData.ribBurstSmokeEmitter = ctx.scene.add.particles(0, 0, 'spark', {
            lifespan: { min: 800, max: 1500 },
            scale: { start: 1.2, end: 0 },
            alpha: { start: 0.5, end: 0 },
            tint: 0x222222, // Dark smoke
            blendMode: 'NORMAL',
            speedY: { min: -400, max: -100 },
            speedX: { min: -100, max: 100 },
            accelerationY: -200,
            frequency: 6, // Sparse but visible
            follow: ctx.hurtbox,
            followOffset: { x: 0, y: 30 }
         });
      }
      
      // Emit Phase 1 UI (Text: 他妈的...现在，已是去尽的时候...)
      EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 1 });
      ctx.scene.physics.pause(); // Pause for the dialogue
      ctx.emitStateEvent();
    } else {
      // PHASE 2: Video Cinematic and Attack (Second X Press)
      this.phase = 2;
      this.videoFinished = false;
      EventBus.on(EVENTS.UI_CINEMATIC_VIDEO_ENDED, this.onVideoEndHandler);
      EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 2 });
      
      ctx.scene.physics.pause(); // Stop frame during UI + video
      ctx.emitStateEvent();
    }
  }

  update(ctx: BaseCharacter, delta: number): void {
    this.timer += delta;
    ctx.setVelocityX(0);

    if (this.phase === 1) {
      if (this.timer > 4000) {
        // Return to IDLE after dialogue finishes
        EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 0 }); // clear UI
        ctx.scene.physics.resume();
        ctx.fsm.transition(CharacterStateType.IDLE);
      }
    } 
    else if (this.phase === 2) {
      if (this.timer >= 3000 && !this.impactDealt) {
         this.impactDealt = true; // Use this flag to indicate video has started
         EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 5 }); // 5 = Play Video
      }
      
      if (this.videoFinished) {
         ctx.scene.physics.resume();
         
         // Apply damage and effects now that video is done
         if (ctx.opponent) {
            ctx.scene.cameras.main.shake(1000, 0.05); // Minor shake for transition
            ctx.spawnShockwave(ctx.opponent.rect.x, ctx.opponent.rect.y, 0xff0000, 10.0);
            ctx.opponent.takeHit({ damage: 99999, pushbackSpeed: 3000, causesKnockdown: true }, ctx.facingRight ? 1 : -1);
         }
         
         this.phase = 4;
         this.timer = 0;
         EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 0 }); // clear video UI
         
         const st = ctx as any;
         if (st.seaTigerData?.ribBurstEmitter) {
            st.seaTigerData.ribBurstEmitter.destroy();
            st.seaTigerData.ribBurstEmitter = null;
         }
         if (st.seaTigerData?.ribBurstSmokeEmitter) {
            st.seaTigerData.ribBurstSmokeEmitter.destroy();
            st.seaTigerData.ribBurstSmokeEmitter = null;
         }
         
         // Fall to the ground (lying pose)
         if (ctx.sprite) {
            ctx.sprite.setTexture('seatiger_ultimate');
            ctx.sprite.setAngle(ctx.facingRight ? -90 : 90);
            ctx.spriteOffsetY = ctx.sprite.displayHeight / 2;
         }
         ctx.setBodyTint(0x555555); // Exhausted
         
         const rng = Math.random();
         if (rng < 0.1) {
            EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 4 }); // Survive text
         } else {
            EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 6 }); // Die text
            ctx.hp = 0;
            EventBus.emit(EVENTS.PLAYER_HP_CHANGED, {
               player: ctx.playerId,
               hp:     ctx.hp,
               maxHp:  ctx.maxHp,
            });
         }
      }
    }
    else if (this.phase === 4) {
       if (this.timer > 4000) {
          // Keep him fallen! Do not reset angle or transition to IDLE.
          EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 0 }); // clear
          this.phase = 5; // Idle fallen state
       }
    }
    else if (this.phase === 5) {
       // Just lie there. Match is likely over or he's too exhausted to move.
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
