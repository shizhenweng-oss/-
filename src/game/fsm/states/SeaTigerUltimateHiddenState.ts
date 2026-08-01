import Phaser from 'phaser';
import { type IState } from '../CharacterFSM';
import { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';
import { EventBus, EVENTS } from '../../EventBus';

export class SeaTigerUltimateHiddenState implements IState {
  readonly type = CharacterStateType.ULTIMATE_HIDDEN;
  private timer = 0;
  private phase = 0;
  private mistEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private impactDealt = false;

  enter(ctx: BaseCharacter): void {
    this.timer = 0;
    this.phase = 1;
    this.impactDealt = false;
    ctx.setPose('ultimate'); // Use ultimate pose
    ctx.emitStateEvent();
    
    // Stop character movement
    ctx.setVelocityX(0);
    
    // Phase 1 UI Event
    EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 1 });
    
    // Phase 1 Effect: High temp white smoke
    this.mistEmitter = ctx.scene.add.particles(0, 0, 'spark', {
      lifespan: { min: 400, max: 800 },
      scale: { start: 1.5, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: 0xffffff,
      blendMode: 'ADD',
      speed: { min: 100, max: 300 },
      angle: { min: 250, max: 290 }, // Upwards
      frequency: 20,
      follow: ctx.rect,
      followOffset: { x: 0, y: 0 }
    });
    
    // Tint to red to simulate "burst ribs / blood"
    ctx.setBodyTint(0xff5555);
  }

  update(ctx: BaseCharacter, delta: number): void {
    this.timer += delta;
    
    // Keep character still
    ctx.setVelocityX(0);

    if (this.phase === 1) {
      // Waiting for second trigger of X key (skill2)
      if (this.timer > 500 && ctx.input.skill2) {
        this.phase = 2;
        this.timer = 0;
        
        // Trigger Hit Stop!
        ctx.scene.physics.pause();
        
        // UI Phase 2 (Black screen, 3 marks, cracked screen, large text, static image)
        EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 2 });
        
        // Teleport behind enemy
        if (ctx.opponent) {
           const oppX = ctx.opponent.rect.x;
           const onLeft = ctx.rect.x < oppX;
           const behindX = onLeft ? oppX + 80 : oppX - 80;
           ctx.getBody()?.reset(behindX, ctx.rect.y);
           // Face the opponent
           ctx.facingRight = ctx.rect.x < oppX;
           if (ctx.sprite) ctx.sprite.setFlipX(!ctx.facingRight);
        }
      }
      
      // If took too long (e.g. 5 seconds) without pressing X, cancel state
      if (this.timer > 5000) {
        if (this.mistEmitter) this.mistEmitter.destroy();
        ctx.setBodyTint(ctx.baseColor);
        EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 0 }); // clear
        ctx.fsm.transition(CharacterStateType.IDLE);
      }
    } 
    else if (this.phase === 2) {
      // Phase 2: Wait for React Cinematic to finish playing before Impact
      // React cinematic takes about 4.5 seconds
      if (this.timer >= 4500) {
        this.phase = 3;
        this.timer = 0;
        
        // Resume Physics
        ctx.scene.physics.resume();
        
        // Play huge blast logic
        if (ctx.opponent) {
           ctx.scene.cameras.main.shake(1000, 0.05);
           ctx.spawnShockwave(ctx.opponent.rect.x, ctx.opponent.rect.y, 0xff0000, 5.0);
           
           // Massive explosion particles
           ctx.scene.add.particles(ctx.opponent.rect.x, ctx.opponent.rect.y, 'spark', {
              lifespan: 1000,
              scale: { start: 10, end: 0 },
              alpha: { start: 1, end: 0 },
              tint: [0xff0000, 0xffaa00, 0xffffff],
              blendMode: 'ADD',
              speed: { min: 800, max: 2500 },
              quantity: 200,
              duration: 100
           });
           
           // Kill opponent
           ctx.opponent.takeHit({ damage: 99999, pushbackSpeed: 3000, causesKnockdown: true }, ctx.facingRight ? 1 : -1);
        }
      }
    }
    else if (this.phase === 3) {
       // Phase 3: Wait a moment for explosion, then RNG Ending
       if (this.timer >= 1500 && !this.impactDealt) {
          this.impactDealt = true;
          this.phase = 4;
          this.timer = 0;
          
          if (this.mistEmitter) this.mistEmitter.destroy();
          // Change to exhausted pose (using knockdown pose/color as placeholder)
          ctx.setPose('idle');
          ctx.setBodyTint(0x555555); // Grayed out
          
          // RNG Check
          const rng = Math.random();
          if (rng < 0.1) {
             // 10% Survival
             EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 3 });
          } else {
             // 90% Death
             EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 4 });
             // Kill self
             ctx.takeHit({ damage: 99999, pushbackSpeed: 0, causesKnockdown: true }, 1);
          }
       }
    }
    else if (this.phase === 4) {
       // The game effectively ends here (one or both are dead).
       // We can transition to IDLE or stay in knockdown depending on if we died.
       // The CSS animations take up to 6 seconds to complete.
       if (this.timer > 6500) {
          EventBus.emit(EVENTS.UI_CINEMATIC_ULTIMATE, { phase: 0 }); // clear
          if (ctx.hp > 0) {
            ctx.fsm.transition(CharacterStateType.IDLE);
          } else {
            // Stay down if dead
          }
       }
    }
  }

  exit(ctx: BaseCharacter): void {
    if (this.mistEmitter) {
      this.mistEmitter.destroy();
      this.mistEmitter = null;
    }
    // Make sure physics is resumed if interrupted
    ctx.scene.physics.resume();
  }
}
