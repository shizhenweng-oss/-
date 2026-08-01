import Phaser from 'phaser';
import { BaseCharacter } from './BaseCharacter';
import { SeaTiger } from './SeaTiger';

// ─────────────────────────────────────────────────────────────────────────────
// GameScene — the main fight scene.
//
// Coordinate system:
//   • Physics world bounds = full canvas width, padded by half-character-width
//     so fighters never slide off screen.
//   • Floor Y = 78 % of canvas height.  Characters are positioned so their
//     bottom edge sits exactly on the floor line.
//   • No gravity — this is a 2-D plane fighter, not a platformer.
//
// Controls:
//   P1  Left/Right arrow keys,  Z = attack,  F = substitute
//   P2  A / D keys,             X = attack,  H = substitute
// ─────────────────────────────────────────────────────────────────────────────

const CHAR_W      = 56;
const CHAR_H      = 120;
const FLOOR_RATIO = 0.78; // floor at 78% of canvas height

export class GameScene extends Phaser.Scene {
  // Characters
  private p1!: BaseCharacter;
  private p2!: BaseCharacter;

  // Keyboard bindings
  private p1Keys!: {
    up:     Phaser.Input.Keyboard.Key;
    down:   Phaser.Input.Keyboard.Key;
    left:   Phaser.Input.Keyboard.Key;
    right:  Phaser.Input.Keyboard.Key;
    attack: Phaser.Input.Keyboard.Key; // Z
    sub:    Phaser.Input.Keyboard.Key; // F 
    skill1: Phaser.Input.Keyboard.Key; // C
    skill2: Phaser.Input.Keyboard.Key; // X
    ultimate: Phaser.Input.Keyboard.Key; // E
    keyQ: Phaser.Input.Keyboard.Key;
    keyE: Phaser.Input.Keyboard.Key;
    keyR: Phaser.Input.Keyboard.Key;
    keyShift: Phaser.Input.Keyboard.Key;
  };
  private p2Keys!: {
    up:     Phaser.Input.Keyboard.Key;
    down:   Phaser.Input.Keyboard.Key;
    left:   Phaser.Input.Keyboard.Key;
    right:  Phaser.Input.Keyboard.Key;
    attack: Phaser.Input.Keyboard.Key; // O
    sub:    Phaser.Input.Keyboard.Key; // P
    skill1: Phaser.Input.Keyboard.Key; // K
    skill2: Phaser.Input.Keyboard.Key; // I
    ultimate: Phaser.Input.Keyboard.Key; // L
    keyQ: Phaser.Input.Keyboard.Key;
    keyE: Phaser.Input.Keyboard.Key;
    keyR: Phaser.Input.Keyboard.Key;
    keyShift: Phaser.Input.Keyboard.Key;
  };

