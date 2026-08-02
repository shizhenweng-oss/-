import Phaser from 'phaser';
import { CharacterFSM }       from './fsm/CharacterFSM';
import { CharacterStateType } from './fsm/CharacterStateType';
import { IdleState }          from './fsm/states/IdleState';
import { WalkingState }       from './fsm/states/WalkingState';
import { AttackingState }     from './fsm/states/AttackingState';
import { HitstunState }       from './fsm/states/HitstunState';
import { KnockdownState }     from './fsm/states/KnockdownState';
import { FrozenState }        from './fsm/states/FrozenState';
import type { CharacterInput } from './CharacterInput';
import { emptyInput }          from './CharacterInput';
import { EventBus, EVENTS }    from './EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
export interface CharacterConfig {
  x:             number;
  y:             number;    // centre of placeholder rect
  width?:        number;
  height?:       number;
  color:         number;    // 0xRRGGBB base fill
  playerId:      1 | 2;
  name:          string;
  maxHp?:        number;
  attackDamage?: number;
  avatarKey?:    string;
  sprites?: {
    idle: string;
    punch: string;
    ultimate: string;
    p1?: string;
    p2?: string;
    p3?: string;
    p4?: string;
    p5?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hitbox geometry
// ─────────────────────────────────────────────────────────────────────────────
const HITBOX_REACH_X = 64;     // px ahead of character centre
const HITBOX_W       = 80;
const HITBOX_H       = 60;
const HITBOX_COLOR   = 0xff4400;
const HITBOX_ALPHA   = 0;      // Invisible normal hitboxes

const PUSHBACK_SPEED = 320;    // px/s applied to hit opponent

export interface HitProperties {
  damage: number;
  pushbackSpeed: number;
  causesKnockdown: boolean;
  launchVelocityY?: number; // Optional vertical launch when knocked down
  groundBounce?: boolean;   // If true, hits opponent in KNOCKDOWN and resets to HITSTUN
  hitstunDuration?: number; // Optional custom hitstun duration (ms)
  isUltimate?: boolean;     // If true, triggers ultimate hit effects
  freezeDuration?: number;  // If set, freezes the opponent instead of normal hitstun
}

// ─────────────────────────────────────────────────────────────────────────────
// BaseCharacter
//
// ┌─────────────────────────────────────────────────────────┐
// │  this.rect  — physics-enabled Rectangle                 │
// │  • Visual placeholder + hurtbox in one object           │
// │  • body.setCollideWorldBounds(true) clamps to stage     │
// └─────────────────────────────────────────────────────────┘
//
// During ATTACKING.ACTIVE window:
// ┌─────────────────────────────────────────────────────────┐
// │  this.activeHitbox — separate Rectangle + physics body  │
// │  • Semi-transparent; overlap fires _onHitConnect()      │
// │  • hitRegistered flag ensures single hit per attack     │
// └─────────────────────────────────────────────────────────┘
//
// ── Magnetic Force ────────────────────────────────────────
//   Gained by landing hits (+FORCE_PER_HIT per hit).
//   Used as resource cost for substitution.
//
// ── Cellular Reconstruction (Substitution) ───────────────
//   Trigger: 'substitute' input while in HITSTUN
//   Cost   : 20 Magnetic Force
//   Effect : teleport behind opponent + spawn afterimage + 1s i-frames
//   Cooldown: 15 seconds (hard timer, not resetable)
// ─────────────────────────────────────────────────────────────────────────────
export class BaseCharacter {

  // ── Balance constants ─────────────────────────────────────────────────────
  static readonly MAX_FORCE       = 100;
  static readonly FORCE_PER_HIT   =  35; // increased from 10 to allow frequent ultimates
  static readonly SUB_FORCE_COST  =  20;
  static readonly SUB_COOLDOWN_MS = 15_000;  // 15 s hard cooldown
  static readonly SUB_IFRAMES_MS  =  1_000;  // 1 s invulnerability

  // ── Identity / config ─────────────────────────────────────────────────────
  readonly scene:        Phaser.Scene;
  readonly baseColor:    number;
  readonly playerId:     1 | 2;
  readonly name:         string;
  readonly width:        number;
  readonly height:       number;
  readonly attackDamage: number;
  readonly maxHp:        number;

  // ── Runtime stats ─────────────────────────────────────────────────────────
  hp:           number;
  facingRight:  boolean;
  spritesConfig?: CharacterConfig['sprites'];

  // Magnetic Force (0 – MAX_FORCE)
  private _magneticForce = 0;

  get magneticForce(): number { return this._magneticForce; }
  set magneticForce(val: number) {
    const oldForce = Math.floor(this._magneticForce);
    this._magneticForce = Math.max(0, Math.min(BaseCharacter.MAX_FORCE, val));
    const newForce = Math.floor(this._magneticForce);
    if (oldForce !== newForce) {
      EventBus.emit(EVENTS.PLAYER_FORCE_CHANGED, {
        player: this.playerId,
        force: this._magneticForce,
        maxForce: BaseCharacter.MAX_FORCE
      });
    }
  }

  // Substitution cooldown (counts down in ms each frame, 0 = ready)
  subCooldownRemaining = 0;

  // Thunder Buff Properties
  thunderBuffTimer = 0;
  blockCharges = 0;
  canInstantBranch = false;

  // Ultimate Trigger Properties
  protected ultimatePresses: number[] = [];
  protected skill2HoldTime: number = 0;
  
  // Hold Mechanic
  attackHoldTime = 0;

  // I-frame state (private — external code checks isInvulnerable getter)
  private _subInvulnerable = false;
  private _subIframesLeft  = 0;   // ms remaining
  private _subFlicker      = 0;   // flicker phase accumulator

  // ── 2.5D Physics ────────────────────────────────────────────────────────
  z: number = 0;   // Height above ground
  vz: number = 0;  // Z-axis velocity
  
  spriteOffsetX: number = 0;
  spriteOffsetY: number = 0;
  shadow: Phaser.GameObjects.Ellipse;
  hurtbox: Phaser.GameObjects.Rectangle;

  /** True while Cellular Reconstruction i-frames are active. */
  get isInvulnerable(): boolean { return this._subInvulnerable; }
  ignoreTimeScale: boolean = false;

  /**
   * True when the substitution can be triggered:
   *   • enough Magnetic Force
   *   • cooldown fully elapsed
   *   • not currently in i-frames (can't chain subs)
   */
  get canSubstitute(): boolean {
    return this.magneticForce      >= BaseCharacter.SUB_FORCE_COST
        && this.subCooldownRemaining <= 0
        && !this._subInvulnerable;
  }

  // ── Input snapshot (written by GameScene.pollInput each frame) ───────────
  input: CharacterInput;

  // ── FSM ───────────────────────────────────────────────────────────────────
  fsm: CharacterFSM;

  // ── Opponent link (assigned by GameScene after both chars created) ────────
  opponent: BaseCharacter | null = null;

  // ── Phaser objects ────────────────────────────────────────────────────────
  /** The character's body — also the hurtbox. */
  readonly rect: Phaser.GameObjects.Rectangle;

  /** Spawned during ATTACKING.ACTIVE, null otherwise. */
  activeHitbox:         Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite | null = null;
  activeHitboxCollider: Phaser.Physics.Arcade.Collider  | null = null;

  /** Procedural sprite linked to rect */
  sprite?: Phaser.GameObjects.Sprite;

  // ── Per-state scratch data (FSM state classes read/write these) ───────────
  stateData = {
    attackTimer:    0,
    hitstunTimer:   0,
    knockdownTimer: 0,
    hitRegistered:  false,
    currentHitProps: null as HitProperties | null,
    lastReceivedHitProps: null as HitProperties | null,
    activeHitboxReachX: HITBOX_REACH_X,
  };

  // ── Debug label ───────────────────────────────────────────────────────────
  private readonly _label: Phaser.GameObjects.Text;

  // ─────────────────────────────────────────────────────────────────────────
  // C Skill (Skill1) tracking
  skill1Cooldown = 0;
  skill1ComboStage = 1;
  skill1ComboWindow = 0;

  constructor(scene: Phaser.Scene, cfg: CharacterConfig) {
    this.scene        = scene;
    this.baseColor    = cfg.color;
    this.playerId     = cfg.playerId;
    this.name         = cfg.name;
    this.width        = cfg.width        ?? 56;
    this.height       = cfg.height       ?? 120;
    this.maxHp        = cfg.maxHp        ?? 100;
    this.hp           = this.maxHp;
    this.attackDamage = cfg.attackDamage ?? 14;
    this.facingRight  = cfg.playerId === 1;
    this.input        = emptyInput();

    // ── Visual + hurtbox ──────────────────────────────────────────────────
    this.rect = scene.add.rectangle(cfg.x, cfg.y, this.width, this.height, cfg.color);
    this.rect.setDepth(5);

    // 2.5D: We disable Arcade gravity completely.
    if (this.rect.body) {
      (this.rect.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    }
    
    // Shadow
    this.shadow = scene.add.ellipse(cfg.x, cfg.y + this.height / 2, this.width * 0.7, 20, 0x000000, 0.4);
    this.shadow.setDepth(1); // Shadows always draw under characters

    // The tall visual hurtbox that moves with Z (for combat collision)
    this.hurtbox = scene.add.rectangle(cfg.x, cfg.y - this.height / 2, this.width * 0.5, this.height, 0x0000ff, 0.0);
    scene.physics.add.existing(this.hurtbox);
    const hurtBody = this.hurtbox.body as Phaser.Physics.Arcade.Body;
    hurtBody.setAllowGravity(false);
    hurtBody.setImmovable(true);

    this.spritesConfig = cfg.sprites;

    if (this.spritesConfig) {
      this.rect.setAlpha(0); // Hide the hitbox/hurtbox
      this.sprite = scene.add.sprite(cfg.x, cfg.y, this.spritesConfig.idle);
      this.sprite.setDepth(6);
      
      // Basic scaling to fit roughly within character bounds
      const scale = Math.min(this.width / this.sprite.width, this.height / this.sprite.height) * 3;
      this.sprite.setScale(scale);
    }

    scene.physics.add.existing(this.rect);
    const body = this.getBody()!;
    body.setCollideWorldBounds(true);
    body.allowGravity = false;
    body.setMaxVelocityX(500);
    body.setSize(this.width, this.height, true);

    // ── Debug label ───────────────────────────────────────────────────────
    this._label = scene.add
      .text(cfg.x, cfg.y - this.height / 2 - 8, '', {
        fontSize:        '10px',
        color:           '#ffffff',
        fontFamily:      '"Rajdhani", monospace',
        backgroundColor: '#00000099',
        padding:         { x: 4, y: 2 },
        align:           'center',
      })
      .setOrigin(0.5, 1)
      .setDepth(50);

    // ── FSM ───────────────────────────────────────────────────────────────
    this.fsm = new CharacterFSM(this);
    this.fsm
      .addState(new IdleState())
      .addState(new WalkingState())
      .addState(new AttackingState())
      .addState(new HitstunState())
      .addState(new KnockdownState())
      .addState(new FrozenState())
      .start(CharacterStateType.IDLE);
  }

  // ── Physics helpers ───────────────────────────────────────────────────────

  getBody(): Phaser.Physics.Arcade.Body | null {
    return (this.rect.body as Phaser.Physics.Arcade.Body) ?? null;
  }

  setVelocityX(vx: number): void {
    this.getBody()?.setVelocityX(vx);
  }

  setDepth(depth: number): void {
    this.shadow.setDepth(depth - 1);
    this.rect.setDepth(depth);
    if (this.sprite) this.sprite.setDepth(depth + 1);
  }

  /** Change the rectangle fill (used by states for visual phase feedback). */
  setBodyTint(color: number): void {
    this.rect.setFillStyle(color);
  }

  /** Change the current pose texture if sprites are configured */
  setPose(pose: 'idle' | 'punch' | 'ultimate' | 'p1' | 'p2' | 'p3' | 'p4' | 'p5'): void {
    if (this.sprite && this.spritesConfig) {
      const texKey = this.spritesConfig[pose] || this.spritesConfig.idle;
      this.sprite.setTexture(texKey);
      
      // Re-adjust scale in case images are of vastly different dimensions
      const scale = Math.min(this.width / this.sprite.width, this.height / this.sprite.height) * 3;
      this.sprite.setScale(scale);
    }
  }

  // ── Hitbox management ─────────────────────────────────────────────────────

  /** Create the attack hitbox during the ACTIVE window. Safe to call once. */
  spawnHitbox(
    reachX: number = HITBOX_REACH_X,
    w: number = HITBOX_W,
    h: number = HITBOX_H,
    textureKey?: string
  ): void {
    if (this.activeHitbox || !this.opponent) return;

    this.stateData.activeHitboxReachX = reachX;
    const dir = this.facingRight ? 1 : -1;
    const hx  = this.rect.x + dir * reachX;
    const hy  = this.rect.y - this.height * 0.1;

    // Only use blast effect if explicitly requested via textureKey
    if (textureKey && this.scene.textures.exists(textureKey)) {
      this.activeHitbox = this.scene.add.sprite(hx, hy - this.z, textureKey);
      this.activeHitbox.setDepth(this.rect.depth + 15);
      this.activeHitbox.setAlpha(0);
      (this.activeHitbox as Phaser.GameObjects.Sprite).setBlendMode(Phaser.BlendModes.ADD);
      
      // Beautify: Fade in, scale up, rotate
      this.activeHitbox.setScale(0.5);
      this.scene.tweens.add({
        targets: this.activeHitbox,
        scale: 1.5,
        alpha: 1,
        angle: Phaser.Math.Between(-45, 45),
        duration: 200,
        ease: 'Cubic.easeOut',
      });
    } else {
      this.activeHitbox = this.scene.add.rectangle(hx, hy - this.z, w, h, HITBOX_COLOR, HITBOX_ALPHA);
      this.activeHitbox.setDepth(this.rect.depth + 15);
    }
    
    this.scene.physics.add.existing(this.activeHitbox);

    const hBody = this.activeHitbox.body as Phaser.Physics.Arcade.Body;
    hBody.allowGravity = false;
    hBody.setSize(w, h, true);

    this.activeHitboxCollider = this.scene.physics.add.overlap(
      this.activeHitbox,
      this.opponent.hurtbox, // Use the 3D-accurate hurtbox
      (() => {
        // 2.5D Depth check (Z-axis overlap)
        const zDiff = Math.abs(this.z - this.opponent!.z);
        // Y-axis overlap (depth on plane)
        const yDiff = Math.abs(this.rect.y - this.opponent!.rect.y);
        if (zDiff < 60 && yDiff < 40) {
          this._onHitConnect();
        }
      }) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );
  }

  /** Destroy the active hitbox + its collider. Safe to call any time. */
  destroyHitbox(): void {
    this.activeHitboxCollider?.destroy();
    this.activeHitboxCollider = null;
    this.activeHitbox?.destroy();
    this.activeHitbox = null;
  }

  /**
   * Phaser overlap callback — fires every frame the hitbox touches the opponent.
   * hitRegistered flag ensures at most one hit per attack window.
   */
  private _onHitConnect(): void {
    if (this.stateData.hitRegistered || !this.opponent) return;
    if (this.opponent.isInvulnerable) return; // Cellular Reconstruction i-frames
    
    const props = this.stateData.currentHitProps || {
      damage: this.attackDamage,
      pushbackSpeed: PUSHBACK_SPEED,
      causesKnockdown: false,
    };

    if (this.opponent.fsm.currentType === CharacterStateType.KNOCKDOWN) {
      if (!props.groundBounce) return; // Normally can't hit knocked down opponent
    }

    this.stateData.hitRegistered = true;

    // ── Deal damage ─────────────────────────────────────────────────────
    const pushDir = this.facingRight ? 1 : -1;
    this.opponent.takeHit(props, pushDir);

    // ── Gain Magnetic Force (Attacker) ──────────────────────────────────
    this.magneticForce += BaseCharacter.FORCE_PER_HIT;
    EventBus.emit(EVENTS.PLAYER_FORCE_CHANGED, {
      player:   this.playerId,
      force:    this.magneticForce,
      maxForce: BaseCharacter.MAX_FORCE,
    });

    // ── Hit effects (Hit Stop, Camera Shake, Manga Text, Shockwave, Destruction) ─────
    if (props.isUltimate) {
      this.applyHitStop(300, 0.05);
      this.scene.cameras.main.shake(500, 0.03);
      this.spawnMangaText('战他娘亲！', this.opponent.rect.x, this.opponent.rect.y, true);
      this.spawnShockwave(this.opponent.rect.x, this.opponent.rect.y, 0xff0000, 2);
      
      // Trigger massive environment destruction
      if (typeof (this.scene as any).spawnDestruction === 'function') {
        (this.scene as any).spawnDestruction(this.opponent.rect.x, this.opponent.rect.y, true);
      }
    } else {
      this.applyHitStop(80, 0.1);
      this.scene.cameras.main.shake(100, 0.005);
      const words = ['呱！', '口胡！', '口桀！', '轰！', '战！'];
      const randWord = words[Math.floor(Math.random() * words.length)];
      this.spawnMangaText(randWord, this.opponent.rect.x, this.opponent.rect.y, false);
      this.spawnShockwave(this.opponent.rect.x, this.opponent.rect.y, 0xffff00, 1);
      
      // Trigger medium destruction for heavy hits (like blast kick)
      if (props.causesKnockdown && props.pushbackSpeed >= 500) {
        if (typeof (this.scene as any).spawnDestruction === 'function') {
          (this.scene as any).spawnDestruction(this.opponent.rect.x, this.opponent.rect.y, false);
        }
      }
    }
  }

  // ── Hit Stop ──────────────────────────────────────────────────────────────
  applyHitStop(durationMs: number, timeScale: number = 0.05): void {
    this.scene.time.timeScale = timeScale;
    
    // Use unscaled timer to restore timeScale
    this.scene.time.addEvent({
      delay: durationMs * timeScale, // wait equivalent scaled time
      callback: () => {
        if (this.scene && this.scene.time) {
          this.scene.time.timeScale = 1;
        }
      },
    });
  }

  // ── Manga Text Effect ─────────────────────────────────────────────────────
  spawnMangaText(textStr: string, x: number, y: number, isHuge: boolean = false): void {
    const offsetX = Phaser.Math.Between(-40, 40);
    const offsetY = Phaser.Math.Between(-60, 20);

    const mangaText = this.scene.add.text(x + offsetX, y + offsetY, textStr, {
      fontFamily: '"Arial Black", Impact, sans-serif',
      fontSize: isHuge ? '72px' : '48px',
      fontStyle: 'italic',
      color: '#ff0000',
      stroke: '#000000',
      strokeThickness: isHuge ? 12 : 8,
      shadow: { offsetX: 4, offsetY: 4, color: '#ffff00', blur: 0, stroke: true, fill: true }
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setDepth(10000); // Very high depth to bypass Color Invert filter
    
    // Pure red color is already set in the style above
    mangaText.setScale(0.1);

    this.scene.tweens.add({
      targets: mangaText,
      scale: isHuge ? 1.8 : 1.2,
      angle: Phaser.Math.Between(-15, 15),
      duration: 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: mangaText,
          y: mangaText.y - 50,
          alpha: 0,
          duration: 300,
          delay: 200,
          ease: 'Power2',
          onComplete: () => mangaText.destroy()
        });
      }
    });
  }

  // ── Shockwave Effect ──────────────────────────────────────────────────────
  public spawnShockwave(x: number, y: number, color: number, scaleMultiplier: number = 1): void {
    const ring = this.scene.add.graphics({ x, y });
    ring.lineStyle(4, color, 1);
    ring.strokeCircle(0, 0, 40);
    ring.setDepth(20);

    this.scene.tweens.add({
      targets: ring,
      scale: 3 * scaleMultiplier,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        ring.destroy();
      }
    });
  }

  // ── Take a hit ────────────────────────────────────────────────────────────

  takeHit(props: HitProperties, pushDir: number): void {
    const wasKnockdown = this.fsm.currentType === CharacterStateType.KNOCKDOWN;
    if (wasKnockdown && !props.groundBounce) return;
    if (this._subInvulnerable) return; // Cellular Reconstruction i-frames
    
    // Check Thunder Buff block
    if (this.blockCharges > 0 && !props.isUltimate) {
      this.blockCharges--;
      this.setBodyTint(0xffffff);
      this.scene.time.delayedCall(100, () => this.setBodyTint(0x00ffff)); // Back to electric blue
      this.applyHitStop(50, 0.5);
      if (this.opponent) this.opponent.applyHitStop(50, 0.5);
      this.spawnMangaText('雷绝霸体！', this.rect.x, this.rect.y, false);
      return;
    }
    
    // Super Armor for SKILL_HEAL
    const hasSuperArmor = this.fsm.currentType === CharacterStateType.SKILL_HEAL;

    this.hp = Math.max(0, this.hp - props.damage);
    EventBus.emit(EVENTS.PLAYER_HP_CHANGED, {
      player: this.playerId,
      hp:     this.hp,
      maxHp:  this.maxHp,
    });

    // Defender gains force (slightly less than attacker)
    this.magneticForce += 15;
    EventBus.emit(EVENTS.PLAYER_FORCE_CHANGED, {
      player:   this.playerId,
      force:    this.magneticForce,
      maxForce: BaseCharacter.MAX_FORCE,
    });

    const body = this.getBody();
    if (body) {
      body.setVelocityX(pushDir * props.pushbackSpeed);
      
      // 2.5D Launch (launchVelocityY < 0 means UP, so vz > 0)
      if (props.launchVelocityY) {
        this.vz = -props.launchVelocityY;
      } else if (props.groundBounce && wasKnockdown) {
        this.vz = 350; // Increased lift for combo extensions
      }
    }

    this.stateData.lastReceivedHitProps = { ...props }; // Store props for hitstun state
    
    if (props.freezeDuration) {
      this.fsm.transition(CharacterStateType.FROZEN);
    } else if (props.causesKnockdown) {
      this.fsm.transition(CharacterStateType.KNOCKDOWN);
    } else if (!hasSuperArmor) {
      this.stateData.hitstunTimer = 0; // Force reset timer for multi-hits
      this.fsm.transition(CharacterStateType.HITSTUN);
    }
  }

  // ── Cellular Reconstruction (Substitution) ────────────────────────────────

  /**
   * Execute the substitution:
   *   1. Spawn afterimage at current position.
   *   2. Teleport behind opponent.
   *   3. Grant SUB_IFRAMES_MS of invulnerability.
   *   4. Consume SUB_FORCE_COST Magnetic Force.
   *   5. Start SUB_COOLDOWN_MS cooldown.
   *   6. Escape HITSTUN → IDLE.
   *
   * Guard: only works when canSubstitute === true.
   */
  performSubstitution(): void {
    if (!this.canSubstitute || !this.opponent) return;

    const origX = this.rect.x;
    const origY = this.rect.y;

    // 1. Afterimage at current location
    this._spawnAfterimage(origX, origY);

    // 2. Teleport behind opponent
    //    "behind" = the far side the opponent is facing away from
    const oppX   = this.opponent.rect.x;
    const onLeft = origX < oppX; // is this character currently on the left?
    const behindX = onLeft
      ? oppX + this.opponent.width / 2 + this.width / 2 + 28  // jump to right of opp
      : oppX - this.opponent.width / 2 - this.width / 2 - 28; // jump to left of opp

    const halfW   = this.width / 2;
    const safeX   = Phaser.Math.Clamp(behindX, halfW, this.scene.scale.width - halfW);

    // body.reset() syncs both the physics body and the Rectangle position
    this.getBody()?.reset(safeX, origY);
    // Also clear any residual velocity
    this.setVelocityX(0);

    // 3. I-frames
    this._subInvulnerable = true;
    this._subIframesLeft  = BaseCharacter.SUB_IFRAMES_MS;
    this._subFlicker      = 0;

    // 4. Consume force
    this.magneticForce -= BaseCharacter.SUB_FORCE_COST;

    // 5. Start cooldown
    this.subCooldownRemaining = BaseCharacter.SUB_COOLDOWN_MS;

    // 6. Scale-punch "materialise" animation
    this.scene.tweens.add({
      targets:  this.rect,
      scaleX:   { from: 1.7, to: 1.0 },
      scaleY:   { from: 0.35, to: 1.0 },
      duration: 240,
      ease:     'Back.Out',
    });

    // 7. Emit HUD events immediately
    EventBus.emit(EVENTS.PLAYER_FORCE_CHANGED, {
      player:   this.playerId,
      force:    this.magneticForce,
      maxForce: BaseCharacter.MAX_FORCE,
    });
    this._emitSubEvent();

    // 8. Escape HITSTUN → IDLE
    this.fsm.transition(CharacterStateType.IDLE);
  }

  /**
   * Spawn a semi-transparent copy of this character at (x, y) that fades
   * upward and dissolves — the classic fighting-game "ghost" afterimage.
   */
  private _spawnAfterimage(x: number, y: number): void {
    let ghost: Phaser.GameObjects.Shape | Phaser.GameObjects.Sprite;
    
    if (this.sprite) {
      ghost = this.scene.add.sprite(x, y, this.sprite.texture.key);
      (ghost as Phaser.GameObjects.Sprite).setFlipX(this.sprite.flipX);
      ghost.setScale(this.sprite.scaleX, this.sprite.scaleY);
      ghost.setAlpha(0.70);
    } else {
      ghost = this.scene.add.rectangle(x, y, this.width, this.height, this.baseColor, 0.70);
      (ghost as Phaser.GameObjects.Rectangle).setStrokeStyle(2, 0xffffff, 1.0);
    }
    
    ghost.setDepth(4); // behind the real character (depth 5)

    // Flash bright white for one frame, then fade + drift upward
    this.scene.tweens.add({
      targets:  ghost,
      alpha:    0,
      scaleX:   this.sprite ? this.sprite.scaleX * 1.35 : 1.35,
      scaleY:   this.sprite ? this.sprite.scaleY * 1.15 : 1.15,
      y:        y - 28,
      duration: 700,
      ease:     'Cubic.Out',
      onComplete: () => ghost.destroy(),
    });
  }

  // ── 2.5D Physics ──────────────────────────────────────────────────────────

  private updateZPhysics(delta: number): void {
    const dt = delta / 1000;
    
    // Flight mechanic (hold jump)
    if (this.input.jump && 
        this.fsm.currentType !== CharacterStateType.HITSTUN && 
        this.fsm.currentType !== CharacterStateType.KNOCKDOWN && 
        this.fsm.currentType !== CharacterStateType.FROZEN) {
       
       const maxZ = 200; // Hover height limit
       if (this.z < maxZ) {
          this.vz = 800; // Fly up
       } else {
          this.vz = 0; // Hover
          this.z = maxZ;
       }
    } else {
       // Apply gravity if in air
       if (this.z > 0 || this.vz > 0) {
         this.vz -= 1500 * dt; // Gravity
       }
    }
    
    this.z += this.vz * dt;

    // Ground collision
    if (this.z <= 0) {
      this.z = 0;
      if (this.vz < 0) this.vz = 0;
    }
  }

  // ── Sub / force event helpers ─────────────────────────────────────────────

  private _emitSubEvent(): void {
    const secondsLeft = Math.ceil(this.subCooldownRemaining / 1000);
    const status: 'ready' | 'active' | 'cooling' =
      this._subInvulnerable         ? 'active'  :
      this.subCooldownRemaining > 0 ? 'cooling' : 'ready';

    const progress =
      status === 'ready' || status === 'active'
        ? 1
        : 1 - this.subCooldownRemaining / BaseCharacter.SUB_COOLDOWN_MS;

    EventBus.emit(EVENTS.PLAYER_SUB_CHANGED, {
      player: this.playerId,
      secondsLeft,
      status,
      progress,
    });
  }

  // ── Timers ────────────────────────────────────────────────────────────────

  private _tickTimers(delta: number): void {
    // 1. Skill1 Timers
    if (this.skill1Cooldown > 0) {
      this.skill1Cooldown -= delta;
    }
    if (this.skill1ComboWindow > 0) {
      this.skill1ComboWindow -= delta;
      if (this.skill1ComboWindow <= 0) {
        // Window missed! Reset combo and trigger cooldown
        this.skill1ComboStage = 1;
        this.skill1Cooldown = 8000;
      }
    }

    // 2. Sub Skill (Cellular Reconstruction i-frames)
    if (this.subCooldownRemaining > 0) {
      const prevSec = Math.ceil(this.subCooldownRemaining / 1000);
      this.subCooldownRemaining = Math.max(0, this.subCooldownRemaining - delta);
      const currSec = Math.ceil(this.subCooldownRemaining / 1000);
      if (prevSec !== currSec) this._emitSubEvent();
    }

    // I-frames — rapid flicker + expiry check
    if (this._subInvulnerable) {
      this._subFlicker    += delta;
      this._subIframesLeft -= delta;

      // Alternate alpha 1.0 ↔ 0.2 every 70 ms for the "invincible blink"
      this.rect.setAlpha(Math.floor(this._subFlicker / 70) % 2 === 0 ? 1.0 : 0.2);

      if (this._subIframesLeft <= 0) {
        this._subInvulnerable = false;
        this._subIframesLeft  = 0;
        this.rect.setAlpha(1);
        this._emitSubEvent(); // ring transitions from active → cooling
      }
    }
  }

  // ── Per-frame update (called by GameScene.update) ─────────────────────────

  /**
   * Processes attack/skill inputs from IDLE or WALKING states.
   * Returns true if a transition occurred.
   */
  handleActionInput(): boolean {
    // If we're frozen, we can't do anything!
    if (this.fsm.currentType === CharacterStateType.FROZEN) return false;

    // Keep track of recent ultimate presses
    this.ultimatePresses = this.ultimatePresses.filter(t => this.scene.time.now - t <= 1500);
    
    if (this.ultimatePresses.length >= 5 && this.magneticForce >= BaseCharacter.MAX_FORCE && this.fsm.hasState(CharacterStateType.ULTIMATE_ATTACK)) {
      this.ultimatePresses = [];
      this.magneticForce = 0;
      this.fsm.transition(CharacterStateType.ULTIMATE_ATTACK);
      return true;
    }

    // Buff Activation (Dir + Q + E)
    if ((this.input.moveUp || this.input.moveDown || this.input.moveLeft || this.input.moveRight) &&
        this.input.keyQ && this.input.keyE) {
      if (this.thunderBuffTimer <= 0 && this.fsm.hasState(CharacterStateType.BUFF_THUNDER_ACTIVATE)) {
        this.fsm.transition(CharacterStateType.BUFF_THUNDER_ACTIVATE);
        return true;
      }
    }
    
    // Buff specific actions
    if (this.thunderBuffTimer > 0) {
      if (this.input.substitute && this.fsm.hasState(CharacterStateType.BACKDASH_PROJECTILE)) {
        this.fsm.transition(CharacterStateType.BACKDASH_PROJECTILE);
        return true;
      }
      if (this.input.keyShift && (this.input.moveLeft || this.input.moveRight || this.input.moveUp || this.input.moveDown) && this.fsm.hasState(CharacterStateType.BLINK)) {
        this.fsm.transition(CharacterStateType.BLINK);
        return true;
      }
    }

    if (this.input.skill1 && this.fsm.hasState(CharacterStateType.SKILL_BLAST_KICK)) {
      if (this.skill1Cooldown <= 0 || this.skill1ComboWindow > 0) {
        this.fsm.transition(CharacterStateType.SKILL_BLAST_KICK);
        return true;
      }
    }
    if (this.input.heal && this.magneticForce > 0 && this.fsm.hasState(CharacterStateType.SKILL_HEAL)) {
      this.fsm.transition(CharacterStateType.SKILL_HEAL);
      return true;
    }
    

    
    // If already in Rib Burst Form, JustDown of skill2 triggers phase 2
    if (this.input.skill2) {
       const st = this as any;
       if (st.seaTigerData && st.seaTigerData.isRibBurstForm && this.hp <= this.maxHp * 0.2) {
          if (this.fsm.hasState(CharacterStateType.ULTIMATE_HIDDEN)) {
             this.fsm.transition(CharacterStateType.ULTIMATE_HIDDEN);
             return true;
          }
       }
    }

    if (this.input.attack) {
      if (this.fsm.hasState(CharacterStateType.COMBO)) {
        this.fsm.transition(CharacterStateType.COMBO);
      } else {
        this.fsm.transition(CharacterStateType.ATTACKING);
      }
      return true;
    }
    return false;
  }

  update(rawDelta: number): void {
    const delta = this.ignoreTimeScale ? rawDelta : rawDelta * this.scene.time.timeScale;
    
    if (this.input.skill2Hold) {
       this.skill2HoldTime += delta;
    } else {
       this.skill2HoldTime = 0;
    }
    
    if (this.input.ultimate) {
      this.ultimatePresses.push(this.scene.time.now);
    }

    // Passive Force Generation (3 per second)
    if (this.fsm.currentType !== CharacterStateType.ULTIMATE_ATTACK) {
      this.magneticForce += (delta / 1000) * 3;
    }

    // Thunder Buff tick
    if (this.thunderBuffTimer > 0) {
      this.thunderBuffTimer -= delta;
      if (this.thunderBuffTimer <= 0) {
        this.thunderBuffTimer = 0;
        this.blockCharges = 0;
        this.setBodyTint(this.baseColor);
        EventBus.emit(EVENTS.UI_BUFF_EFFECT, { player: this.playerId, active: false, type: 'thunder' });
      } else {
        // Keep tinting electric blue if active
        if (this.thunderBuffTimer % 100 < 10) this.setBodyTint(0xffffff);
        else this.setBodyTint(0x00ffff);
        
        // Thunder Aura: check every ~200ms
        if (this.thunderBuffTimer % 200 < delta) {
          // Spawn random small lightning particle
          const px = this.rect.x + Phaser.Math.Between(-60, 60);
          const py = this.rect.y - Phaser.Math.Between(0, this.height);
          const spark = this.scene.add.rectangle(px, py, 4, 20, 0x00ffff, 0.8);
          spark.setDepth(this.rect.depth + 1);
          this.scene.tweens.add({
            targets: spark,
            alpha: 0,
            scaleY: 0,
            duration: 150,
            onComplete: () => spark.destroy()
          });

          // Damage opponent if close enough
          if (this.opponent && Phaser.Math.Distance.Between(this.rect.x, this.rect.y, this.opponent.rect.x, this.opponent.rect.y) < 140) {
            // Apply slight damage and hitstun, but no pushback so they stay in the aura
            const dir = this.opponent.rect.x > this.rect.x ? 1 : -1;
            this.opponent.takeHit({
              damage: 2,
              pushbackSpeed: 0,
              causesKnockdown: false,
              hitstunDuration: 150
            }, dir);
          }
        }
      }
    }

    // 2.5D Physics tick
    this.updateZPhysics(delta);

    // Wall bounce logic
    const body = this.rect.body as Phaser.Physics.Arcade.Body;
    if (body && (body.blocked.left || body.blocked.right) && Math.abs(body.velocity.x) > 500) {
      if (this.fsm.currentType === CharacterStateType.HITSTUN || this.fsm.currentType === CharacterStateType.KNOCKDOWN) {
        // Reverse X velocity and apply friction
        body.setVelocityX(body.velocity.x * -0.5);
        this.spawnShockwave(this.rect.x, this.rect.y, 0xffffff, 1.5);
        this.scene.cameras.main.shake(150, 0.01);
      }
    }

    // Sync visuals with physics (Y is visual, rect.y is ground projection)
    this.shadow.setPosition(this.rect.x, this.rect.y + this.height / 2);
    
    // Sync the tall hurtbox to the character's visual position
    if (this.hurtbox) {
      const hbody = this.hurtbox.body as Phaser.Physics.Arcade.Body;
      const cy = this.rect.y - this.z - this.height * 0.1; // Offset center slightly up
      if (hbody) hbody.reset(this.rect.x, cy);
      else this.hurtbox.setPosition(this.rect.x, cy);
    }
    
    // Timers run first — takeHit() checks isInvulnerable immediately
    this._tickTimers(delta);

    // Auto-face opponent (freeze direction during attack so hitbox stays valid)
    if (this.opponent && this.fsm.currentType !== CharacterStateType.ATTACKING) {
      this.facingRight = this.opponent.rect.x > this.rect.x;
    }

    // Sync sprite to rect
    if (this.sprite) {
      this.sprite.setPosition(
        this.rect.x + this.spriteOffsetX, 
        this.rect.y - this.z + this.spriteOffsetY
      );
      this.sprite.setFlipX(!this.facingRight);
    }

    // Tick FSM
    this.fsm.update(delta);

    // Auto-trigger Rib Burst Form when HP drops to 20%
    if (this.hp > 0 && this.hp <= this.maxHp * 0.2) {
       const st = this as any;
       if (st.seaTigerData && !st.seaTigerData.isRibBurstForm) {
          if (this.fsm.hasState(CharacterStateType.ULTIMATE_HIDDEN) && this.fsm.currentType !== CharacterStateType.ULTIMATE_HIDDEN) {
             this.fsm.transition(CharacterStateType.ULTIMATE_HIDDEN);
          }
       }
    }

    // Keep active hitbox snapped in front of the character
    if (this.activeHitbox) {
      const dir = this.facingRight ? 1 : -1;
      const hx  = this.rect.x + dir * this.stateData.activeHitboxReachX;
      const hy  = this.rect.y - this.height * 0.1;
      const hBody = this.activeHitbox.body as Phaser.Physics.Arcade.Body;
      if (hBody) hBody.reset(hx, hy - this.z);
      else this.activeHitbox.setPosition(hx, hy - this.z);
    }

    // Debug label — shows all important live values
    this._label.setPosition(this.rect.x, this.rect.y - this.height / 2 - 8);
    this._label.setText([
      `${this.name} [${this.fsm.currentType}]`,
      `HP ${Math.round(this.hp)}  Force ${Math.round(this.magneticForce)}`,
      this.subCooldownRemaining > 0
        ? `Sub CD: ${Math.ceil(this.subCooldownRemaining / 1000)}s`
        : this._subInvulnerable ? 'I-FRAMES' : 'Sub READY',
    ].join('\n'));
  }

  // ── General events ────────────────────────────────────────────────────────

  emitStateEvent(): void {
    EventBus.emit(EVENTS.PLAYER_STATE_CHANGED, {
      player: this.playerId,
      state:  this.fsm.currentType,
    });
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  destroy(): void {
    this.destroyHitbox();
    this.rect.destroy();
    this.shadow.destroy();
    if (this.sprite) this.sprite.destroy();
    this._label.destroy();
  }
}
