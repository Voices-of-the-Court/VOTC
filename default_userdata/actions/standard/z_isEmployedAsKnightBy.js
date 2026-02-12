/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "isEmployedAsKnightBy",
  title: {
    en: "Source Joins Target's Court as Knight",
    ru: "Исходный персонаж вступает в двор цели как рыцарь",
    fr: "La source rejoint la cour de la cible en tant que chevalier",
    de: "Quellcharakter tritt dem Hof des Ziels als Ritter bei",
    es: "La fuente se une a la corte del objetivo como caballero",
    ja: "ソースがターゲットの宮廷に騎士として加入",
    ko: "출처가 대상의 궁정에 기사로 채용됨",
    pl: "Źródło dołącza do dworu celu jako rycerz",
    zh: "源角色以骑士身份加入目标的宫廷"
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
    `Execute when ${sourceCharacter.shortName} (who is not a ruler or knight) decides to join the target character's court as a knight.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Cannot employ a ruler as knight
    if (sourceCharacter.isLandedRuler) {
      return {
        canExecute: false,
        validTargetCharacterIds: [],
      };
    }

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
global_var:votc_action_source = {
    add_to_entourage_court_and_activity_effect = {
        CHAR_TO_ADD = global_var:votc_action_source
        NEW_COURT_OWNER = global_var:votc_action_target
    }
    set_knight_status = force
}`);

    return {
      message: {
        en: `${sourceCharacter.shortName} joined ${targetCharacter.shortName}'s court as a knight`,
        ru: `${sourceCharacter.shortName} вступил в двор ${targetCharacter.shortName} как рыцарь`,
        fr: `${sourceCharacter.shortName} a rejoint la cour de ${targetCharacter.shortName} en tant que chevalier`,
        de: `${sourceCharacter.shortName} ist dem Hof von ${targetCharacter.shortName} als Ritter beigetreten`,
        es: `${sourceCharacter.shortName} se unió a la corte de ${targetCharacter.shortName} como caballero`,
        ja: `${sourceCharacter.shortName}は${targetCharacter.shortName}の宮廷に騎士として加入しました`,
        ko: `${sourceCharacter.shortName}은(는) ${targetCharacter.shortName}의 궁정에 기사로 채용되었습니다`,
        pl: `${sourceCharacter.shortName} dołączył do dworu ${targetCharacter.shortName} jako rycerz`,
        zh: `${sourceCharacter.shortName}以骑士身份加入了${targetCharacter.shortName}的宫廷`
      },
      sentiment: 'positive'
    };
  },
};
