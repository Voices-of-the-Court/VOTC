/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "intercourse",
  title: {
    en: "Intercourse",
    ru: "Половой акт",
    fr: "Rapport sexuel",
    de: "Geschlechtsverkehr",
    es: "Relación sexual",
    ja: "性交",
    ko: "성관계",
    pl: "Stosunek",
    zh: "性交"
  },
  function: ({ gameData }) => ({
    name: 'intercourse',
    description: 'Trigger when two characters had and finished an intercourse.',
    parameters: {
      type: 'object',
      properties: {
        targetCharacterId: {
          type: 'number',
          description: 'ID of the other character involved in the intercourse.',
        },
        narration: {
          type: 'string',
          description: 'Narrate in detail how the intercourse happens. Third person, 1-2 sentences, present tense.',
        },
        can_result_with_baby: {
          type: 'boolean',
          description: 'Whether the intercourse can result in a baby.',
        },
      },
      required: ['targetCharacterId', 'narration', 'can_result_with_baby'],
      additionalProperties: false,
    },
  }),

  check: ({ gameData }) => {
    const allIds = Array.from(gameData.characters.keys());
    return {
      canExecute: true,
      validSourceCharacterIds: allIds,
      validTargetCharacterIds: allIds,
    };
  },

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   * @param {Character} params.targetCharacter
   * @param {Function} params.runGameEffect
   * @param {Record<string, number|string|boolean|null>} params.args
   * @param {string} params.lang
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
        sentiment: 'negative',
        messageType: 'badge'
      };
    }

    const narration = typeof args?.narration === 'string' ? args.narration : '';

    return {
      title: {
        en: `${sourceCharacter.shortName} lays with ${targetCharacter.shortName}`,
        ru: `${sourceCharacter.shortName} возлёг с ${targetCharacter.shortName}`,
        fr: `${sourceCharacter.shortName} couche avec ${targetCharacter.shortName}`,
        de: `${sourceCharacter.shortName} liegt bei ${targetCharacter.shortName}`,
        es: `${sourceCharacter.shortName} yace con ${targetCharacter.shortName}`,
        ja: `${sourceCharacter.shortName}は${targetCharacter.shortName}と共寝した`,
        ko: `${sourceCharacter.shortName}이(가) ${targetCharacter.shortName}과(와) 동침했습니다`,
        pl: `${sourceCharacter.shortName} kładzie się z ${targetCharacter.shortName}`,
        zh: `${sourceCharacter.shortName}与${targetCharacter.shortName}同寝`
      },
      message: narration || {
        en: `${sourceCharacter.shortName} lays with ${targetCharacter.shortName}`,
        ru: `${sourceCharacter.shortName} возлёг с ${targetCharacter.shortName}`,
        fr: `${sourceCharacter.shortName} couche avec ${targetCharacter.shortName}`,
        de: `${sourceCharacter.shortName} liegt bei ${targetCharacter.shortName}`,
        es: `${sourceCharacter.shortName} yace con ${targetCharacter.shortName}`,
        ja: `${sourceCharacter.shortName}は${targetCharacter.shortName}と共寝した`,
        ko: `${sourceCharacter.shortName}이(가) ${targetCharacter.shortName}과(와) 동침했습니다`,
        pl: `${sourceCharacter.shortName} kładzie się z ${targetCharacter.shortName}`,
        zh: `${sourceCharacter.shortName}与${targetCharacter.shortName}同寝`
      },
      sentiment: 'positive',
      messageType: 'narration'
    };
  },
};
