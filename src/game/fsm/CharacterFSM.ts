import type { BaseCharacter } from '../BaseCharacter';
import { CharacterStateType } from './CharacterStateType';

// ─────────────────────────────────────────────────────────────────────────────
// IState — contract every FSM state must fulfil.
//
// Note: uses `import type` for BaseCharacter to avoid a runtime circular
// dependency (BaseCharacter imports CharacterFSM which imports BaseCharacter).
// TypeScript erases type-only imports at compile time.
// ─────────────────────────────────────────────────────────────────────────────
export interface IState {
  /** Which state this object represents */
  readonly type: CharacterStateType;
  /** Called once when transitioning INTO this state */
  enter(ctx: BaseCharacter): void;
  /** Called every game tick while this state is active (delta in ms) */
  update(ctx: BaseCharacter, delta: number): void;
  /** Called once when transitioning OUT OF this state */
  exit(ctx: BaseCharacter): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CharacterFSM — deterministic finite state machine for a single fighter.
//
// States are registered once and reused across frames. All transient data
// (timers, flags) lives on the BaseCharacter context object, not in state
// instances, so states can safely be singletons.
// ─────────────────────────────────────────────────────────────────────────────
export class CharacterFSM {
  private readonly stateMap = new Map<CharacterStateType, IState>();
  private _current!: IState;
  private readonly _ctx: BaseCharacter;

  constructor(ctx: BaseCharacter) {
    this._ctx = ctx;
  }

  /** Register a state. Returns `this` for fluent chaining. */
  addState(state: IState): this {
    this.stateMap.set(state.type, state);
    return this;
  }

  /** Check if a state is registered. */
  hasState(type: CharacterStateType): boolean {
    return this.stateMap.has(type);
  }

  /** Kick off the machine in the given initial state. Call exactly once. */
  start(initial: CharacterStateType): void {
    const s = this.stateMap.get(initial);
    if (!s) throw new Error(`[CharacterFSM] State "${initial}" not registered.`);
    this._current = s;
    s.enter(this._ctx);
  }

  /**
   * Request a transition to `next`.
   * No-ops if we are already in `next` or `next` is not registered.
   */
  transition(next: CharacterStateType): void {
    if (this._current?.type === next) return;
    const nextState = this.stateMap.get(next);
    if (!nextState) {
      console.warn(`[CharacterFSM] Unknown state "${next}", skipping transition.`);
      return;
    }
    this._current?.exit(this._ctx);
    this._current = nextState;
    nextState.enter(this._ctx);
  }

  /** Tick the active state. Call once per game frame. */
  update(delta: number): void {
    this._current?.update(this._ctx, delta);
  }

  /** The type of the currently active state. */
  get currentType(): CharacterStateType {
    return this._current?.type;
  }
}
