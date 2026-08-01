import type { IState } from '../CharacterFSM';
import type { BaseCharacter } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';
import { EventBus, EVENTS } from '../../EventBus';
import Phaser from 'phaser';

// ─────────────────────────────────────────────────────────────────────────────
// SeaTigerUltimateState — 一百万匹海虎爆破拳 (1,000,000 Force Sea Tiger Blast Punch)
// Cinematic 4-Stage sequence
// ─────────────────────────────────────────────────────────────────────────────

const STAGE1_DUR = 800; // Camera zoom, overload UI, charging
const STAGE2_DUR = 2500; // Time Freeze & Narration

export class SeaTigerUltimateState implements IState {
  readonly type = CharacterStateType.ULTIMATE_ATTACK;
  
  private stage = 1;
  private timer = 0;
  private invertRect?: Phaser.GameObjects.Rectangle;
  private whiteBg?: Phaser.GameObjects.Rectangle;
  private blackRect?: Phaser.GameObjects.Rectangle;
  private narrationText?: Phaser.GameObjects.Text;
  private hasHit = false;

  enter(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    ctx.ignoreTimeScale = true;
    this.stage = 1;
    this.timer = 0;
    this.hasHit = false;
    
    // Play SFX or just set pose
    ctx.setPose('idle');
    ctx.emitStateEvent();

    // ── Stage 1: UI Overload & Zoom ──
    // Zoom camera in on Sea Tiger
    ctx.scene.cameras.main.pan(ctx.rect.x, ctx.rect.y - 50, 400, 'Sine.easeOut');
    ctx.scene.cameras.main.zoomTo(1.5, 400, 'Sine.easeOut');

    // Darken background
    ctx.scene.cameras.main.setBackgroundColor('#050505');

    // UI Overload
    EventBus.emit(EVENTS.PLAYER_FORCE_OVERLOAD, { player: ctx.playerId, overloaded: true });
    
    // Aura tint
    ctx.setBodyTint(0x00ffff);
  }

