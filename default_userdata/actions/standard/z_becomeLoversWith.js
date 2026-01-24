/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "becomeLoversWith",
  title: "Become Lovers",

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "reason",
      type: "string",
      description: `The reason (event) that made ${sourceCharacter.shortName} and the target become lovers (in past tense).`,
      required: false
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} and the target character become lovers through ongoing amorous and sexual association. This creates a mutual lover relationship.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // TODO: Add proper checks for existing relationships and opinion requirements
    // For now, allow execution with any valid target
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

    const reason = typeof args?.reason === "string" && args.reason.trim() 
      ? args.reason.trim() 
      : "became_lovers";

    runGameEffect(`
global_var:votc_action_source = {
    set_relation_lover = {
        reason = ${reason}
        target = global_var:votc_action_target
    }
}`);

    return {
      message: `${sourceCharacter.shortName} and ${targetCharacter.shortName} became lovers`,
      sentiment: 'positive'
    };
  },
};
