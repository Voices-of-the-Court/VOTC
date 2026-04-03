/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "changeOpinionOf",
  title: {
    en: "Change Source's Opinion of Target",
    ru: "Изменить мнение источника о цели",
    fr: "Changer l'opinion de la source sur la cible",
    de: "Meinung der Quelle über das Ziel ändern",
    es: "Cambiar la opinión de la fuente sobre el objetivo",
    ja: "ソースのターゲットに対する意見を変更",
    ko: "출처의 대상에 대한 의견 변경",
    pl: "Zmień opinię źródła o celu",
    zh: "改变源角色对目标的看法"
  },
  function: ({ sourceCharacter }) => ({
        name: 'change_opinion',
        description: `trigger when target character says or does something that will change ${sourceCharacter.shortName}'s opinion of target character.`,
        parameters: {
            type: 'object',
            properties: {
                targetCharacterId: {
                    type: 'number',
                    description: 'ID of the target character whose opinion is changing.',
                },
                increase_opinion: {
                    type: 'number',
                    description: 'number of points to increase opinion by if target character says or does something that source character will like.',
                    minimum: 1,
                    maximum: 5,
                },
                decrease_opinion: {
                    type: 'number',
                    description: 'number of points to decrease opinion by if target character says or does something that source character will dislike.',
                    minimum: 1,
                    maximum: 5,
                },
            },
            required: [],
            additionalProperties: false,
        },
    }),
    check: ({ gameData, sourceCharacter }) => {
    // Can change opinion of any other character
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
        sentiment: 'negative',
        messageType: 'badge'
      };
    }

    const increase = typeof args?.increase_opinion === 'number' ? Math.max(0, Math.min(5, Math.floor(args.increase_opinion))) : 0;
    const decrease = typeof args?.decrease_opinion === 'number' ? Math.max(0, Math.min(5, Math.floor(args.decrease_opinion))) : 0;
    const value = increase - decrease;

    if (value === 0) {
      return {
        message: {
          en: `No opinion change`,
          ru: `Мнение не изменилось`,
          fr: `Aucun changement d'opinion`,
          de: `Keine Meinungsänderung`,
          es: `Sin cambio de opinión`,
          ja: `意見の変更なし`,
          ko: `의견 변경 없음`,
          pl: `Brak zmiany opinii`,
          zh: `无意见变化`
        },
        sentiment: 'neutral'
      };
    }

    runGameEffect(`
global_var:votc_action_source = {
    add_opinion = {
        target = global_var:votc_action_target
        modifier = conversation_opinion
        opinion = ${value}
    }
}`);

    const sentiment = value > 0 ? 'positive' : 'negative';
    const absValue = Math.abs(value);

    return {
      message: {
        en: `${sourceCharacter.shortName}'s opinion of ${targetCharacter.shortName} ${value > 0 ? 'improved' : 'worsened'} by ${absValue}`,
        ru: `Мнение ${sourceCharacter.shortName} о ${targetCharacter.shortName} ${value > 0 ? 'улучшилось' : 'ухудшилось'} на ${absValue}`,
        fr: `L'opinion de ${sourceCharacter.shortName} sur ${targetCharacter.shortName} s'est ${value > 0 ? 'améliorée' : 'détériorée'} de ${absValue}`,
        de: `${sourceCharacter.shortName}s Meinung über ${targetCharacter.shortName} hat sich um ${absValue} ${value > 0 ? 'verbessert' : 'verschlechtert'}`,
        es: `La opinión de ${sourceCharacter.shortName} sobre ${targetCharacter.shortName} ${value > 0 ? 'mejoró' : 'empeoró'} en ${absValue}`,
        ja: `${sourceCharacter.shortName}の${targetCharacter.shortName}に対する意見が${absValue}だけ${value > 0 ? '改善' : '悪化'}しました`,
        ko: `${sourceCharacter.shortName}의 ${targetCharacter.shortName}에 대한 의견이 ${absValue}만큼 ${value > 0 ? '개선' : '악화'}되었습니다`,
        pl: `Opinia ${sourceCharacter.shortName} o ${targetCharacter.shortName} ${value > 0 ? 'poprawiła się' : 'pogorszyła się'} o ${absValue}`,
        zh: `${sourceCharacter.shortName}对${targetCharacter.shortName}的看法${value > 0 ? '改善了' : '恶化了'}${absValue}`
      },
      sentiment: sentiment,
      messageType: 'badge'
    };
  },
};