  update(ctx: BaseCharacter, delta: number): void {
    this.timer += delta;

    if (this.stage === 1) {
      // Charging aura flicker
      if (this.timer % 100 < 50) {
        ctx.setBodyTint(0xffffff);
      } else {
        ctx.setBodyTint(0x00ffff);
      }

      if (this.timer >= STAGE1_DUR) {
        // ── Stage 2: Time Freeze & Full Screen Black Narration ──
        this.stage = 2;
        this.timer = 0;
        
        // Stop the world!
        ctx.applyHitStop(STAGE2_DUR, 0.001); // Almost complete freeze
        
        const cx = ctx.scene.scale.width / 2;
        const cy = ctx.scene.scale.height / 2;

        // Full screen black
        this.blackRect = ctx.scene.add.rectangle(0, 0, cx * 2, cy * 2, 0x000000);
        this.blackRect.setOrigin(0, 0).setDepth(9999).setScrollFactor(0);

        // Avatar
        // Assuming 'seatiger_avatar' texture is loaded from GameScene preload (we might need to ensure it, or just not use avatar if missing)
        // Let's just use text if we can't easily access the avatar, but we know '/assets/seatiger_avatar.png' is an HTML asset. 
        // Phaser might not have it preloaded. To be safe, we'll just do giant text, or if 'seatiger' texture exists we use that.
        // Let's just use pure red dramatic text centered on the black screen!
        
        this.narrationText = ctx.scene.add.text(cx, cy, "", {
          fontFamily: '"Arial Black", Impact, sans-serif',
          fontSize: '48px',
          fontStyle: 'italic',
          color: '#ffffff',
          stroke: '#ff0000',
          strokeThickness: 8,
          shadow: { offsetX: 0, offsetY: 0, color: '#ff0000', blur: 20, stroke: true, fill: true },
          align: 'center',
          wordWrap: { width: cx * 1.5 }
        }).setOrigin(0.5).setDepth(10000).setScrollFactor(0);
      }
    } else if (this.stage === 2) {
      // Typewriter effect
      const fullText = "战他娘亲！\n一百万匹力量，\n给我破呀！！！";
      // 18 chars over 2000ms -> roughly 1 char every 110ms
      const charsToShow = Math.floor(this.timer / 110);
      if (this.narrationText) {
        this.narrationText.setText(fullText.substring(0, charsToShow));
      }

      if (this.timer >= STAGE2_DUR) {
        // ── Stage 3: The Strike (0-Frame Teleport & Color Invert) ──
        this.stage = 3;
        this.timer = 0;
        
        if (this.blackRect) { this.blackRect.destroy(); this.blackRect = undefined; }
        if (this.narrationText) { this.narrationText.destroy(); this.narrationText = undefined; }

        ctx.setPose('punch');
        
        if (ctx.opponent) {
          ctx.rect.setPosition(ctx.opponent.rect.x + (ctx.facingRight ? -40 : 40), ctx.opponent.rect.y);
          ctx.z = ctx.opponent.z;
          
          // Apply hit stop again for the impact
          ctx.applyHitStop(1500, 0.01);
          
          // IMPORTANT FIX FOR BLINDING LIGHT:
          // A Difference filter over a dark stage background turns it WHITE (blinding).
          // To get a pitch black background, we cover the stage with a WHITE rectangle at Depth 1 (behind characters).
          // The Difference filter will invert this white rectangle into PITCH BLACK!
          this.whiteBg = ctx.scene.add.rectangle(0, 0, ctx.scene.scale.width, ctx.scene.scale.height, 0xffffff);
          this.whiteBg.setOrigin(0, 0).setDepth(1).setScrollFactor(0);

          // Color Invert
          this.invertRect = ctx.scene.add.rectangle(0, 0, ctx.scene.scale.width, ctx.scene.scale.height, 0xffffff);
          this.invertRect.setOrigin(0, 0).setDepth(9999).setScrollFactor(0);
          this.invertRect.setBlendMode(Phaser.BlendModes.DIFFERENCE);

          const texts = ['嘭！海！', '嘭！虎！', '嘭！爆！', '嘭！破！', '轰——！！！拳！！！'];
          texts.forEach((txt, idx) => {
            setTimeout(() => {
              if (ctx.scene && ctx.scene.sys && ctx.scene.sys.isActive()) {
                const isHuge = idx === texts.length - 1;
                ctx.spawnMangaText(txt, ctx.rect.x + (ctx.facingRight ? 40 : -40), ctx.rect.y - idx * 20, isHuge);
                ctx.scene.cameras.main.shake(100, isHuge ? 0.05 : 0.02);
                if (isHuge) this.createShatterEffect(ctx);
              }
            }, 200 + idx * 250);
          });
        }
      }
    } else if (this.stage === 3) {
      if (this.timer > 1500) {
        // ── Stage 4: Blast Away & Recovery ──
        this.stage = 4;
        this.timer = 0;

        // Remove invert filter
        if (this.invertRect) {
          this.invertRect.destroy();
          this.invertRect = undefined;
        }

        // Camera reset
        ctx.scene.cameras.main.zoomTo(1, 600, 'Power2');
        const cx = ctx.scene.scale.width / 2;
        const cy = ctx.scene.scale.height / 2;
        ctx.scene.cameras.main.pan(cx, cy, 600, 'Power2');

        // Blast opponent
        if (ctx.opponent && !this.hasHit) {
          this.hasHit = true;
          ctx.opponent.takeHit({
            damage: 80, // Massive damage
            pushbackSpeed: 2000,
            causesKnockdown: true,
            launchVelocityY: -300, // Stay low to slide
            groundBounce: true
          }, ctx.facingRight ? 1 : -1);
          
          // Steam effect on Sea Tiger
          this.createSteamEffect(ctx);
        }
      }
    } else if (this.stage === 4) {
      // Recovery & Steam
      if (this.timer > 1500) {
        ctx.fsm.transition(CharacterStateType.IDLE);
      }
    }
  }

