/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

// All localized strings for lover relation
const LOVER_STRINGS = ["Lover", "Amant", "Affäre", "恋人", "연인", "Kochanek", "Любовник/любовница", "情人", "Amante"];
// Soulmate strings (higher level - if soulmate, can't become lover again)
const SOULMATE_STRINGS = ["Soulmate", "Âme sœur", "Seelengefährte", "運命の人", "천생연분", "Bratnia dusza", "Родственная душа", "灵魂伴侣", "Alma gemela"];

function hasRelation(character, targetId, relationStrings) {
  const entry = character.relationsToCharacters?.find(r => r.id === targetId);
  if (!entry) return false;
  const lowerStrings = relationStrings.map(s => s.toLowerCase());
  return entry.relations.some(rel => lowerStrings.includes(rel.toLowerCase()));
}

function addRelationToBoth(sourceChar, targetChar, sourceId, targetId, relationString) {
  let sourceEntry = sourceChar.relationsToCharacters?.find(r => r.id === targetId);
  if (!sourceEntry) {
    sourceEntry = { id: targetId, relations: [] };
    sourceChar.relationsToCharacters.push(sourceEntry);
  }
  if (!sourceEntry.relations.includes(relationString)) {
    sourceEntry.relations.push(relationString);
  }
  
  let targetEntry = targetChar.relationsToCharacters?.find(r => r.id === sourceId);
  if (!targetEntry) {
    targetEntry = { id: sourceId, relations: [] };
    targetChar.relationsToCharacters.push(targetEntry);
  }
  if (!targetEntry.relations.includes(relationString)) {
    targetEntry.relations.push(relationString);
  }
}

function getLocalizedLover(lang) {
  const map = {
    en: "Lover", fr: "Amant", de: "Affäre", ja: "恋人", ko: "연인",
    pl: "Kochanek", ru: "Любовник/любовница", zh: "情人", es: "Amante"
  };
  return map[lang] || map.en;
}

module.exports = {
  signature: "becomeLoversWith",
  title: {
    en: "Become Lovers",
    ru: "Стать любовниками",
    fr: "Devenir amants",
    de: "Liebhaber werden",
    es: "Convertirse en amantes",
    ja: "恋人になる",
    ko: "연인이 되다",
    pl: "Zostać kochankami",
    zh: "成为情人"
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "reason",
      type: "string",
      description: `The reason (event) that made ${sourceCharacter.shortName} and the target become lovers (in past tense).`,
      required: false
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} and the target character become lovers through ongoing amorous and sexual association. This creates a mutual lover relationship.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => {
      if (id === sourceCharacter.id) return false;
      // Cannot become lover if already lover
      if (hasRelation(sourceCharacter, id, LOVER_STRINGS)) return false;
      // Cannot become lover if already soulmate (higher level)
      if (hasRelation(sourceCharacter, id, SOULMATE_STRINGS)) return false;
      return true;
    });
    return {
      canExecute: validTargets.length > 0,
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
   * @param {boolean} params.dryRun - If true, only preview without executing
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args, lang, dryRun }) => {
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

    // Dry run - return preview without executing
    if (dryRun) {
      return {
        message: {
          en: `${sourceCharacter.shortName} and ${targetCharacter.shortName} will become lovers`,
          ru: `${sourceCharacter.shortName} и ${targetCharacter.shortName} станут любовниками`,
          fr: `${sourceCharacter.shortName} et ${targetCharacter.shortName} deviendront amants`,
          de: `${sourceCharacter.shortName} und ${targetCharacter.shortName} werden Liebhaber`,
          es: `${sourceCharacter.shortName} y ${targetCharacter.shortName} se convertirán en amantes`,
          ja: `${sourceCharacter.shortName}と${targetCharacter.shortName}は恋人になります`,
          ko: `${sourceCharacter.shortName}과(와) ${targetCharacter.shortName}은(는) 연인이 됩니다`,
          pl: `${sourceCharacter.shortName} i ${targetCharacter.shortName} staną się kochankami`,
          zh: `${sourceCharacter.shortName}和${targetCharacter.shortName}将成为情人`
        },
        sentiment: 'positive'
      };
    }

    const reason = typeof args?.reason === "string" && args.reason.trim()
      ? args.reason.trim()
      : "became_lovers";

    runGameEffect(`
global_var:votc_action_source = {
    set_relation_lover = {
        reason = "${reason.replaceAll('"', '')}"
        target = global_var:votc_action_target
    }
}`);

    // Update game data model
    // Add lover relation
    const loverString = getLocalizedLover(lang);
    addRelationToBoth(sourceCharacter, targetCharacter, sourceCharacter.id, targetCharacter.id, loverString);

    return {
      message: {
        en: `${sourceCharacter.shortName} and ${targetCharacter.shortName} became lovers`,
        ru: `${sourceCharacter.shortName} и ${targetCharacter.shortName} стали любовниками`,
        fr: `${sourceCharacter.shortName} et ${targetCharacter.shortName} sont devenus amants`,
        de: `${sourceCharacter.shortName} und ${targetCharacter.shortName} wurden Liebhaber`,
        es: `${sourceCharacter.shortName} y ${targetCharacter.shortName} se convirtieron en amantes`,
        ja: `${sourceCharacter.shortName}と${targetCharacter.shortName}は恋人になりました`,
        ko: `${sourceCharacter.shortName}과(와) ${targetCharacter.shortName}은(는) 연인이 되었습니다`,
        pl: `${sourceCharacter.shortName} i ${targetCharacter.shortName} stali się kochankami`,
        zh: `${sourceCharacter.shortName}和${targetCharacter.shortName}成为了情人`
      },
      sentiment: 'positive'
    };
  },
};
