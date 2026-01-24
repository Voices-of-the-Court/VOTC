/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

const COURT_POSITIONS = [
  "physician", "keeper_of_swans", "travel_leader", "master_of_horse", "court_jester",
  "master_of_hunt", "high_almoner", "cupbearer", "seneschal", "antiquarian", "tutor",
  "royal_architect", "court_poet", "bodyguard", "court_champion", "musician", "food_taster",
  "lady_in_waiting", "garuda", "chief_eunuch", "court_gardener", "chief_qadi", "wet_nurse",
  "akolouthos"
];

module.exports = {
  signature: "isAssignedToCourtPositionBy",
  title: "Source Assigned to Target's Court Position",

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ gameData, sourceCharacter }) => [
    {
      name: "court_position",
      type: "enum",
      description: `The court position to which ${sourceCharacter.shortName} is assigned.`,
      required: true,
      options: COURT_POSITIONS
    },
    {
      name: "isPlayerSource",
      type: "boolean",
      description: `If true, ${gameData.playerName} is the one being assigned to the court position`,
      required: false,
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ gameData, sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} is appointed to a court position in the target character's court. Target must be a landed ruler.
    If isPlayerSource is true, ${gameData.playerName} will be assigned instead of ${sourceCharacter.shortName}.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Only landed rulers can have court positions
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
        message: `Failed: ${targetCharacter.shortName} is not a landed ruler and cannot have court positions`,
        sentiment: 'negative'
      };
    }

    const position = typeof args?.court_position === "string" 
      ? args.court_position.toLowerCase().trim() 
      : "";

    if (!COURT_POSITIONS.includes(position)) {
      return {
        message: `Failed: Invalid court position "${position}"`,
        sentiment: 'negative'
      };
    }

    const isPlayerSource = args && typeof args.isPlayerSource === "boolean" ? args.isPlayerSource : false;

    // Map position names to court position types
    const positionMap = {
      "physician": "court_physician_court_position",
      "keeper_of_swans": "keeper_of_swans_court_position",
      "travel_leader": "travel_leader_court_position",
      "master_of_horse": "master_of_horse_court_position",
      "court_jester": "court_jester_court_position",
      "master_of_hunt": "master_of_hunt_court_position",
      "high_almoner": "high_almoner_court_position",
      "cupbearer": "cupbearer_court_position",
      "seneschal": "seneschal_court_position",
      "antiquarian": "antiquarian_court_position",
      "tutor": "court_tutor_court_position",
      "royal_architect": "royal_architect_court_position",
      "court_poet": "court_poet_court_position",
      "bodyguard": "bodyguard_court_position",
      "court_champion": "champion_court_position",
      "musician": "court_musician_court_position",
      "food_taster": "food_taster_court_position",
      "lady_in_waiting": "lady_in_waiting_court_position",
      "garuda": "garuda_court_position",
      "chief_eunuch": "chief_eunuch_court_position",
      "court_gardener": "court_gardener_court_position",
      "chief_qadi": "chief_qadi_court_position",
      "wet_nurse": "wet_nurse_court_position",
      "akolouthos": "akolouthos_court_position"
    };

    const courtPositionType = positionMap[position];

    if (!isPlayerSource) {
      // Source character is assigned
      // Add gender checks for wet_nurse and akolouthos
      if (position === "wet_nurse") {
        runGameEffect(`
global_var:votc_action_target = {
    trigger = {
        global_var:votc_action_source = {
            is_female = yes
        }
    }
    revoke_court_position = {
        court_position = ${courtPositionType}
    }
    appoint_court_position = {
        recipient = global_var:votc_action_source
        court_position = ${courtPositionType}
    }
}`);
      } else if (position === "akolouthos") {
        runGameEffect(`
global_var:votc_action_target = {
    trigger = {
        global_var:votc_action_source = {
            is_male = yes
        }
    }
    revoke_court_position = {
        court_position = ${courtPositionType}
    }
    appoint_court_position = {
        recipient = global_var:votc_action_source
        court_position = ${courtPositionType}
    }
}`);
      } else {
        runGameEffect(`
global_var:votc_action_target = {
    revoke_court_position = {
        court_position = ${courtPositionType}
    }
    appoint_court_position = {
        recipient = global_var:votc_action_source
        court_position = ${courtPositionType}
    }
}`);
      }

      return {
        message: `${sourceCharacter.shortName} was assigned as ${position.replace(/_/g, ' ')} to ${targetCharacter.shortName}'s court`,
        sentiment: 'positive'
      };
    } else {
      // Player is assigned
      if (position === "wet_nurse") {
        runGameEffect(`
global_var:votc_action_target = {
    trigger = {
        root = {
            is_female = yes
        }
    }
    revoke_court_position = {
        court_position = ${courtPositionType}
    }
    appoint_court_position = {
        recipient = root
        court_position = ${courtPositionType}
    }
}`);
      } else if (position === "akolouthos") {
        runGameEffect(`
global_var:votc_action_target = {
    trigger = {
        root = {
            is_male = yes
        }
    }
    revoke_court_position = {
        court_position = ${courtPositionType}
    }
    appoint_court_position = {
        recipient = root
        court_position = ${courtPositionType}
    }
}`);
      } else {
        runGameEffect(`
global_var:votc_action_target = {
    revoke_court_position = {
        court_position = ${courtPositionType}
    }
    appoint_court_position = {
        recipient = root
        court_position = ${courtPositionType}
    }
}`);
      }

      return {
        message: `${gameData.playerName} was assigned as ${position.replace(/_/g, ' ')} to ${targetCharacter.shortName}'s court`,
        sentiment: 'positive'
      };
    }
  },
};
