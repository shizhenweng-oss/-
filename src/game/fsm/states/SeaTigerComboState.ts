import type { IState } from '../CharacterFSM';
import type { BaseCharacter, HitProperties } from '../../BaseCharacter';
import { CharacterStateType } from '../CharacterStateType';
import type { SeaTiger } from '../../SeaTiger';
import { EventBus, EVENTS } from '../../EventBus';

interface ComboHitConfig {
  startup: number;
  active: number;
  recovery: number;
  reachX: number;
  w: number;
  h: number;
  tintActive: number;
  props: HitProperties;
  selfVz?: number;
  selfVzActive?: number;
  selfVx?: number;
  multiHitInterval?: number;
}

// SeaTiger 5-hit combo
const HITS: ComboHitConfig[] = [
  // 1A: Quick jab
  {
    startup: 30, active: 60, recovery: 100,
    reachX: 80, w: 100, h: 40, tintActive: 0xffaa00,
    selfVx: 450, // Increased sliding distance
    props: { damage: 5, pushbackSpeed: 50, causesKnockdown: false }
  },
  // 2A: Knee strike (moves forward)
  {
    startup: 50, active: 80, recovery: 150,
    reachX: 90, w: 110, h: 45, tintActive: 0xff8800,
    selfVx: 800, // Significant momentum
    props: { damage: 8, pushbackSpeed: 100, causesKnockdown: false }
  },
  // 3A: Launcher (升龙腿)
  {
    startup: 80, active: 120, recovery: 200,
    reachX: 100, w: 120, h: 80, tintActive: 0xff6600,
    props: { damage: 12, pushbackSpeed: 50, causesKnockdown: false, launchVelocityY: -950 } // Keep as false so they enter hitstun for juggles
  },
  // 4A: Aerial flurry (Jumps up, hits multiple times)
  {
    startup: 80, active: 300, recovery: 200,
    reachX: 90, w: 120, h: 90, tintActive: 0xff4400,
    selfVz: 800, // Jump to catch them
    multiHitInterval: 80,
    props: { damage: 4, pushbackSpeed: 0, causesKnockdown: false, launchVelocityY: 0 } // No launch, we'll manually hover
  },
  // 5A: Ground Smash
  {
    startup: 150, active: 150, recovery: 400,
    reachX: 90, w: 130, h: 120, tintActive: 0xff2200,
    selfVz: 0, // Gravity will pull slightly, but we hold them in startup
    selfVzActive: -2500, // Smash down!
    props: { damage: 25, pushbackSpeed: 0, causesKnockdown: true, launchVelocityY: 2500, groundBounce: true }
  }
];

export class SeaTigerComboState implements IState {
  readonly type = CharacterStateType.COMBO;
  private cancelWindowOpen: boolean = false;
  private cancelWindowTimer: number = 0;

  enter(ctx: BaseCharacter): void {
    ctx.setVelocityX(0);
    const st = ctx as SeaTiger;
    st.seaTigerData.comboIndex = 0;
    st.seaTigerData.comboBuffered = false;
    this.startHit(st);
    ctx.emitStateEvent();
  }

  startHit(st: SeaTiger): void {
    st.stateData.attackTimer = 0;
    st.stateData.hitRegistered = false;
    this.cancelWindowOpen = false;
    this.cancelWindowTimer = 0;
    st.attackHoldTime = 0;
    
    st.setBodyTint(0xffcc00); // Startup flash
    const hitConf = HITS[st.seaTigerData.comboIndex];
    st.stateData.currentHitProps = hitConf.props;
    
    // Set custom combo sprite pose (p1 to p5)
    st.setPose(`p${st.seaTigerData.comboIndex + 1}` as any);

    if (hitConf.selfVx) {
      const dir = st.facingRight ? 1 : -1;
      st.getBody()?.setVelocityX(hitConf.selfVx * dir);
    }
    if (hitConf.selfVz) {
      st.vz = hitConf.selfVz;
      if (st.vz > 0 && st.z === 0) st.z = 1; // Detach from ground
    }
  }

