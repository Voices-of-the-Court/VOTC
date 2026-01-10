/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "isImprisonedBy",
  title: "Source Is Imprisoned By Target",

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "prisonType",
      type: "enum",
      description: `Type of prison ${sourceCharacter.shortName} is sent to. Possible values: house_arrest, dungeon.`,
      required: true,
      options: ["house_arrest", "dungeon"],
    },
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Imprison ${sourceCharacter.shortName} by the chosen target (the jailor). Optionally specify prisonType: default, house_arrest, or dungeon.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Minimal logic per instructions: allow execution.
    // Still provide valid targets so the model MUST choose a jailor.
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
        message: "Failed: No target character specified",
        sentiment: 'negative'
      };
    }

    const raw = (args && typeof args.prisonType === "string") ? args.prisonType.trim().toLowerCase() : "default";
    const prisonType = ["default", "house_arrest", "dungeon"].includes(raw) ? raw : "default";

    if (prisonType === "house_arrest") {
      runGameEffect(`
if = {
    limit = {
        global_var:votc_action_source = { target_is_liege_or_above = global_var:votc_action_target }
    }
    imprison_character_effect = {
        TARGET = global_var:votc_action_source
        IMPRISONER = global_var:votc_action_target
    }
    global_var:votc_action_target = {
        consume_imprisonment_reasons = global_var:votc_action_source
    }
}
else = {
    rightfully_imprison_character_effect = {
        TARGET = global_var:votc_action_source
        IMPRISONER = global_var:votc_action_target
    }
}`);
      return {
        message: `${sourceCharacter.shortName} was placed under house arrest by ${targetCharacter.shortName}`,
        sentiment: 'negative'
      };
    }

    if (prisonType === "dungeon") {
      runGameEffect(`
if = {
    limit = {
        global_var:votc_action_source = { target_is_liege_or_above = global_var:votc_action_target }
    }
    imprison_character_effect = {
        TARGET = global_var:votc_action_source
        IMPRISONER = global_var:votc_action_target
    }
    global_var:votc_action_source = {
        change_prison_type = dungeon
    }
    global_var:votc_action_target = {
        consume_imprisonment_reasons = global_var:votc_action_source
    }
}
else = {
    rightfully_imprison_character_effect = {
        TARGET = global_var:votc_action_source
        IMPRISONER = global_var:votc_action_target
    }
    global_var:votc_action_source = {
        change_prison_type = dungeon
    }
}`);
      return {
        message: `${sourceCharacter.shortName} was thrown into the dungeon by ${targetCharacter.shortName}`,
        sentiment: 'negative'
      };
    }

    // default
    runGameEffect(`
if = {
    limit = {
        global_var:votc_action_source = { target_is_liege_or_above = global_var:votc_action_target }
    }
    imprison_character_effect = {
        TARGET = global_var:votc_action_source
        IMPRISONER = global_var:votc_action_target
    }
    global_var:votc_action_target = {
        consume_imprisonment_reasons = global_var:votc_action_source
    }
}
else = {
    rightfully_imprison_character_effect = {
        TARGET = global_var:votc_action_source
        IMPRISONER = global_var:votc_action_target
    }
}`);
    return {
      message: `${sourceCharacter.shortName} was imprisoned by ${targetCharacter.shortName}`,
      sentiment: 'negative'
    };
  },
};