  private createShatterEffect(ctx: BaseCharacter) {
    const cx = ctx.scene.scale.width / 2;
    const cy = ctx.scene.scale.height / 2;

    // Exploding glass shards
    for (let i = 0; i < 20; i++) {
      const graphics = ctx.scene.add.graphics();
      graphics.setDepth(10000).setScrollFactor(0);
      graphics.fillStyle(0xffffff, Phaser.Math.Between(60, 100) / 100);
      
      // Draw random triangle shard
      graphics.beginPath();
      graphics.moveTo(0, 0);
      graphics.lineTo(Phaser.Math.Between(-50, 50), Phaser.Math.Between(50, 150));
      graphics.lineTo(Phaser.Math.Between(50, 150), Phaser.Math.Between(-50, 50));
      graphics.closePath();
      graphics.fillPath();

      graphics.setPosition(cx + Phaser.Math.Between(-100, 100), cy + Phaser.Math.Between(-100, 100));
      
      // Explode outwards
      const angle = Math.random() * Math.PI * 2;
      const dist = 800 + Math.random() * 500;
      
      ctx.scene.tweens.add({
        targets: graphics,
        x: graphics.x + Math.cos(angle) * dist,
        y: graphics.y + Math.sin(angle) * dist,
        rotation: Phaser.Math.Between(-10, 10),
        alpha: 0,
        duration: 600 + Math.random() * 400,
        ease: 'Cubic.easeOut',
        onComplete: () => graphics.destroy()
      });
    }

    // Cracks web
    const crack = ctx.scene.add.graphics();
    crack.setDepth(10000).setScrollFactor(0);
    crack.lineStyle(4, 0xffffff, 1);
    
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const len = 400 + Math.random() * 600;
      crack.beginPath();
      crack.moveTo(cx, cy);
      let px = cx;
      let py = cy;
      for (let j = 0; j < 6; j++) {
        px += Math.cos(angle) * (len / 6) + (Math.random() - 0.5) * 60;
        py += Math.sin(angle) * (len / 6) + (Math.random() - 0.5) * 60;
        crack.lineTo(px, py);
      }
      crack.strokePath();
    }
    
    ctx.scene.tweens.add({
      targets: crack,
      alpha: 0,
      duration: 300,
      onComplete: () => crack.destroy()
    });
  }

  private createSteamEffect(ctx: BaseCharacter) {
    // Sea Tiger has a 10% chance of surviving this punch. He is burning his life force.
    // The steam is now high-density, tiny-pixel "heat waves" radiating off his body.
    let emitCount = 0;
    const emit = () => {
      if (!ctx.scene || !ctx.scene.sys || !ctx.scene.sys.isActive() || this.stage !== 4) return;
      
      // Spawn 20 tiny particles per tick
      for (let i = 0; i < 20; i++) {
        const steam = ctx.scene.add.rectangle(
          ctx.rect.x + Phaser.Math.Between(-25, 25),
          ctx.rect.y - (ctx.z || 0) - Phaser.Math.Between(0, 100),
          Phaser.Math.Between(2, 6), 
          Phaser.Math.Between(2, 6), 
          0xffffff
        );
        steam.setAlpha(Phaser.Math.Between(40, 80) / 100);
        steam.setDepth(150);
        
        ctx.scene.tweens.add({
          targets: steam,
          y: steam.y - Phaser.Math.Between(100, 250),
          x: steam.x + Phaser.Math.Between(-30, 30),
          scale: Phaser.Math.Between(1, 2),
          alpha: 0,
          duration: Phaser.Math.Between(800, 1500),
          ease: 'Sine.easeOut',
          onComplete: () => steam.destroy()
        });
      }
      
      emitCount++;
      if (emitCount < 80) { // Run for 4 seconds (80 * 50ms)
        setTimeout(emit, 50);
      }
    };
    emit();
  }

  exit(ctx: BaseCharacter): void {
    ctx.ignoreTimeScale = false;
    ctx.setBodyTint(ctx.baseColor);
    EventBus.emit(EVENTS.PLAYER_FORCE_OVERLOAD, { player: ctx.playerId, overloaded: false });
    
    if (this.invertRect) { this.invertRect.destroy(); this.invertRect = undefined; }
    if (this.whiteBg)    { this.whiteBg.destroy();    this.whiteBg = undefined; }
    if (this.blackRect)  { this.blackRect.destroy();  this.blackRect = undefined; }
    if (this.narrationText) { this.narrationText.destroy(); this.narrationText = undefined; }

    ctx.scene.cameras.main.setBackgroundColor('#242424'); // Default back
  }
}
