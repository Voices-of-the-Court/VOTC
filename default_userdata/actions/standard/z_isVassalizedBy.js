//Made by: MrAndroPC

/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
    signature: "isVassalizedBy",
    title: {
        en: "Source Character Is Vassalized By Target",
        ru: "Исходный персонаж вассализирован целью",
        fr: "La source personnage est vassalisé par la cible",
        de: "Quellcharakter wird von Ziel vassalisiert",
        es: "El personaje fuente es vassalizado por el objetivo",
        ja: "ソースがターゲットによって継続",
        ko: "출처 캐릭터가 대상에 살해지는",
        pl: "Źródło postaci jest wassalizowany przez cel",
        zh: "源角色被目标継続"
    },
    isDestructive: true,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  args: ({ gameData, sourceCharacter }) => [
    {
      name: "isPlayerSource",
      type: "boolean",
      description: `If true, ${gameData.playerName} is the one being vassalized`,
      required: false,
    }
  ],

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  description: ({ gameData, sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} (who is a landed ruler) agrees to be vassalized by the target character.
    If isPlayerSource is true, ${gameData.playerName} will be vassalized instead of ${sourceCharacter.shortName}.`,
    
  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Only landed rulers can have vassals
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
   * @param {string} params.lang - Language code for i18n
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args, lang }) => {
    const isPlayerSource = args && typeof args.isPlayerSource === "boolean" ? args.isPlayerSource : false;
    if (isPlayerSource) {
        sourceCharacter = gameData.characters.get(gameData.playerID);
    }
    if (!sourceCharacter.isLandedRuler) {
    return {
        message: {
            en: `Failed: ${sourceCharacter.shortName} is unlanded`,
            ru: `Ошибка: ${sourceCharacter.shortName} безземельный`,
            fr: `Échec: ${sourceCharacter.shortName} sans terre`,
            de: `Fehler: ${sourceCharacter.shortName} ohne Land`,
            es: `Error: ${sourceCharacter.shortName} sin títulos`,
            ja: `失敗: ${sourceCharacter.shortName} は所領無し`,
            ko: `실패: ${sourceCharacter.shortName} 비지주`,
            pl: `Niepowodzenie: ${sourceCharacter.shortName} bez ziemi`,
            zh: `失败: ${sourceCharacter.shortName} 无领地`
            
        },
        sentiment: "negative"
      }
    }
    if (!sourceCharacter.isIndependentRuler) {
        return {
            message: {
                en: `Failed: ${sourceCharacter.shortName} is not independent ruler`,
                ru: `Ошибка: ${sourceCharacter.shortName} не является независимым правителем`,
                fr: `Échec: ${sourceCharacter.shortName} n’est pas indépendant`,
                de: `Fehler: ${sourceCharacter.shortName} ist nicht unabhängig`,
                es: `Error: ${sourceCharacter.shortName} no es independiente`,
                ja: `失敗: ${sourceCharacter.shortName}は独立していません`,
                ko: `실패: ${sourceCharacter.shortName}은 독립 영주가 아닌이다`,
                pl: `Niepowodzenie: ${sourceCharacter.shortName} nie jest niezależnym rębłem`,
                zh: `失败: ${sourceCharacter.shortName} 不是独立统治者`
            },
            sentiment: "negative"
        }
    }

    runGameEffect(`
        create_title_and_vassal_change = {
            type = swear_fealty
            save_scope_as = change
        }
        ${isPlayerSource ? "root" : "global_var:votc_action_source"} = {
            change_liege = {
                liege = global_var:votc_action_target
                change = scope:change
            }
            add_opinion = {
                modifier = became_vassal
                target = global_var:votc_action_target
                opinion = 10
            }
        }
        resolve_title_and_vassal_change = scope:change
    `);
    return {
      message: {
        en: `${sourceCharacter.shortName} is vassalized by ${targetCharacter.shortName}.`,
        ru: `${sourceCharacter.shortName} вассализирован ${targetCharacter.shortName}.`,
        fr: `${sourceCharacter.shortName} est vassalisé par ${targetCharacter.shortName}.`,
        de: `${sourceCharacter.shortName} wird von ${targetCharacter.shortName} vassalisiert.`,
        es: `${sourceCharacter.shortName} es vassalizado por ${targetCharacter.shortName}.`,
        ja: `${sourceCharacter.shortName}が${targetCharacter.shortName}によって継続`,
        ko: `${sourceCharacter.shortName}가 ${targetCharacter.shortName}에 살해지는`,
        pl: `${sourceCharacter.shortName} jest wassalizowany przez ${targetCharacter.shortName}.`,
        zh: `${sourceCharacter.shortName} 被 ${targetCharacter.shortName} 継続`
        
      },
      sentiment: "positive"
    };
  },
};
