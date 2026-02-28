/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "agreedToTruceWith",
  title: {
    en: "Mutual Truce",
    ru: "Взаимное перемирие",
    fr: "Trêve mutuelle",
    de: "Gegenseitiger Waffenstillstand",
    es: "Tregua mutua",
    ja: "相互休戦",
    ko: "상호 휴전",
    pl: "Wzajemne rozejm",
    zh: "相互停战"
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "years",
      type: "number",
      description: `Number of years the mutual truce lasts between ${sourceCharacter.shortName} and the target.`,
      required: false,
      min: 1,
      max: 50,
      step: 1
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} agrees to both ways truce with target character. Choose a target character and optionally specify 'years' (default 3).`,

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
   * @param {Record<string, number|string|null>} params.args
   * @param {string} params.lang - Language code for i18n
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args, lang }) => {
    if (!targetCharacter) {
      return {
        message: {
          en: "Failed: No target character specified for truce",
          ru: "Ошибка: Целевой персонаж для перемирия не указан",
          fr: "Échec : Aucun personnage cible spécifié pour la trêve",
          de: "Fehler: Kein Zielcharakter für den Waffenstillstand angegeben",
          es: "Error: No se especificó un personaje objetivo para la tregua",
          ja: "失敗: 休戦のターゲットキャラクターが指定されていません",
          ko: "실패: 휴전을 위한 대상 캐릭터가 지정되지 않았습니다",
          pl: "Niepowodzenie: Nie określono postaci docelowej dla rozejmu",
          zh: "失败: 未指定停战的目标角色"
        },
        sentiment: 'negative'
      };
    }

    let years = 3;
    const raw = args?.years;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      years = Math.max(1, Math.min(50, Math.floor(raw)));
    }

    runGameEffect(`
global_var:votc_action_source = {
    add_truce_both_ways = {
        character = global_var:votc_action_target
        years = ${years}
        override = yes
    }
}`);

    return {
      message: {
        en: `${sourceCharacter.shortName} and ${targetCharacter.shortName} agreed to a ${years}-year truce`,
        ru: `${sourceCharacter.shortName} и ${targetCharacter.shortName} согласились на ${years}-летнее перемирие`,
        fr: `${sourceCharacter.shortName} et ${targetCharacter.shortName} ont accepté une trêve de ${years} ans`,
        de: `${sourceCharacter.shortName} und ${targetCharacter.shortName} vereinbarten einen ${years}-jährigen Waffenstillstand`,
        es: `${sourceCharacter.shortName} y ${targetCharacter.shortName} acordaron una tregua de ${years} años`,
        ja: `${sourceCharacter.shortName}と${targetCharacter.shortName}は${years}年間の休戦に同意しました`,
        ko: `${sourceCharacter.shortName}과(와) ${targetCharacter.shortName}은(는) ${years}년간의 휴전에 동의했습니다`,
        pl: `${sourceCharacter.shortName} i ${targetCharacter.shortName} zgodzili się na ${years}-letni rozejm`,
        zh: `${sourceCharacter.shortName}和${targetCharacter.shortName}达成了${years}年的停战协议`
      },
      sentiment: 'positive'
    };
  },
};