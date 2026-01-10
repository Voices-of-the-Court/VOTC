/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "intercourse",
  title: "Sexual Intercourse Concluded",

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
    `Execute only after ${sourceCharacter.shortName} had sexual intercourse with the target. The act can be consensual or forced. Never execute if there's no finishing.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => id !== sourceCharacter.id);

    // Exclude targets with whom source had intercourse recently
    const recentlyWithIds = new Set();
    for (const t of sourceCharacter.traits) {
      if (t && typeof t.name === "string" && t.name.toLowerCase() === "hadsex" && typeof t.desc === "string") {
        const m = t.desc.match(/\[withId=(\d+)\]/);
        if (m) {
          recentlyWithIds.add(Number(m[1]));
        }
      }
    }

    const filtered = validTargets.filter((id) => !recentlyWithIds.has(id));
    if (filtered.length === 0) {
      return {
        canExecute: false,
        validTargetCharacterIds: [],
      };
    }
    return {
      canExecute: true,
      validTargetCharacterIds: filtered,
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
        message: "Failed: No partner specified",
        sentiment: 'negative'
      };
    }

    runGameEffect(`
global_var:votc_action_source = {
    had_sex_with_effect = {
        CHARACTER = global_var:votc_action_target
        PREGNANCY_CHANCE = pregnancy_chance
    }
}`);

    // Add a trait on source to record recency and partner
    try {
      sourceCharacter.addTrait({
        category: "flag",
        name: "HadSex",
        desc: `${sourceCharacter.shortName} had sex recently with ${targetCharacter.shortName} [withId=${targetCharacter.id}]`,
      });
    } catch (e) {
      // ignore
    }

    return {
      message: `${sourceCharacter.shortName} had intercourse with ${targetCharacter.shortName}`,
      sentiment: 'neutral'
    };
  },
};