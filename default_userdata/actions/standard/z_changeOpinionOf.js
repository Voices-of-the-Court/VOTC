/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "changeOpinionOf",
  title: "Change Source's Opinion of Target",

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "value",
      type: "number",
      description: `Opinion change value from -10 to 10. Positive values improve ${sourceCharacter.shortName}'s opinion of the target, negative values worsen it.`,
      required: true,
      min: -10,
      max: 10,
      step: 1
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName}'s opinion of the target character changes due to conversation or actions. Value range: -10 to 10. Positive = opinion improves, negative = opinion worsens.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Can change opinion of any other character
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

    // Validate and clamp the value
    let value = 0;
    const raw = args?.value;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      value = Math.max(-10, Math.min(10, Math.floor(raw)));
    } else {
      return {
        message: `Failed: Invalid opinion value`,
        sentiment: 'negative'
      };
    }

    if (value === 0) {
      return {
        message: `No opinion change (value was 0)`,
        sentiment: 'neutral'
      };
    }

    // Update the source character's opinion of the target
    runGameEffect(`
global_var:votc_action_source = {
    add_opinion = {
        target = global_var:votc_action_target
        modifier = conversation_opinion
        opinion = ${value}
    }
}`);

    // Determine sentiment based on value
    const sentiment = value > 0 ? 'positive' : 'negative';
    const direction = value > 0 ? 'improved' : 'worsened';
    const absValue = Math.abs(value);

    return {
      message: `${sourceCharacter.shortName}'s opinion of ${targetCharacter.shortName} ${direction} by ${absValue}`,
      sentiment: sentiment
    };
  },
};