  // Background (redrawn on resize)
  private bgLayer!: Phaser.GameObjects.Graphics;
  private floorLayer!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'GameScene' });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  preload(): void {
    this.load.image('seatiger_avatar', '/assets/seatiger_avatar.png');
    this.load.image('seatiger_idle', '/assets/seatiger_idle.png');
    this.load.image('seatiger_ultimate', '/assets/seatiger_ultimate.png');
    this.load.image('p1', '/assets/p1.png');
    this.load.image('p2', '/assets/p2.png');
    this.load.image('p3', '/assets/p3.png');
    this.load.image('p4', '/assets/p4.png');
    this.load.image('p5', '/assets/p5.png');
    this.load.image('blast_effect', '/assets/blast_effect.jpg');
    this.load.image('ultimate_blast', '/assets/ultimate_blast.jpg');
    this.load.image('ruined_city_bg', '/assets/ruined_city_bg.jpg');
    this.load.image('ground_crater', '/assets/ground_crater.jpg');
    this.load.image('cell_reconstruction', '/assets/cell_reconstruction.png');
    this.load.image('seatiger_ultimate', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAAAAXNSR0IArs4c6QAAAGRJREFUeF7t0AENAAAMAqBv5t/u0h0o2EM1SVq38gAEMoGg2L29AQoB+gQygb772XmAAoE+gUyg7352HqBAoE8gE+i7n50HKBDoE8gE+u5n5wEKBPoEMoG++9l5gAKBPoFM4G93P1488AE5k4HPAAAAAElFTkSuQmCC');
  }

  create(): void {
    // Generate particle textures
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 8);
    g.generateTexture('spark', 16, 16);
    g.clear();
    
    // Generate an arrow-like texture for the lightning arrow
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(0, 10);
    g.lineTo(40, 0);
    g.lineTo(40, 20);
    g.closePath();
    g.fillPath();
    g.generateTexture('arrow_spark', 40, 20);
    g.clear();
    g.destroy();

    const { width, height } = this.scale;
    const floorY  = Math.round(height * FLOOR_RATIO);
    const charY   = floorY - CHAR_H / 2; // centre of rect, feet on floor

    // ── Set physics world bounds ──────────────────────────────────────────
    // Horizontal padding = half character width so no partial off-screen.
    // Vertical is huge so there is no top/bottom clamp.
    const halfW = CHAR_W / 2;
    this.physics.world.setBounds(halfW, -9_999, width - halfW * 2, 99_999);

    // ── Background + floor ────────────────────────────────────────────────
    this.bgLayer    = this.add.graphics().setDepth(0);
    this.floorLayer = this.add.graphics().setDepth(1);
    this.drawBackground(width, height, floorY);

    // ── P1 — left side, red ───────────────────────────────────────────────
    this.p1 = new SeaTiger(this, {
      x:            Math.round(width  * 0.28),
      y:            charY,
      width:        CHAR_W,
      height:       CHAR_H,
      color:        0xcc2200,
      playerId:     1,
      name:         'SEATIGER',
      maxHp:        300,
      attackDamage: 14,
      avatarKey: 'seatiger_avatar',
      sprites: {
        idle: 'seatiger_idle',
        punch: 'seatiger_idle',
        ultimate: 'seatiger_ultimate',
        p1: 'p1',
        p2: 'p2',
        p3: 'p3',
        p4: 'p4',
        p5: 'p5'
      }
    });

    // ── P2 — right side, cyan ─────────────────────────────────────────────
    this.p2 = new BaseCharacter(this, {
      x:            Math.round(width  * 0.72),
      y:            charY,
      width:        CHAR_W,
      height:       CHAR_H,
      color:        0x0099bb,
      playerId:     2,
      name:         'REIKA',
      maxHp:        300,
      attackDamage: 12,
    });

    // ── Link opponents ────────────────────────────────────────────────────
    this.p1.opponent = this.p2;
    this.p2.opponent = this.p1;

    // ── Keyboard bindings ─────────────────────────────────────────────────
    if (this.input.keyboard) {
      const KC = Phaser.Input.Keyboard.KeyCodes;

      this.p1Keys = {
        up:     this.input.keyboard.addKey(KC.W),
        down:   this.input.keyboard.addKey(KC.S),
        left:   this.input.keyboard.addKey(KC.A),
        right:  this.input.keyboard.addKey(KC.D),
        attack: this.input.keyboard.addKey(KC.Z),
        sub:    this.input.keyboard.addKey(KC.F),
        skill1: this.input.keyboard.addKey(KC.C),
        skill2: this.input.keyboard.addKey(KC.X),
        ultimate: this.input.keyboard.addKey(KC.E),
        keyQ: this.input.keyboard.addKey(KC.Q),
        keyE: this.input.keyboard.addKey(KC.E), // Overlaps with ultimate on purpose
        keyR: this.input.keyboard.addKey(KC.R),
        keyShift: this.input.keyboard.addKey(KC.SHIFT),
      };

      this.p2Keys = {
        up:     this.input.keyboard.addKey(KC.UP),
        down:   this.input.keyboard.addKey(KC.DOWN),
        left:   this.input.keyboard.addKey(KC.LEFT),
        right:  this.input.keyboard.addKey(KC.RIGHT),
        attack: this.input.keyboard.addKey(KC.O),
        sub:    this.input.keyboard.addKey(KC.P),
        skill1: this.input.keyboard.addKey(KC.K),
        skill2: this.input.keyboard.addKey(KC.I),
        ultimate: this.input.keyboard.addKey(KC.L),
        keyQ: this.input.keyboard.addKey(KC.U),
        keyE: this.input.keyboard.addKey(KC.I), // Overlaps with skill2 (I), let's use O? Oh O is attack. Let's use J.
        keyR: this.input.keyboard.addKey(KC.Y),
        keyShift: this.input.keyboard.addKey(KC.CTRL), // Use CTRL for p2 shift equivalent
      };
      
      // Fix P2 keyE overlap with skill2(I). Let's use J for keyE.
      this.p2Keys.keyE = this.input.keyboard.addKey(KC.J);
    }

    // ── Controls legend ───────────────────────────────────────────────────
    this.add
      .text(
        width / 2,
        height - 10,
        '  P1: W A S D · Z atk · C skill · E ult        P2: Arrows · O atk · K skill · L ult  ',
        {
          fontSize:        '11px',
          color:           '#777777',
          fontFamily:      'monospace',
          backgroundColor: '#00000088',
          padding:         { x: 8, y: 3 },
        },
      )
      .setOrigin(0.5, 1)
      .setDepth(100);

    // ── Handle canvas resize ──────────────────────────────────────────────
    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      const newFloorY = Math.round(size.height * FLOOR_RATIO);
      this.bgLayer.clear();
      this.floorLayer.clear();
      this.drawBackground(size.width, size.height, newFloorY);

      // Update physics world bounds
      const hw = CHAR_W / 2;
      this.physics.world.setBounds(hw, -9_999, size.width - hw * 2, 99_999);
    });
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    this.pollInput();
    this.p1.update(delta);
    this.p2.update(delta);

    // 2.5D Depth Sorting: Lower Y values are further back.
    if (this.p1.rect.y < this.p2.rect.y) {
      this.p1.setDepth(10);
      this.p2.setDepth(11);
    } else {
      this.p2.setDepth(10);
      this.p1.setDepth(11);
    }
  }

  // ── Input polling ─────────────────────────────────────────────────────────

  private pollInput(): void {
    if (!this.input.keyboard) return;

    const parseKeys = (keys: any) => {
      return {
        moveUp:     keys.up.isDown,
        moveDown:   keys.down.isDown,
        moveLeft:   keys.left.isDown,
        moveRight:  keys.right.isDown,
        attack:     Phaser.Input.Keyboard.JustDown(keys.attack),
        attackHold: keys.attack.isDown,
        substitute: Phaser.Input.Keyboard.JustDown(keys.sub),
        skill1:     Phaser.Input.Keyboard.JustDown(keys.skill1),
        skill2:     Phaser.Input.Keyboard.JustDown(keys.skill2),
        skill2Hold: keys.skill2.isDown,
        ultimate:   Phaser.Input.Keyboard.JustDown(keys.ultimate),
        keyQ:       keys.keyQ.isDown,
        keyE:       keys.keyE.isDown,
        keyR:       keys.keyR.isDown,
        keyShift:   keys.keyShift.isDown,
      };
    };

    this.p1.input = parseKeys(this.p1Keys);
    this.p2.input = parseKeys(this.p2Keys);
  }

  // ── Drawing helpers ───────────────────────────────────────────────────────

  private drawBackground(w: number, h: number, floorY: number): void {
    // Ruined City Background
    if (this.textures.exists('ruined_city_bg')) {
      const bg = this.add.image(w / 2, h / 2, 'ruined_city_bg');
      // Scale to cover screen
      const scaleX = w / bg.width;
      const scaleY = h / bg.height;
      bg.setScale(Math.max(scaleX, scaleY));
      bg.setDepth(0);
    } else {
      // Fallback Sky gradient
      this.bgLayer.fillGradientStyle(0x020210, 0x020210, 0x08042a, 0x08042a, 1);
      this.bgLayer.fillRect(0, 0, w, h);
    }

    // Floor surface
    this.floorLayer.fillStyle(0x070716, 1);
    this.floorLayer.fillRect(0, floorY, w, h - floorY);

    // Grid perspective lines on floor
    this.floorLayer.lineStyle(1, 0x1a2050, 0.6);
    for (let x = 0; x < w; x += 80) {
      this.floorLayer.lineBetween(x, floorY, x, h);
    }
    for (let y = floorY; y < h; y += 40) {
      this.floorLayer.lineBetween(0, y, w, y);
    }

    // Glowing floor edge
    this.floorLayer.lineStyle(3, 0x3366ff, 0.85);
    this.floorLayer.lineBetween(0, floorY, w, floorY);
    this.floorLayer.lineStyle(1, 0x6699ff, 0.25);
    this.floorLayer.lineBetween(0, floorY + 4, w, floorY + 4);
  }

  // ── Environment Destruction ────────────────────────────────────────────────
  
  public spawnDestruction(x: number, _y: number, isHuge: boolean = false): void {
    const floorY = Math.round(this.scale.height * FLOOR_RATIO);
    
    // Spawn ground crater
    if (this.textures.exists('ground_crater')) {
      const crater = this.add.image(x, floorY, 'ground_crater');
      crater.setDepth(2);
      crater.setScale(isHuge ? 0.8 : 0.4);
      crater.setBlendMode(Phaser.BlendModes.MULTIPLY); // white background becomes transparent
      crater.setAlpha(0.8);
      
      // Fade out over 10 seconds
      this.tweens.add({
        targets: crater,
        alpha: 0,
        delay: 5000,
        duration: 5000,
        onComplete: () => crater.destroy()
      });
    }

    // Spawn rubble particles
    const numRocks = isHuge ? 40 : 15;
    for (let i = 0; i < numRocks; i++) {
      const rock = this.add.rectangle(
        x + Phaser.Math.Between(-30, 30), 
        floorY, 
        Phaser.Math.Between(4, 12), 
        Phaser.Math.Between(4, 12), 
        0x333333
      );
      rock.setDepth(3);
      this.physics.add.existing(rock);
      const body = rock.body as Phaser.Physics.Arcade.Body;
      body.allowGravity = true;
      body.setGravityY(800);
      body.setVelocity(
        Phaser.Math.Between(-400, 400),
        Phaser.Math.Between(-600, -200)
      );
      body.setBounce(0.4, 0.4);
      body.setCollideWorldBounds(true);

      // Random rotation
      this.tweens.add({
        targets: rock,
        angle: Phaser.Math.Between(360, 1080) * (Math.random() > 0.5 ? 1 : -1),
        duration: 2000,
      });

      // Fade out
      this.tweens.add({
        targets: rock,
        alpha: 0,
        delay: 1500,
        duration: 1000,
        onComplete: () => rock.destroy()
      });
    }
  }
}
