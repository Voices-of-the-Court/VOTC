/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "convertsToReligionOf",
  title: {
    en: "Source Converts to Target's Religion",
    ru: "Исходный персонаж переходит в религию цели",
    fr: "La source se convertit à la religion de la cible",
    de: "Quellcharakter konvertiert zur Religion des Ziels",
    es: "La fuente se convierte a la religión del objetivo",
    ja: "ソースがターゲットの宗教に改宗",
    ko: "출처가 대상의 종교로 개종",
    pl: "Źródło przechodzi na religię celu",
    zh: "源角色皈依目标的宗教"
  },

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
   * @param {string} params.lang - Language code for i18n
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args, lang }) => {
    if (!targetCharacter) {
      return {
        message: {
          en: "Failed: No target character specified",
          ru: "Ошибка: Целевой персонаж не указан",
          fr: "Échec : Aucun personnage cible spécifié",
          de: "Fehler: Kein Zielcharakter angegeben",
          es: "Error: No se especificó un personaje objetivo",
          ja: "失敗: ターゲットキャラクターが指定されていません",
          ko: "실패: 대상 캐릭터가 지정되지 않았습니다",
          pl: "Niepowodzenie: Nie określono postaci docelowej",
          zh: "失败: 未指定目标角色"
        },
        sentiment: 'negative'
      };
    }

    const isWillinglyConverted = args && typeof args.isWillinglyConverted === "boolean" ? args.isWillinglyConverted : false;
    const isPlayerSource = args && typeof args.isPlayerSource === "boolean" ? args.isPlayerSource : false;

    if (!isPlayerSource) {
      if (isWillinglyConverted) {
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
        message: {
          en: `${sourceCharacter.shortName} converted to ${targetCharacter.shortName}'s faith${isWillinglyConverted ? ' willingly' : ' forcefully'}`,
          ru: `${sourceCharacter.shortName} перешел в веру ${targetCharacter.shortName}${isWillinglyConverted ? ' добровольно' : ' принудительно'}`,
          fr: `${sourceCharacter.shortName} s'est converti à la foi de ${targetCharacter.shortName}${isWillinglyConverted ? ' volontiers' : ' de force'}`,
          de: `${sourceCharacter.shortName} konvertierte zum Glauben von ${targetCharacter.shortName}${isWillinglyConverted ? ' freiwillig' : ' gewaltsam'}`,
          es: `${sourceCharacter.shortName} se convirtió a la fe de ${targetCharacter.shortName}${isWillinglyConverted ? ' voluntariamente' : ' por la fuerza'}`,
          ja: `${sourceCharacter.shortName}は${targetCharacter.shortName}の信仰に${isWillinglyConverted ? '自発的に' : '強制的に'}改宗しました`,
          ko: `${sourceCharacter.shortName}은(는) ${targetCharacter.shortName}의 신앙으로${isWillinglyConverted ? ' 자발적으로' : ' 강제로'} 개종했습니다`,
          pl: `${sourceCharacter.shortName} przeszedł na wiarę ${targetCharacter.shortName}${isWillinglyConverted ? ' dobrowolnie' : ' siłą'}`,
          zh: `${sourceCharacter.shortName}${isWillinglyConverted ? '自愿' : '被迫'}皈依了${targetCharacter.shortName}的信仰`
        },
        sentiment: 'neutral'
      };
    } else {
      if (isWillinglyConverted) {
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
        message: {
          en: `${gameData.playerName} converted to ${targetCharacter.shortName}'s faith${isWillinglyConverted ? ' willingly' : ' forcefully'}`,
          ru: `${gameData.playerName} перешел в веру ${targetCharacter.shortName}${isWillinglyConverted ? ' добровольно' : ' принудительно'}`,
          fr: `${gameData.playerName} s'est converti à la foi de ${targetCharacter.shortName}${isWillinglyConverted ? ' volontiers' : ' de force'}`,
          de: `${gameData.playerName} konvertierte zum Glauben von ${targetCharacter.shortName}${isWillinglyConverted ? ' freiwillig' : ' gewaltsam'}`,
          es: `${gameData.playerName} se convirtió a la fe de ${targetCharacter.shortName}${isWillinglyConverted ? ' voluntariamente' : ' por la fuerza'}`,
          ja: `${gameData.playerName}は${targetCharacter.shortName}の信仰に${isWillinglyConverted ? '自発的に' : '強制的に'}改宗しました`,
          ko: `${gameData.playerName}은(는) ${targetCharacter.shortName}의 신앙으로${isWillinglyConverted ? ' 자발적으로' : ' 강제로'} 개종했습니다`,
          pl: `${gameData.playerName} przeszedł na wiarę ${targetCharacter.shortName}${isWillinglyConverted ? ' dobrowolnie' : ' siłą'}`,
          zh: `${gameData.playerName}${isWillinglyConverted ? '自愿' : '被迫'}皈依了${targetCharacter.shortName}的信仰`
        },
        sentiment: 'neutral'
      };
    }
  },
};
