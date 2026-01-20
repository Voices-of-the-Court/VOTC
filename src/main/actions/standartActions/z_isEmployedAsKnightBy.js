/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "isEmployedAsKnightBy",
  title: "Source Joins Target's Court as Knight",

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} (who is not a ruler or knight) decides to join the target character's court as a knight.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Cannot employ a ruler as knight
    if (sourceCharacter.isLandedRuler) {
      return {
        canExecute: false,
        validTargetCharacterIds: [],
      };
    }

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
   * @param {Record<string, number|string|boolean|null>} params.args
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args }) => {
    if (!targetCharacter) {
      return {
        message: "Failed: No target character specified",
        sentiment: 'negative'
      };
    }

    runGameEffect(`
global_var:votc_action_source = {
    add_to_entourage_court_and_activity_effect = {
        CHAR_TO_ADD = global_var:votc_action_source
        NEW_COURT_OWNER = global_var:votc_action_target
    }
    set_knight_status = force
}`);

    return {
      message: `${sourceCharacter.shortName} joined ${targetCharacter.shortName}'s court as a knight`,
      sentiment: 'positive'
    };
  },
};
