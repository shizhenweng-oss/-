import { BaseCharacter, type CharacterConfig } from './BaseCharacter';
import { SeaTigerComboState } from './fsm/states/SeaTigerComboState';
import { SeaTigerSkill1State } from './fsm/states/SeaTigerSkill1State';
import { SeaTigerSkill2State } from './fsm/states/SeaTigerSkill2State';
import { SeaTigerUltimateState } from './fsm/states/SeaTigerUltimateState';
import { SeaTigerWindState } from './fsm/states/SeaTigerWindState';
import { SeaTigerThunderState } from './fsm/states/SeaTigerThunderState';
import { SeaTigerIceState } from './fsm/states/SeaTigerIceState';
import { SeaTigerFireState } from './fsm/states/SeaTigerFireState';
import { SeaTigerBuffState } from './fsm/states/SeaTigerBuffState';
import { SeaTigerBlinkState } from './fsm/states/SeaTigerBlinkState';
import { SeaTigerBackDashProjectileState } from './fsm/states/SeaTigerBackDashProjectileState';
import { SeaTigerUltimateHiddenState } from './fsm/states/SeaTigerUltimateHiddenState';

export class SeaTiger extends BaseCharacter {
  
  // SeaTiger specific transient data
  seaTigerData = {
    comboIndex: 0,
    comboBuffered: false,
    skill1Timer: 0,
    skill1HitRegistered: false,
  };

  constructor(scene: Phaser.Scene, cfg: CharacterConfig) {
    super(scene, cfg);

    // Register SeaTiger specific states
    this.fsm
      .addState(new SeaTigerComboState())
      .addState(new SeaTigerSkill1State())
      .addState(new SeaTigerSkill2State())
      .addState(new SeaTigerUltimateState())
      .addState(new SeaTigerWindState())
      .addState(new SeaTigerThunderState())
      .addState(new SeaTigerIceState())
      .addState(new SeaTigerFireState())
      .addState(new SeaTigerBuffState())
      .addState(new SeaTigerBlinkState())
      .addState(new SeaTigerBackDashProjectileState())
      .addState(new SeaTigerUltimateHiddenState());
  }
}
