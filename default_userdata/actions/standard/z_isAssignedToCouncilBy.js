/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

const COUNCIL_POSITIONS = ["chancellor", "steward", "marshal", "spymaster", "court_chaplain"];

module.exports = {
  signature: "isAssignedToCouncilBy",
  title: "Source Assigned to Target's Council",

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ gameData, sourceCharacter }) => [
    {
      name: "council_position",
      type: "enum",
      description: `The council position to which ${sourceCharacter.shortName} is assigned. Options: chancellor, steward, marshal, spymaster, court_chaplain.`,
      required: true,
      options: COUNCIL_POSITIONS
    },
    {
      name: "isPlayerSource",
      type: "boolean",
      description: `If true, ${gameData.playerName} is the one being assigned to the council`,
      required: false,
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ gameData, sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} is appointed to the target character's council. Target must be a landed ruler.
    If isPlayerSource is true, ${gameData.playerName} will be assigned instead of ${sourceCharacter.shortName}.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Only landed rulers can have councils
    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => {
      const char = gameData.characters.get(id);
      return char && char.isLandedRuler && id !== sourceCharacter.id;
    });

    return {
      canExecute: validTargets.length > 0,
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

    if (!targetCharacter.isLandedRuler) {
      return {
        message: `Failed: ${targetCharacter.shortName} is not a landed ruler and cannot have a council`,
        sentiment: 'negative'
      };
    }

    const position = typeof args?.council_position === "string" 
      ? args.council_position.toLowerCase().trim() 
      : "";

    if (!COUNCIL_POSITIONS.includes(position)) {
      return {
        message: `Failed: Invalid council position "${position}"`,
        sentiment: 'negative'
      };
    }

    const isPlayerSource = args && typeof args.isPlayerSource === "boolean" ? args.isPlayerSource : false;

    // Map position names to councillor types
    const positionMap = {
      "chancellor": "councillor_chancellor",
      "steward": "councillor_steward",
      "marshal": "councillor_marshal",
      "spymaster": "councillor_spymaster",
      "court_chaplain": "councillor_court_chaplain"
    };

    const councillorType = positionMap[position];

    if (!isPlayerSource) {
      // Source character is assigned
      runGameEffect(`
global_var:votc_action_target = {
    fire_councillor = cp:${councillorType}
    assign_councillor_type = {
        type = ${councillorType}
        target = global_var:votc_action_source
    }
}`);

      return {
        message: `${sourceCharacter.shortName} was assigned as ${position} to ${targetCharacter.shortName}'s council`,
        sentiment: 'positive'
      };
    } else {
      // Player is assigned
      runGameEffect(`
global_var:votc_action_target = {
    fire_councillor = cp:${councillorType}
    assign_councillor_type = {
        type = ${councillorType}
        target = root
    }
}`);

      return {
        message: `${gameData.playerName} was assigned as ${position} to ${targetCharacter.shortName}'s council`,
        sentiment: 'positive'
      };
    }
  },
};
