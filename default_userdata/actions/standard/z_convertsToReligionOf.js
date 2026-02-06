/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "convertsToReligionOf",
  title: "Source Converts to Target's Religion",

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  args: ({ gameData, sourceCharacter }) => [
    {
      name: "isWillinglyConverted",
      type: "boolean",
      description: `Should be true if ${sourceCharacter.shortName} converts willingly, false if forcefully converted.`,
      required: true
    },
    {
      name: "isPlayerSource",
      type: "boolean",
      description: `If true, ${gameData.playerName} is the one converting to the target's faith`,
      required: false,
    }
  ],

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter, gameData }) =>
    `Execute when ${sourceCharacter.shortName} converts to the target character's faith, either willingly or forcefully.
    If isPlayerSource is true, ${gameData.playerName} will convert instead of ${sourceCharacter.shortName}.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
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

    const isWillinglyConverted = args && typeof args.isWillinglyConverted === "boolean" ? args.isWillinglyConverted : false;
    const isPlayerSource = args && typeof args.isPlayerSource === "boolean" ? args.isPlayerSource : false;

    if (!isPlayerSource) {
      // Source character converts to target's religion
      if (isWillinglyConverted) {
        // Willingly: 10% chance of becoming crypto-religionist
        runGameEffect(`
random_list = {
    10 = {
        global_var:votc_action_source = {
            save_temporary_scope_value_as = {
                name = tmp
                value = global_var:votc_action_source.faith
            }
            set_character_faith = global_var:votc_action_target.faith
            make_character_crypto_religionist_effect = {
                CRYPTO_RELIGION = scope:tmp
            }
        }
    }
    90 = {
        global_var:votc_action_source = {
            set_character_faith = global_var:votc_action_target.faith
        }
    }
}`);
      } else {
        // Forcefully: 60% chance of becoming crypto-religionist
        runGameEffect(`
random_list = {
    60 = {
        global_var:votc_action_source = {
            save_temporary_scope_value_as = {
                name = tmp
                value = global_var:votc_action_source.faith
            }
            set_character_faith = global_var:votc_action_target.faith
            make_character_crypto_religionist_effect = {
                CRYPTO_RELIGION = scope:tmp
            }
        }
    }
    40 = {
        global_var:votc_action_source = {
            set_character_faith = global_var:votc_action_target.faith
        }
    }
}`);
      }

      return {
        message: `${sourceCharacter.shortName} converted to ${targetCharacter.shortName}'s faith${isWillinglyConverted ? ' willingly' : ' forcefully'}`,
        sentiment: 'neutral'
      };
    } else {
      // Player converts to target's religion
      if (isWillinglyConverted) {
        // Willingly: 10% chance of becoming crypto-religionist
        runGameEffect(`
random_list = {
    10 = {
        root = {
            save_temporary_scope_value_as = {
                name = tmp
                value = root.faith
            }
            set_character_faith = global_var:votc_action_target.faith
            make_character_crypto_religionist_effect = {
                CRYPTO_RELIGION = scope:tmp
            }
        }
    }
    90 = {
        root = {
            set_character_faith = global_var:votc_action_target.faith
        }
    }
}`);
      } else {
        // Forcefully: 60% chance of becoming crypto-religionist
        runGameEffect(`
random_list = {
    60 = {
        root = {
            save_temporary_scope_value_as = {
                name = tmp
                value = root.faith
            }
            set_character_faith = global_var:votc_action_target.faith
            make_character_crypto_religionist_effect = {
                CRYPTO_RELIGION = scope:tmp
            }
        }
    }
    40 = {
        root = {
            set_character_faith = global_var:votc_action_target.faith
        }
    }
}`);
      }

      return {
        message: `${gameData.playerName} converted to ${targetCharacter.shortName}'s faith${isWillinglyConverted ? ' willingly' : ' forcefully'}`,
        sentiment: 'neutral'
      };
    }
  },
};
