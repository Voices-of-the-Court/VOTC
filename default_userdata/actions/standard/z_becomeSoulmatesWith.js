/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

// All localized strings for soulmate relation
const SOULMATE_STRINGS = ["Soulmate", "Âme sœur", "Seelengefährte", "運命の人", "천생연분", "Bratnia dusza", "Родственная душа", "灵魂伴侣", "Alma gemela"];
// Lover strings (soulmate replaces lover)
const LOVER_STRINGS = ["Lover", "Amant", "Affäre", "恋人", "연인", "Kochanek", "Любовник/любовница", "情人", "Amante"];
// Hostile relations - cannot become soulmate if rival or nemesis
const RIVAL_STRINGS = ["Rival", "Rival", "Rivale", "好敵手", "경쟁자", "Rywal", "Соперник", "仇敌", "Rival"];
const NEMESIS_STRINGS = ["Nemesis", "Ennemi juré", "Erzfeind", "宿敵", "천적", "Śmiertelny wróg", "Заклятый враг", "死敌", "Némesis"];

function hasRelation(character, targetId, relationStrings) {
  const entry = character.relationsToCharacters?.find(r => r.id === targetId);
  if (!entry) return false;
  const lowerStrings = relationStrings.map(s => s.toLowerCase());
  return entry.relations.some(rel => lowerStrings.includes(rel.toLowerCase()));
}

function removeRelationFromBoth(sourceChar, targetChar, sourceId, targetId, relationStrings) {
  const lowerStrings = relationStrings.map(s => s.toLowerCase());
  
  const sourceEntry = sourceChar.relationsToCharacters?.find(r => r.id === targetId);
  if (sourceEntry) {
    sourceEntry.relations = sourceEntry.relations.filter(rel => !lowerStrings.includes(rel.toLowerCase()));
  }
  
  const targetEntry = targetChar.relationsToCharacters?.find(r => r.id === sourceId);
  if (targetEntry) {
    targetEntry.relations = targetEntry.relations.filter(rel => !lowerStrings.includes(rel.toLowerCase()));
  }
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

function getLocalizedSoulmate(lang) {
  const map = {
    en: "Soulmate", fr: "Âme sœur", de: "Seelengefährte", ja: "運命の人", ko: "천생연분",
    pl: "Bratnia dusza", ru: "Родственная душа", zh: "灵魂伴侣", es: "Alma gemela"
  };
  return map[lang] || map.en;
}

module.exports = {
  signature: "becomeSoulmatesWith",
  title: {
    en: "Become Soulmates",
    ru: "Стать душами-сородичами",
    fr: "Devenir âmes sœurs",
    de: "Seelenverwandte werden",
    es: "Convertirse en almas gemelas",
    ja: "ソウルメイトになる",
    ko: "소울메이트가 되다",
    pl: "Zostać bratnimi duszami",
    zh: "成为灵魂伴侣"
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "reason",
      type: "string",
      description: `The reason (event) that made ${sourceCharacter.shortName} and the target become soulmates (in past tense).`,
      required: false
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} and the target character become passionate soulmates with deep, profound, romantic love. This is a stronger bond than lovers, indicating a transcendent connection.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => {
      if (id === sourceCharacter.id) return false;
      // Cannot become soulmate if already soulmate
      if (hasRelation(sourceCharacter, id, SOULMATE_STRINGS)) return false;
      // Cannot become soulmate if rival or nemesis (hostile relations)
      if (hasRelation(sourceCharacter, id, RIVAL_STRINGS)) return false;
      if (hasRelation(sourceCharacter, id, NEMESIS_STRINGS)) return false;
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
          en: `${sourceCharacter.shortName} and ${targetCharacter.shortName} will become soulmates`,
          ru: `${sourceCharacter.shortName} и ${targetCharacter.shortName} станут душами-сородичами`,
          fr: `${sourceCharacter.shortName} et ${targetCharacter.shortName} deviendront âmes sœurs`,
          de: `${sourceCharacter.shortName} und ${targetCharacter.shortName} werden Seelenverwandte`,
          es: `${sourceCharacter.shortName} y ${targetCharacter.shortName} se convertirán en almas gemelas`,
          ja: `${sourceCharacter.shortName}と${targetCharacter.shortName}はソウルメイトになります`,
          ko: `${sourceCharacter.shortName}과(와) ${targetCharacter.shortName}은(는) 소울메이트가 됩니다`,
          pl: `${sourceCharacter.shortName} i ${targetCharacter.shortName} staną się bratnimi duszami`,
          zh: `${sourceCharacter.shortName}和${targetCharacter.shortName}将成为灵魂伴侣`
        },
        sentiment: 'positive'
      };
    }

    const reason = typeof args?.reason === "string" && args.reason.trim()
      ? args.reason.trim()
      : "became_soulmates";

    runGameEffect(`
global_var:votc_action_source = {
    set_relation_soulmate = {
        reason = "${reason.replaceAll('"', '')}"
        target = global_var:votc_action_target
    }
}`);

    // Update game data model
    // Remove lover relation if present (soulmate replaces lover)
    removeRelationFromBoth(sourceCharacter, targetCharacter, sourceCharacter.id, targetCharacter.id, LOVER_STRINGS);
    
    // Add soulmate relation
    const soulmateString = getLocalizedSoulmate(lang);
    addRelationToBoth(sourceCharacter, targetCharacter, sourceCharacter.id, targetCharacter.id, soulmateString);

    return {
      message: {
        en: `${sourceCharacter.shortName} and ${targetCharacter.shortName} became soulmates`,
        ru: `${sourceCharacter.shortName} и ${targetCharacter.shortName} стали душами-сородичами`,
        fr: `${sourceCharacter.shortName} et ${targetCharacter.shortName} sont devenus âmes sœurs`,
        de: `${sourceCharacter.shortName} und ${targetCharacter.shortName} wurden Seelenverwandte`,
        es: `${sourceCharacter.shortName} y ${targetCharacter.shortName} se convirtieron en almas gemelas`,
        ja: `${sourceCharacter.shortName}と${targetCharacter.shortName}はソウルメイトになりました`,
        ko: `${sourceCharacter.shortName}과(와) ${targetCharacter.shortName}은(는) 소울메이트가 되었습니다`,
        pl: `${sourceCharacter.shortName} i ${targetCharacter.shortName} stali się bratnimi duszami`,
        zh: `${sourceCharacter.shortName}和${targetCharacter.shortName}结为了灵魂伴侣`
      },
      sentiment: 'positive'
    };
  },
};
