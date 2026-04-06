/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "setEmotion",
  title: {
    en: "Set Emotion",
    ru: "Установить эмоцию",
    fr: "Définir l'émotion",
    de: "Emotion setzen",
    es: "Establecer emoción",
    ja: "感情を設定",
    ko: "감정 설정",
    pl: "Ustaw emocję",
    zh: "设置情绪"
  },
  function: ({ gameData }) => ({
    name: 'set_emotion',
    description: 'Switch the emotion state of a character.',
    parameters: {
      type: 'object',
      properties: {
        state: {
          type: 'string',
          description: 'Emotion state to set.',
          enum: ['happy', 'sad', 'angry', 'worry', 'neutral', 'pain'],
        },
      },
      required: ['state'],
      additionalProperties: false,
    },
  }),

  check: ({ gameData }) => {
    const allIds = Array.from(gameData.characters.keys());
    return {
      canExecute: true,
      validSourceCharacterIds: allIds,
    };
  },

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   * @param {Function} params.runGameEffect
   * @param {Record<string, number|string|boolean|null>} params.args
   * @param {string} params.lang
   */
  run: ({ sourceCharacter, args }) => {
    const state = typeof args?.state === 'string' ? args.state : 'neutral';

    return {
      message: {
        en: `${sourceCharacter.shortName}: emotion → ${state}`,
        ru: `${sourceCharacter.shortName}: эмоция → ${state}`,
        fr: `${sourceCharacter.shortName}: émotion → ${state}`,
        de: `${sourceCharacter.shortName}: Emotion → ${state}`,
        es: `${sourceCharacter.shortName}: emoción → ${state}`,
        ja: `${sourceCharacter.shortName}: 感情 → ${state}`,
        ko: `${sourceCharacter.shortName}: 감정 → ${state}`,
        pl: `${sourceCharacter.shortName}: emocja → ${state}`,
        zh: `${sourceCharacter.shortName}: 情绪 → ${state}`
      },
      sentiment: 'neutral',
      messageType: 'badge'
    };
  },
};
