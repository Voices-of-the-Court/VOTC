/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "characterIsKilled",
  title: "Source Character Is Killed",
  isDestructive: true,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  args: ({ gameData, sourceCharacter }) => [
    {
      name: "isPlayerSource",
      type: "boolean",
      description: `If true, ${gameData.playerName} is the one being killed`,
      required: false,
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ gameData, sourceCharacter }) =>
    `Execute ONLY when ${sourceCharacter.shortName} (id=${sourceCharacter.id}) is killed. Target must be the killer of the source.
    If isPlayerSource is true, the ${gameData.playerName} will be killed instead of ${sourceCharacter.shortName}.`,

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   * @param {GameData} params.gameData
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
   * @param {Character} params.sourceCharacter
   * @param {Character} params.targetCharacter
   * @param {Function} params.runGameEffect
   * @param {GameData} params.gameData
   * @param {Record<string, number|string|boolean|null>} params.args
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args }) => {
    // If for some reason target wasn't provided, do nothing.
    if (!targetCharacter) {
      return {
        message: "Failed: No killer specified",
        sentiment: 'negative'
      };
    }

    const isPlayerSource = args && typeof args.isPlayerSource === "boolean" ? args.isPlayerSource : false;

    if (isPlayerSource) {
      runGameEffect(`
root = {
    death = {
        death_reason = death_murder
        killer = global_var:votc_action_target
    }
}`);

      return {
        message: `${gameData.playerName} was killed by ${targetCharacter.shortName}`,
        sentiment: 'negative'
      };
    } else {
      runGameEffect(`
global_var:votc_action_source = {
    death = {
        death_reason = death_murder
        killer = global_var:votc_action_target
    }
}`);

      return {
        message: `${sourceCharacter.shortName} was killed by ${targetCharacter.shortName}`,
        sentiment: 'negative'
      };
    }
  },
};
