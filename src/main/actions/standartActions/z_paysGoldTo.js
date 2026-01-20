/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "paysGoldTo",
  title: "Source Pays Gold to Target",

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "amount",
      type: "number",
      description: `The amount of gold ${sourceCharacter.shortName} pays to the target. ${sourceCharacter.shortName} currently has ${sourceCharacter.gold} gold.`,
      required: true,
      min: 1,
      max: sourceCharacter.gold,
      step: 1
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} (who has ${sourceCharacter.gold} gold) gives gold to the target character, only if it's clear the target accepted it. The source must have enough gold to pay.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Source must have some gold to pay
    if (sourceCharacter.gold <= 0) {
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

    let amount = 0;
    const raw = args?.amount;
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      amount = Math.floor(raw);
    } else {
      return {
        message: `Failed: Invalid gold amount`,
        sentiment: 'negative'
      };
    }

    // Check if source has enough gold
    if (sourceCharacter.gold < amount) {
      return {
        message: `Failed: ${sourceCharacter.shortName} only has ${sourceCharacter.gold} gold, cannot pay ${amount}`,
        sentiment: 'negative'
      };
    }

    // Transfer gold: target gains, source loses
    runGameEffect(`
global_var:votc_action_target = {
    add_gold = ${amount}
}

global_var:votc_action_source = {
    remove_short_term_gold = ${amount}
}`);

    // Update local game data
    sourceCharacter.gold -= amount;
    targetCharacter.gold += amount;

    return {
      message: `${sourceCharacter.shortName} paid ${amount} gold to ${targetCharacter.shortName}`,
      sentiment: 'neutral'
    };
  },
};