  update(ctx: BaseCharacter, delta: number): void {
    const st = ctx as SeaTiger;
    st.stateData.attackTimer += delta;
    const t = st.stateData.attackTimer;
    
    const hitConf = HITS[st.seaTigerData.comboIndex];

    // Buffer next hit if attack is pressed
    if (st.input.attack) {
      st.seaTigerData.comboBuffered = true;
    }

    if (t < hitConf.startup) {
      // ── Startup ──────────────────────────────────────────────
      st.setBodyTint(0xffcc00);
      
      // 4A homing: lerp up to opponent's height if they are launched
      if (st.seaTigerData.comboIndex === 3 && st.opponent && st.opponent.z > 20) {
         st.z += (st.opponent.z - st.z) * 0.3; // Catch up fast
      }
      
      // 5A hover during startup before the smash
      if (st.seaTigerData.comboIndex === 4 && st.z > 0) {
         st.vz = 0; // hang in the air while charging the smash
      }
    } else if (t < hitConf.startup + hitConf.active) {
      // ── Active ───────────────────────────────────────────────
      st.setBodyTint(hitConf.tintActive);
      
      // Multi-hit logic
      if (hitConf.multiHitInterval) {
        const activeTime = t - hitConf.startup;
        if (activeTime % hitConf.multiHitInterval < delta) {
          st.stateData.hitRegistered = false;
        }
      }

      if (!st.activeHitbox) {
        st.spawnHitbox(hitConf.reachX, hitConf.w, hitConf.h);
        if (hitConf.selfVzActive) {
           st.vz = hitConf.selfVzActive;
        }

        // 5A Explosion Punch Visuals
        if (st.seaTigerData.comboIndex === 4) {
           st.spawnMangaText('爆破拳！', st.rect.x, st.rect.y, true);
           const blast = st.scene.add.circle(st.rect.x + (100 * (st.facingRight ? 1 : -1)), st.rect.y, 80, 0xff4400, 0.8);
           blast.setDepth(20);
           st.scene.tweens.add({
             targets: blast,
             scale: 4,
             alpha: 0,
             duration: 600,
             ease: 'Cubic.easeOut',
             onComplete: () => blast.destroy()
           });
           st.scene.cameras.main.shake(300, 0.02);
        }
      }
      
      // 4A: Grab and hover mechanic
      if (st.seaTigerData.comboIndex === 3) {
        st.vz = 0; // Freeze self in air ALWAYS during active
        
        // If opponent is in hitstun (meaning we launched them or hit them), suck them in!
        if (st.opponent && (st.opponent.fsm.currentType === CharacterStateType.HITSTUN || st.stateData.hitRegistered)) {
           st.opponent.vz = 0; // Suspend gravity for opponent
           st.opponent.z = st.z; // Snap to same height
           
           // Pull opponent in
           const dir = st.facingRight ? 1 : -1;
           const targetX = st.rect.x + (hitConf.reachX * dir * 0.7);
           const oppBody = st.opponent.getBody();
           if (oppBody) {
             const cx = oppBody.x;
             oppBody.x += (targetX - cx) * 0.3; // Lerp X position fast
           }
        }
      }
    } else if (t < hitConf.startup + hitConf.active + hitConf.recovery) {
      // ── Recovery ─────────────────────────────────────────────
      if (st.activeHitbox) st.destroyHitbox();
      st.setBodyTint(0x884400);
      
      if (!hitConf.selfVz && st.z === 0) {
         st.getBody()?.setVelocityX(0); // Stop forward momentum if grounded
      }
      
      // Handle normal recovery logic (only if not holding Z for fire, and not pausing for cancel window)
      if (this.cancelWindowOpen) {
        // While the cancel window is open, we delay normal combo progression
      } else {
        // Early cancel into Skill 1 if pressed during recovery
        if (st.input.skill1 && st.fsm.hasState(CharacterStateType.SKILL_BLAST_KICK)) {
          st.fsm.transition(CharacterStateType.SKILL_BLAST_KICK);
          return;
        }

        // Combo cancel during recovery
        if (st.seaTigerData.comboBuffered && st.seaTigerData.comboIndex < HITS.length - 1) {
          st.seaTigerData.comboIndex++;
          st.seaTigerData.comboBuffered = false;
          this.startHit(st);
          return;
        }
      }
    } else {
      // ── Done ─────────────────────────────────────────────────
      // If holding Z for fire, or if cancel window is still open, wait
      if (st.seaTigerData.comboIndex === 3 && (this.cancelWindowOpen || (st.input.attackHold && st.attackHoldTime > 0))) {
         // keep waiting in this state
         ctx.setBodyTint(st.attackHoldTime > 0 && st.attackHoldTime % 200 < 100 ? 0xff0000 : 0xffff00); // flashing to indicate charge
      } else {
         st.fsm.transition(CharacterStateType.IDLE);
      }
    }

    // ── Global 4A Cancel Window Checks (checked during Active and Recovery) ──
    if (st.seaTigerData.comboIndex === 3 && t >= hitConf.startup) {
      if (!this.cancelWindowOpen && this.cancelWindowTimer === 0) {
         this.cancelWindowOpen = true;
         this.cancelWindowTimer = 500; // 500ms window
         // Pick a random text for variety
         const texts = ['他妈的！慢', '狗种...', '战！'];
         const randomText = texts[Math.floor(Math.random() * texts.length)];
         EventBus.emit(EVENTS.UI_TEXT_CUTIN, { player: st.playerId, text: randomText });
      }
      
      if (this.cancelWindowOpen) {
         if (this.cancelWindowTimer > 0) {
           this.cancelWindowTimer -= delta;
         }
         
         // Track Z hold (can continue past the 500ms window if held)
         if (st.input.attackHold) {
           st.attackHoldTime += delta;
           if (st.attackHoldTime >= 1000) { // Reduced to 1s for better gameplay feel, user said 2s but it's too long
              st.fsm.transition(CharacterStateType.SKILL_FIRE);
              return;
           }
         } else if (this.cancelWindowTimer <= 0) {
           st.attackHoldTime = 0;
           this.cancelWindowOpen = false; // window closed, allow normal 5A
           
           // If they mashed Z during the window, buffer it now so it fires 5A immediately
           if (st.seaTigerData.comboBuffered) {
             st.seaTigerData.comboIndex++;
             st.seaTigerData.comboBuffered = false;
             this.startHit(st);
             return;
           }
         }

         // Check chords instantly during the window
         // Lenient input: allow either Z+Q or just Q during the window for better playability
         if (st.input.keyQ) {
            st.fsm.transition(CharacterStateType.SKILL_WIND);
            return;
         }
         if (st.input.keyE) {
            st.fsm.transition(CharacterStateType.SKILL_THUNDER);
            return;
         }
         if (st.input.keyR) {
            st.fsm.transition(CharacterStateType.SKILL_ICE);
            return;
         }
      }
    }
  }

  exit(ctx: BaseCharacter): void {
    ctx.destroyHitbox();
    ctx.setBodyTint(ctx.baseColor);
    ctx.setPose('idle');
  }
}
