/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "isFiredFromCouncilOf",
  title: "Source Fired from Target's Council",

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
    `Execute when ${sourceCharacter.shortName} is fired/dismissed/retired from the target character's council.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Can be fired from any character's council except own
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
trigger = {
    global_var:votc_action_source = {
        exists = liege
        liege = global_var:votc_action_target
        OR = {
            has_council_position = councillor_chancellor
            has_council_position = councillor_marshal
            has_council_position = councillor_steward
            has_council_position = councillor_spymaster
            has_council_position = councillor_court_chaplain
        }
        can_be_fired_from_council_trigger = { COURT_OWNER = global_var:votc_action_target }
    }
}
global_var:votc_action_target = { 
    fire_councillor = global_var:votc_action_source 
}`);

    return {
      message: `${sourceCharacter.shortName} is no longer a councillor of ${targetCharacter.shortName}`,
      sentiment: 'negative'
    };
  },
};
