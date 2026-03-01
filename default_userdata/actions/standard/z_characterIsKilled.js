/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "characterIsKilled",
  title: {
    en: "Source Character Is Killed",
    ru: "Исходный персонаж убит",
    fr: "Le personnage source est tué",
    de: "Quellcharakter wird getötet",
    es: "El personaje fuente es asesinado",
    ja: "ソースキャラクターが殺される",
    ko: "출처 캐릭터가 살해됨",
    pl: "Postać źródłowa jest zabita",
    zh: "角色被杀害"
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
      description: `If true, ${gameData.playerName} is the one being killed`,
      required: false,
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ gameData, sourceCharacter }) =>
    `Execute ONLY when ${sourceCharacter.shortName} (id=${sourceCharacter.id}) is killed. Target must be the killer of the source.
    If isPlayerSource is true, the ${gameData.playerName} will be killed instead of ${sourceCharacter.shortName}.`,

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   * @param {GameData} params.gameData
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
   * @param {Character} params.sourceCharacter
   * @param {Character} params.targetCharacter
   * @param {Function} params.runGameEffect
   * @param {GameData} params.gameData
   * @param {Record<string, number|string|boolean|null>} params.args
   * @param {string} params.lang - Language code for i18n
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args, lang }) => {
    if (!targetCharacter) {
      return {
        message: {
          en: "Failed: No killer specified",
          ru: "Ошибка: Убийца не указан",
          fr: "Échec : Aucun meurtrier spécifié",
          de: "Fehler: Kein Mörder angegeben",
          es: "Error: No se especificó un asesino",
          ja: "失敗: 殺害者が指定されていません",
          ko: "실패: 살인자가 지정되지 않았습니다",
          pl: "Niepowodzenie: Nie określono zabójcy",
          zh: "失败: 未指定凶手"
        },
        sentiment: 'negative'
      };
    }

    const isPlayerSource = args && typeof args.isPlayerSource === "boolean" ? args.isPlayerSource : false;

    if (isPlayerSource) {
      runGameEffect(`
root = {
    death = {
        death_reason = death_murder
        killer = global_var:votc_action_target
    }
}`);

      return {
        message: {
          en: `${gameData.playerName} was killed by ${targetCharacter.shortName}`,
          ru: `${gameData.playerName} был убит ${targetCharacter.shortName}`,
          fr: `${gameData.playerName} a été tué par ${targetCharacter.shortName}`,
          de: `${gameData.playerName} wurde von ${targetCharacter.shortName} getötet`,
          es: `${gameData.playerName} fue asesinado por ${targetCharacter.shortName}`,
          ja: `${gameData.playerName}は${targetCharacter.shortName}に殺されました`,
          ko: `${gameData.playerName}은(는) ${targetCharacter.shortName}에 의해 살해되었습니다`,
          pl: `${gameData.playerName} został zabity przez ${targetCharacter.shortName}`,
          zh: `${gameData.playerName}被${targetCharacter.shortName}杀害了`
        },
        sentiment: 'negative'
      };
    } else {
      runGameEffect(`
global_var:votc_action_source = {
    death = {
        death_reason = death_murder
        killer = global_var:votc_action_target
    }
}`);

      return {
        message: {
          en: `${sourceCharacter.shortName} was killed by ${targetCharacter.shortName}`,
          ru: `${sourceCharacter.shortName} был убит ${targetCharacter.shortName}`,
          fr: `${sourceCharacter.shortName} a été tué par ${targetCharacter.shortName}`,
          de: `${sourceCharacter.shortName} wurde von ${targetCharacter.shortName} getötet`,
          es: `${sourceCharacter.shortName} fue asesinado por ${targetCharacter.shortName}`,
          ja: `${sourceCharacter.shortName}は${targetCharacter.shortName}に殺されました`,
          ko: `${sourceCharacter.shortName}은(는) ${targetCharacter.shortName}에 의해 살해되었습니다`,
          pl: `${sourceCharacter.shortName} został zabity przez ${targetCharacter.shortName}`,
          zh: `${sourceCharacter.shortName}被${targetCharacter.shortName}杀害了`
        },
        sentiment: 'negative'
      };
    }
  },
};
