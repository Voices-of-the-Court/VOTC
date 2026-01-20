/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "playerPaysGoldTo",
  title: "Player Pays Gold to Target",

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   * @param {GameData} params.gameData
   */
  args: ({ sourceCharacter, gameData }) => {
    const player = gameData.characters.get(gameData.playerID);
    const playerGold = player ? player.gold : 0;
    
    return [
      {
        name: "amount",
        type: "number",
        description: `The amount of gold ${gameData.playerName} pays to the target. ${gameData.playerName} currently has ${playerGold} gold.`,
        required: true,
        min: 1,
        max: playerGold,
        step: 1
      }
    ];
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   * @param {GameData} params.gameData
   */
  description: ({ sourceCharacter, gameData }) => {
    const player = gameData.characters.get(gameData.playerID);
    const playerGold = player ? player.gold : 0;
    return `Execute when ${gameData.playerName} (who has ${playerGold} gold) gives gold to the target character, only if it's clear the target accepted it. The player must have enough gold to pay.`;
  },

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    const player = gameData.characters.get(gameData.playerID);
    
    // Player must have some gold to pay
    if (!player || player.gold <= 0) {
      return {
        canExecute: false,
        validTargetCharacterIds: [],
      };
    }

    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => id !== gameData.playerID);
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

    const player = gameData.characters.get(gameData.playerID);
    if (!player) {
      return {
        message: "Failed: Player character not found",
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

    // Check if player has enough gold
    if (player.gold < amount) {
      return {
        message: `Failed: ${gameData.playerName} only has ${player.gold} gold, cannot pay ${amount}`,
        sentiment: 'negative'
      };
    }

    // Transfer gold: target gains, player (root) loses
    runGameEffect(`
global_var:votc_action_target = {
    add_gold = ${amount}
}

root = {
    remove_short_term_gold = ${amount}
}`);

    // Update local game data
    player.gold -= amount;
    targetCharacter.gold += amount;

    return {
      message: `${gameData.playerName} paid ${amount} gold to ${targetCharacter.shortName}`,
      sentiment: 'neutral'
    };
  },
};
