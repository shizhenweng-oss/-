import Phaser from 'phaser';
import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';
import type { SeaTiger } from '../../SeaTiger';

export class SeaTigerBackDashProjectileState implements IState {
  readonly type = CharacterStateType.BACKDASH_PROJECTILE;
  private timer = 0;
  private fired = false;
  
  // To update projectile in the loop
  private proj: Phaser.GameObjects.Rectangle | null = null;
  private arrow1Emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private arrow2Emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private trailEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private collider: Phaser.Physics.Arcade.Collider | null = null;
  private baseY = 0;

  enter(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    this.timer = 0;
    this.fired = false;
    this.proj = null;
    this.arrow1Emitter = null;
    this.arrow2Emitter = null;
    this.trailEmitter = null;
    this.collider = null;
    ctx.setPose('jump');
    ctx.emitStateEvent();
  }

  update(ctx: BaseCharacter, delta: number): void {
    this.timer += delta;
    
    if (this.timer < 100) {
      // Startup
    } else if (this.timer < 300) {
      // Dash back
      ctx.setVelocityX(ctx.facingRight ? -1000 : 1000);
      
      if (!this.fired) {
        this.fired = true;
        const st = ctx as SeaTiger;
        st.spawnMangaText('后撤电刃！', st.rect.x, st.rect.y, false);
        
        const dir = st.facingRight ? 1 : -1;
        this.baseY = st.rect.y - 20;
        
        // Invisible Hitbox
        this.proj = st.scene.add.rectangle(st.rect.x + (50 * dir), this.baseY, 100, 60, 0x00ffff, 0); 
        st.scene.physics.add.existing(this.proj);
        const body = this.proj.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        body.setVelocityX(dir * 2500); 
        
        // Define two arrow geometries (pointing in movement direction)
        const arrow1Geom = new Phaser.Geom.Triangle(
          dir > 0 ? 50 : -50, 0, // Tip
          dir > 0 ? 0 : 0, -30, // Top back
          dir > 0 ? 0 : 0, 30 // Bottom back
        );

        const arrow2Geom = new Phaser.Geom.Triangle(
          dir > 0 ? 10 : -10, 0, // Tip
          dir > 0 ? -40 : 40, -30, // Top back
          dir > 0 ? -40 : 40, 30 // Bottom back
        );

        // Arrow 1 Emitter (Front) - Red and Black particles
        this.arrow1Emitter = st.scene.add.particles(0, 0, 'spark', {
          lifespan: 150,
          scale: { start: 0.6, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0xff0000, 0x000000, 0x880000],
          blendMode: 'NORMAL', // So black is visible
          speed: 0,
          frequency: 1, // Extremely dense
          follow: this.proj,
          emitZone: { type: 'random', source: arrow1Geom }
        });

        // Arrow 2 Emitter (Back) - Red and Black particles
        this.arrow2Emitter = st.scene.add.particles(0, 0, 'spark', {
          lifespan: 150,
          scale: { start: 0.6, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0xff0000, 0x000000, 0x880000],
          blendMode: 'NORMAL',
          speed: 0,
          frequency: 1, // Extremely dense
          follow: this.proj,
          emitZone: { type: 'random', source: arrow2Geom }
        });

        // Intense lightning particle trail (Blue)
        this.trailEmitter = st.scene.add.particles(0, 0, 'spark', {
          lifespan: { min: 100, max: 400 },
          scale: { start: 0.9, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0x00ffff, 0xffffff, 0x00aaff],
          blendMode: 'ADD',
          speed: { min: 300, max: 1000 },
          angle: { min: 0, max: 360 }, 
          frequency: 5, 
          follow: this.proj,
          emitZone: { type: 'random', source: arrow2Geom }
        });
        
        // Collision
        let hit = false;
        this.collider = st.scene.physics.add.overlap(this.proj, st.opponent.rect, () => {
          if (hit) return;
          hit = true;
          
          // Deal damage
          st.opponent.takeHit({
            damage: 20,
            pushbackSpeed: 800,
            causesKnockdown: true
          }, dir);
          
          st.spawnShockwave(st.opponent.rect.x, st.opponent.rect.y, 0x00ffff, 2.0);
          
          // Stop and explode projectile
          if (this.proj) {
            const b = this.proj.body as Phaser.Physics.Arcade.Body;
            b.setVelocity(0, 0);
            this.proj.destroy();
            this.proj = null;
          }
          if (this.arrow1Emitter) {
            this.arrow1Emitter.stop();
          }
          if (this.arrow2Emitter) {
            this.arrow2Emitter.stop();
          }
          if (this.trailEmitter) {
            this.trailEmitter.stop();
          }
          if (this.collider) {
            this.collider.destroy();
            this.collider = null;
          }

          // Blue mist effect on the enemy
          const mistEmitter = st.scene.add.particles(0, 0, 'spark', {
            lifespan: { min: 200, max: 600 },
            scale: { start: 2.0, end: 0 },
            alpha: { start: 0.6, end: 0 },
            tint: [0x0055ff, 0x0088ff],
            blendMode: 'ADD',
            speed: { min: 50, max: 200 },
            angle: { min: 0, max: 360 },
            frequency: 10,
            follow: st.opponent.rect, // Follow the enemy
          });
          
          // Big explosion at impact
          st.scene.add.particles(st.opponent.rect.x, st.opponent.rect.y, 'spark', {
            lifespan: 300,
            scale: { start: 3, end: 0 },
            alpha: { start: 1, end: 0 },
            tint: 0xffffff,
            blendMode: 'ADD',
            speed: { min: 500, max: 1500 },
            quantity: 30,
            duration: 50
          });

          // Cleanup mist after a short time
          st.scene.time.delayedCall(800, () => {
            mistEmitter.stop();
            setTimeout(() => mistEmitter.destroy(), 1000);
          });
        });

        // Cleanup projectile if it missed
        st.scene.time.delayedCall(800, () => {
          if (this.proj) this.proj.destroy();
          if (this.collider) this.collider.destroy();
          if (this.arrow1Emitter) {
            this.arrow1Emitter.stop();
            setTimeout(() => this.arrow1Emitter?.destroy(), 200);
          }
          if (this.arrow2Emitter) {
            this.arrow2Emitter.stop();
            setTimeout(() => this.arrow2Emitter?.destroy(), 200);
          }
          if (this.trailEmitter) {
            this.trailEmitter.stop();
            setTimeout(() => this.trailEmitter?.destroy(), 200);
          }
        });
      }
    } else if (this.timer < 500) {
      // Recovery
      ctx.setVelocityX(0);
    } else {
      ctx.fsm.transition(CharacterStateType.IDLE);
    }
    
    // Z-zag motion logic for projectile
    if (this.proj) {
      // Sine wave on Y axis: amplitude 60, speed 0.05
      const wave = Math.sin(this.timer * 0.06) * 80;
      this.proj.y = this.baseY + wave;
    }
  }

  exit(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
  }
}
