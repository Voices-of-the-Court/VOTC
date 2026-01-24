/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "agreedToTruceWith",
  title: "Mutual Truce",

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "years",
      type: "number",
      description: `Number of years the mutual truce lasts between ${sourceCharacter.shortName} and the target.`,
      required: false,
      min: 1,
      max: 50,
      step: 1
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} agrees to both ways truce with target character. Choose a target character and optionally specify 'years' (default 3).`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => id !== sourceCharacter.id);
    return {
      canExecute: true,
      validTargetCharacterIds: validTargets,
    };
  },

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   * @param {Character} params.targetCharacter
   * @param {Function} params.runGameEffect
   * @param {Record<string, number|string|null>} params.args
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args }) => {
    if (!targetCharacter) {
      return {
        message: "Failed: No target character specified for truce",
        sentiment: 'negative'
      };
    }
    
    let years = 3;
    const raw = args?.years;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      years = Math.max(1, Math.min(50, Math.floor(raw)));
    }

    runGameEffect(`
global_var:votc_action_source = {
    add_truce_both_ways = {
        character = global_var:votc_action_target
        years = ${years}
        override = yes
    }
}`);

    return {
      message: `${sourceCharacter.shortName} and ${targetCharacter.shortName} agreed to a ${years}-year truce`,
      sentiment: 'positive'
    };
  },
};