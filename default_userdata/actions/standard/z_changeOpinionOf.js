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

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "value",
      type: "number",
      description: `Opinion change value from -10 to 10. Positive values improve ${sourceCharacter.shortName}'s opinion of the target, negative values worsen it.`,
      required: true,
      min: -10,
      max: 10,
      step: 1
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName}'s opinion of the target character changes due to conversation or actions. Value range: -10 to 10. Positive = opinion improves, negative = opinion worsens.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
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
        sentiment: 'negative'
      };
    }

    let value = 0;
    const raw = args?.value;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      value = Math.max(-10, Math.min(10, Math.floor(raw)));
    } else {
      return {
        message: {
          en: `Failed: Invalid opinion value`,
          ru: `Ошибка: Неверное значение мнения`,
          fr: `Échec : Valeur d'opinion invalide`,
          de: `Fehler: Ungültiger Meinungswert`,
          es: `Error: Valor de opinión inválido`,
          ja: `失敗: 無効な意見の値`,
          ko: `실패: 잘못된 의견 값`,
          pl: `Niepowodzenie: Nieprawidłowa wartość opinii`,
          zh: `失败: 无效的意见值`
        },
        sentiment: 'negative'
      };
    }

    if (value === 0) {
      return {
        message: {
          en: `No opinion change (value was 0)`,
          ru: `Мнение не изменилось (значение было 0)`,
          fr: `Aucun changement d'opinion (la valeur était 0)`,
          de: `Keine Meinungsänderung (Wert war 0)`,
          es: `Sin cambio de opinión (el valor fue 0)`,
          ja: `意見の変更なし (値は0でした)`,
          ko: `의견 변경 없음 (값이 0이었습니다)`,
          pl: `Brak zmiany opinii (wartość wynosiła 0)`,
          zh: `无意见变化（值为0）`
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
      sentiment: sentiment
    };
  },
};
