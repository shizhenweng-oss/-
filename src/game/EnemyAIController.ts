import { BaseCharacter } from './BaseCharacter';
import type { CharacterInput } from './CharacterInput';
import { emptyInput } from './CharacterInput';
import { CharacterStateType } from './fsm/CharacterStateType';

export class EnemyAIController {
  private self: BaseCharacter;
  private target: BaseCharacter;
  
  private nextReactionTime: number = 0;
  private currentInput: CharacterInput = emptyInput();
  
  private tacticalState: 'idle' | 'approach' | 'retreat' | 'combo' = 'approach';
  private stateTimer: number = 3000;

  private jumpCooldown: number = 0;
  private skill2Cooldown: number = 0;

  constructor(self: BaseCharacter, target: BaseCharacter) {
    this.self = self;
    this.target = target;
  }

  update(time: number, delta: number): CharacterInput {
    // console.log(`AI Update: self.hp=${this.self.hp}, time=${time}, dist=${Math.abs(this.target.rect.x - this.self.rect.x)}`);
    if (this.self.hp <= 0 || this.self.fsm.currentType === CharacterStateType.KNOCKDOWN) {
      return emptyInput();
    }

    if (this.jumpCooldown > 0) this.jumpCooldown -= delta;
    if (this.skill2Cooldown > 0) this.skill2Cooldown -= delta;

    // Simulate reaction delay (acting every 100-200ms)
    if (time < this.nextReactionTime) {
      // Clear "JustDown" flags so they don't get held down forever
      return {
        ...this.currentInput,
        attack: false,
        substitute: false,
        skill1: false,
        skill2: false,
        heal: false,
        ultimate: false,
        jump: false,
      };
    }

    // React!
    this.nextReactionTime = time + 100 + Math.random() * 100; // 100-200ms reaction time
    this.stateTimer += 150; // approximate tick
    
    // console.log(`AI Reacting! tacticalState=${this.tacticalState}`);

    // Reset inputs for this tick
    this.currentInput = emptyInput();

    const dist = Math.abs(this.target.rect.x - this.self.rect.x);
    const yDist = Math.abs(this.target.rect.y - this.self.rect.y);
    const selfHpPercent = this.self.hp / this.self.maxHp;

    const isTargetAttacking = this.target.fsm.currentType === CharacterStateType.ATTACKING || this.target.fsm.currentType === CharacterStateType.COMBO;
    const isTargetStunned = this.target.fsm.currentType === CharacterStateType.HITSTUN || this.target.fsm.currentType === CharacterStateType.KNOCKDOWN;
    const isTargetDefending = false; // No block state exists

    // 1. Defend / Evade logic
    if (isTargetAttacking && dist < 120 && Math.abs(this.target.rect.y - this.self.rect.y) < 50) {
      // Very close and target is attacking -> try to retreat, jump, or sub
      if (this.self.fsm.currentType === CharacterStateType.HITSTUN) {
        // If getting hit, mash Substitute
        this.currentInput.substitute = true;
      } else {
        // Evade
        if (Math.random() < 0.5 && this.jumpCooldown <= 0) {
          this.currentInput.jump = true;
          this.jumpCooldown = 1500;
        } else {
          // Walk away
          if (this.self.rect.x < this.target.rect.x) this.currentInput.moveLeft = true;
          else this.currentInput.moveRight = true;
        }
      }
      return this.finalizeInput();
    }

    // 2. Tactical decision making
    if (this.stateTimer > 1000 + Math.random() * 2000) {
      // Re-evaluate strategy every 1-3 seconds
      this.stateTimer = 0;
      if (selfHpPercent < 0.3) {
        this.tacticalState = 'retreat';
      } else if (isTargetStunned) {
        this.tacticalState = 'approach';
      } else if (dist > 300) {
        this.tacticalState = 'approach';
      } else {
        this.tacticalState = Math.random() > 0.4 ? 'approach' : 'retreat';
      }
    }

    // 3. Ultimate logic
    if (selfHpPercent < 0.25 && dist < 150 && !isTargetAttacking && Math.random() < 0.3) {
      this.currentInput.ultimate = true;
      return this.finalizeInput();
    }

    // 4. Execution of Tactical State
    if (this.tacticalState === 'retreat') {
      if (dist < 250) {
        if (this.self.rect.x < this.target.rect.x) this.currentInput.moveLeft = true;
        else this.currentInput.moveRight = true;
      }
      // If we retreat, sometimes heal if safe
      if (dist > 300 && selfHpPercent < 0.5 && Math.random() < 0.2) {
        this.currentInput.heal = true;
        this.currentInput.healHold = true;
      }
    } else if (this.tacticalState === 'approach' || this.tacticalState === 'combo') {
      // Try to align Y axis
      if (yDist > 10) {
        if (this.self.rect.y < this.target.rect.y) this.currentInput.moveDown = true;
        else this.currentInput.moveUp = true;
      }

      // Try to align X axis
      if (dist > 70) {
        if (this.self.rect.x < this.target.rect.x) this.currentInput.moveRight = true;
        else this.currentInput.moveLeft = true;
      } else {
        // In range, ATTACK!
        if (!isTargetDefending || Math.random() < 0.3) {
          // Use skill2 sometimes
          if (this.skill2Cooldown <= 0 && Math.random() < 0.4) {
            this.currentInput.skill2 = true;
            this.skill2Cooldown = 4000;
          } else {
            this.currentInput.attack = true;
            this.currentInput.attackHold = true;
          }
          this.tacticalState = 'combo'; // enter combo mode
          this.stateTimer = 0;
        }
      }
    }

    return this.finalizeInput();
  }

  private finalizeInput(): CharacterInput {
    // If we press JustDown keys, make sure they register in the exact returned object
    return { ...this.currentInput };
  }
}
