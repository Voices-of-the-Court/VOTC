/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "becomeBloodBrothersWith",
  title: {
    en: "Become Blood Brothers",
    ru: "Стать побратимами",
    fr: "Devenir frères de sang",
    de: "Blutsbrüder werden",
    es: "Convertirse en hermanos de sangre",
    ja: "血の盟友になる",
    ko: "결의 형제가 되다",
    pl: "Zostać braćmi krwi",
    zh: "成为结拜兄弟"
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "reason",
      type: "string",
      description: `The reason (event) that made ${sourceCharacter.shortName} and the target become blood brothers (in past tense).`,
      required: false
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} and the target character swear an oath of blood kinship. This creates a mutual blood brother relationship.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // TODO: Add proper checks for existing relationships and opinion requirements
    // For now, allow execution with any valid target
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

    const reason = typeof args?.reason === "string" && args.reason.trim()
      ? args.reason.trim()
      : "became_blood_brothers";

    runGameEffect(`
global_var:votc_action_source = {
    set_relation_blood_brother = {
        reason = "${reason.replaceAll('"', '')}"
        target = global_var:votc_action_target
    }
}`);

    return {
      message: {
        en: `${sourceCharacter.shortName} and ${targetCharacter.shortName} became blood brothers`,
        ru: `${sourceCharacter.shortName} и ${targetCharacter.shortName} стали побратимами`,
        fr: `${sourceCharacter.shortName} et ${targetCharacter.shortName} sont devenus frères de sang`,
        de: `${sourceCharacter.shortName} und ${targetCharacter.shortName} wurden Blutsbrüder`,
        es: `${sourceCharacter.shortName} y ${targetCharacter.shortName} se convirtieron en hermanos de sangre`,
        ja: `${sourceCharacter.shortName}と${targetCharacter.shortName}は血の盟友になりました`,
        ko: `${sourceCharacter.shortName}과(와) ${targetCharacter.shortName}은(는) 결의 형제가 되었습니다`,
        pl: `${sourceCharacter.shortName} i ${targetCharacter.shortName} stali się braćmi krwi`,
        zh: `${sourceCharacter.shortName}和${targetCharacter.shortName}成为了结拜兄弟`
      },
      sentiment: 'positive'
    };
  },
};
