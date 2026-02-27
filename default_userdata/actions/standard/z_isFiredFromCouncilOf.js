/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

// [MODIFIED BY AI - AUH COMPATIBILITY]
// Note to original author: This file was modified to support the All Under Heaven (AUH) DLC's Administrative Government.
// The runGameEffect logic now checks if the target uses Celestial Empires (`tgp_has_access_to_ministry_trigger = yes`).
// If so, it uses `destroy_held_ministry_titles_effect` to remove them from power, otherwise it falls back to `fire_councillor`.
module.exports = {
  signature: "isFiredFromCouncilOf",
  title: {
    en: "Source Fired from Target's Council",
    ru: "Исходный персонаж уволен из совета цели",
    fr: "La source a été licenciée du conseil de la cible",
    de: "Quellcharakter aus dem Rat des Ziels entlassen",
    es: "La fuente fue despedida del consejo del objetivo",
    ja: "ソースがターゲットの評議会から解任",
    ko: "출처가 대상의 평의회에서 해고됨",
    pl: "Źródło zwolnione z rady celu",
    zh: "从目标的内阁被解职"
  },

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
    `Execute when ${sourceCharacter.shortName} is fired/dismissed/retired from the target character's council.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Can be fired from any character's council except own
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

    runGameEffect(`
global_var:votc_action_target = {
    save_scope_as = councillor_liege
    if = {
        limit = {
            tgp_has_access_to_ministry_trigger = yes
        }
        global_var:votc_action_source = {
            destroy_held_ministry_titles_effect = yes
        }
    }
    fire_councillor = global_var:votc_action_source 
}`);

    return {
      message: {
        en: `${sourceCharacter.shortName} is no longer a councillor of ${targetCharacter.shortName}`,
        ru: `${sourceCharacter.shortName} больше не является советником ${targetCharacter.shortName}`,
        fr: `${sourceCharacter.shortName} n'est plus conseiller de ${targetCharacter.shortName}`,
        de: `${sourceCharacter.shortName} ist nicht mehr Rat von ${targetCharacter.shortName}`,
        es: `${sourceCharacter.shortName} ya no es consejero de ${targetCharacter.shortName}`,
        ja: `${sourceCharacter.shortName}はもう${targetCharacter.shortName}の評議員ではありません`,
        ko: `${sourceCharacter.shortName}은(는) 더 이상 ${targetCharacter.shortName}의 평의원이 아닙니다`,
        pl: `${sourceCharacter.shortName} nie jest już doradcą ${targetCharacter.shortName}`,
        zh: `${sourceCharacter.shortName}不再是${targetCharacter.shortName}的内阁成员`
      },
      sentiment: 'negative'
    };
  },
};
