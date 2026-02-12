/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "becomeNemesisWith",
  title: {
    en: "Become Nemesis",
    ru: "Стать заклятыми врагами",
    fr: "Devenir némésis",
    de: "Erzfeind werden",
    es: "Convertirse en némesis",
    ja: "宿敵になる",
    ko: "숙적이 되다",
    pl: "Zostać wrogami",
    zh: "成为宿敌"
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "reason",
      type: "string",
      description: `The reason (event) that made ${sourceCharacter.shortName} and the target become nemeses (in past tense).`,
      required: false
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} and the target character become sworn enemies or nemeses with utter contempt and hatred. This creates a mutual nemesis relationship.`,

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
      : "became_nemeses";

    runGameEffect(`
global_var:votc_action_source = {
    set_relation_nemesis = {
        reason = ${reason}
        target = global_var:votc_action_target
    }
}`);

    return {
      message: {
        en: `${sourceCharacter.shortName} and ${targetCharacter.shortName} became nemeses`,
        ru: `${sourceCharacter.shortName} и ${targetCharacter.shortName} стали заклятыми врагами`,
        fr: `${sourceCharacter.shortName} et ${targetCharacter.shortName} sont devenus némésis`,
        de: `${sourceCharacter.shortName} und ${targetCharacter.shortName} wurden Erzfeinde`,
        es: `${sourceCharacter.shortName} y ${targetCharacter.shortName} se convirtieron en némesis`,
        ja: `${sourceCharacter.shortName}と${targetCharacter.shortName}は宿敵になりました`,
        ko: `${sourceCharacter.shortName}과(와) ${targetCharacter.shortName}은(는) 숙적이 되었습니다`,
        pl: `${sourceCharacter.shortName} i ${targetCharacter.shortName} stali się wrogami`,
        zh: `${sourceCharacter.shortName}和${targetCharacter.shortName}成为了宿敌`
      },
      sentiment: 'negative'
    };
  },
};
