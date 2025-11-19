/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "characterIsKilled",
  title: "Source Character Is Killed",

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
    `Execute ONLY when ${sourceCharacter.shortName} (id=${sourceCharacter.id}) is killed. Target must be the killer of the source.`,

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
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect }) => {
    // If for some reason target wasn't provided, do nothing.
    if (!targetCharacter) return;

    runGameEffect(`
global_var:votc_action_source = {
    death = {
        death_reason = death_murder
        killer = global_var:votc_action_target
    }
}`);
  },
};
