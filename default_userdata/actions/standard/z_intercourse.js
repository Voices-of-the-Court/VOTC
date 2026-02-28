/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "intercourse",
  title: {
    en: "Sexual Intercourse Concluded",
    ru: "Сексуальный акт завершен",
    fr: "Rapport sexuel terminé",
    de: "Geschlechtsverkehr abgeschlossen",
    es: "Relación sexual concluida",
    ja: "性行為が完了",
    ko: "성관계가 완료됨",
    pl: "Stosunek seksualny zakończony",
    zh: "性行为结束"
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
    `Execute only after ${sourceCharacter.shortName} had sexual intercourse with the target. The act can be consensual or forced. Never execute if there's no finishing.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => id !== sourceCharacter.id);

    // Exclude targets with whom source had intercourse recently
    const recentlyWithIds = new Set();
    for (const t of sourceCharacter.traits) {
      if (t && typeof t.name === "string" && t.name.toLowerCase() === "hadsex" && typeof t.desc === "string") {
        const m = t.desc.match(/\[withId=(\d+)\]/);
        if (m) {
          recentlyWithIds.add(Number(m[1]));
        }
      }
    }

    const filtered = validTargets.filter((id) => !recentlyWithIds.has(id));
    if (filtered.length === 0) {
      return {
        canExecute: false,
        validTargetCharacterIds: [],
      };
    }
    return {
      canExecute: true,
      validTargetCharacterIds: filtered,
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
   * @param {boolean} params.dryRun - If true, only preview without executing
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args, lang, dryRun }) => {
    if (!targetCharacter) {
      return {
        message: {
          en: "Failed: No partner specified",
          ru: "Ошибка: Партнер не указан",
          fr: "Échec : Aucun partenaire spécifié",
          de: "Fehler: Kein Partner angegeben",
          es: "Error: No se especificó un compañero",
          ja: "失敗: パートナーが指定されていません",
          ko: "실패: 파트너가 지정되지 않았습니다",
          pl: "Niepowodzenie: Nie określono partnera",
          zh: "失败: 未指定伴侣"
        },
        sentiment: 'negative'
      };
    }

    // Dry run - return preview without executing
    if (dryRun) {
      return {
        message: {
          en: `${sourceCharacter.shortName} will have intercourse with ${targetCharacter.shortName}`,
          ru: `${sourceCharacter.shortName} займется сексом с ${targetCharacter.shortName}`,
          fr: `${sourceCharacter.shortName} aura des rapports sexuels avec ${targetCharacter.shortName}`,
          de: `${sourceCharacter.shortName} wird Geschlechtsverkehr mit ${targetCharacter.shortName} haben`,
          es: `${sourceCharacter.shortName} tendrá relaciones sexuales con ${targetCharacter.shortName}`,
          ja: `${sourceCharacter.shortName}は${targetCharacter.shortName}と性行為をします`,
          ko: `${sourceCharacter.shortName}은(는) ${targetCharacter.shortName}과(와) 성관계를 가질 것입니다`,
          pl: `${sourceCharacter.shortName} odbędzie stosunek seksualny z ${targetCharacter.shortName}`,
          zh: `${sourceCharacter.shortName}将与${targetCharacter.shortName}发生性行为`
        },
        sentiment: 'neutral'
      };
    }

    runGameEffect(`
global_var:votc_action_source = {
    had_sex_with_effect = {
        CHARACTER = global_var:votc_action_target
        PREGNANCY_CHANCE = pregnancy_chance
    }
}`);

    try {
      sourceCharacter.addTrait({
        category: "flag",
        name: "HadSex",
        desc: `${sourceCharacter.shortName} had sex recently with ${targetCharacter.shortName} [withId=${targetCharacter.id}]`,
      });
    } catch (e) {
    }

    return {
      message: {
        en: `${sourceCharacter.shortName} had intercourse with ${targetCharacter.shortName}`,
        ru: `${sourceCharacter.shortName} занимался сексом с ${targetCharacter.shortName}`,
        fr: `${sourceCharacter.shortName} a eu des rapports sexuels avec ${targetCharacter.shortName}`,
        de: `${sourceCharacter.shortName} hatte Geschlechtsverkehr mit ${targetCharacter.shortName}`,
        es: `${sourceCharacter.shortName} tuvo relaciones sexuales con ${targetCharacter.shortName}`,
        ja: `${sourceCharacter.shortName}は${targetCharacter.shortName}と性行為をしました`,
        ko: `${sourceCharacter.shortName}은(는) ${targetCharacter.shortName}과(와) 성관계를 가졌습니다`,
        pl: `${sourceCharacter.shortName} odbył stosunek seksualny z ${targetCharacter.shortName}`,
        zh: `${sourceCharacter.shortName}与${targetCharacter.shortName}发生了性行为`
      },
      sentiment: 'neutral'
    };
  },
};