/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "becomeRivalsWith",
  title: {
    en: "Become Rivals",
    ru: "Стать соперниками",
    fr: "Devenir rivaux",
    de: "Rivalen werden",
    es: "Convertirse en rivales",
    ja: "ライバルになる",
    ko: "라이벌이 되다",
    pl: "Zostać rywalami",
    zh: "成为对手"
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "reason",
      type: "string",
      description: `The reason (event) that made ${sourceCharacter.shortName} and the target become rivals (in past tense).`,
      required: false
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} and the target character become fierce rivals with each other. This creates a mutual rival relationship.`,

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
      : "became_rivals";

    runGameEffect(`
global_var:votc_action_source = {
    set_relation_rival = {
        reason = ${reason}
        target = global_var:votc_action_target
    }
}`);

    return {
      message: {
        en: `${sourceCharacter.shortName} and ${targetCharacter.shortName} became rivals`,
        ru: `${sourceCharacter.shortName} и ${targetCharacter.shortName} стали соперниками`,
        fr: `${sourceCharacter.shortName} et ${targetCharacter.shortName} sont devenus rivaux`,
        de: `${sourceCharacter.shortName} und ${targetCharacter.shortName} wurden Rivalen`,
        es: `${sourceCharacter.shortName} y ${targetCharacter.shortName} se convirtieron en rivales`,
        ja: `${sourceCharacter.shortName}と${targetCharacter.shortName}はライバルになりました`,
        ko: `${sourceCharacter.shortName}과(와) ${targetCharacter.shortName}은(는) 라이벌이 되었습니다`,
        pl: `${sourceCharacter.shortName} i ${targetCharacter.shortName} stali się rywalami`,
        zh: `${sourceCharacter.shortName}和${targetCharacter.shortName}成为了对手`
      },
      sentiment: 'negative'
    };
  },
};
