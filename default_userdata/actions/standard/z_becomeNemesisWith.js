/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

// All localized strings for nemesis relation
const NEMESIS_STRINGS = ["Nemesis", "Ennemi juré", "Erzfeind", "宿敵", "천적", "Śmiertelny wróg", "Заклятый враг", "死敌", "Némesis"];
// Rival strings (can progress from rival to nemesis)
const RIVAL_STRINGS = ["Rival", "Rival", "Rivale", "好敵手", "경쟁자", "Rywal", "Соперник", "仇敌", "Rival"];

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

function getLocalizedNemesis(lang) {
  const map = {
    en: "Nemesis", fr: "Ennemi juré", de: "Erzfeind", ja: "宿敵", ko: "천적",
    pl: "Śmiertelny wróg", ru: "Заклятый враг", zh: "死敌", es: "Némesis"
  };
  return map[lang] || map.en;
}

module.exports = {
  signature: "becomeNemesisWith",
  title: {
    en: "Become Nemesis",
    ru: "Стать заклятыми врагами",
    fr: "Devenir némésis",
    de: "Erzfeind werden",
    es: "Convertirse en némesis",
    ja: "宿敵になる",
    ko: "숙적이 되다",
    pl: "Zostać wrogami",
    zh: "成为死敌"
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "reason",
      type: "string",
      description: `The reason (event) that made ${sourceCharacter.shortName} and the target become nemeses (in past tense).`,
      required: false
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} and the target character become sworn enemies or nemeses with utter contempt and hatred. This creates a mutual nemesis relationship.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => {
      if (id === sourceCharacter.id) return false;
      // Cannot become nemesis if already nemesis
      if (hasRelation(sourceCharacter, id, NEMESIS_STRINGS)) return false;
      // Must be rival first (progression requirement)
      if (!hasRelation(sourceCharacter, id, RIVAL_STRINGS)) return false;
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

    const reason = typeof args?.reason === "string" && args.reason.trim()
      ? args.reason.trim()
      : "became_nemeses";

    runGameEffect(`
global_var:votc_action_source = {
    set_relation_nemesis = {
        reason = "${reason.replaceAll('"', '')}"
        target = global_var:votc_action_target
    }
}`);

    // Update game data model
    // Remove rival relation (upgrade to nemesis)
    removeRelationFromBoth(sourceCharacter, targetCharacter, sourceCharacter.id, targetCharacter.id, RIVAL_STRINGS);
    
    // Add nemesis relation
    const nemesisString = getLocalizedNemesis(lang);
    addRelationToBoth(sourceCharacter, targetCharacter, sourceCharacter.id, targetCharacter.id, nemesisString);

    return {
      message: {
        en: `${sourceCharacter.shortName} and ${targetCharacter.shortName} became nemeses`,
        ru: `${sourceCharacter.shortName} и ${targetCharacter.shortName} стали заклятыми врагами`,
        fr: `${sourceCharacter.shortName} et ${targetCharacter.shortName} sont devenus némésis`,
        de: `${sourceCharacter.shortName} und ${targetCharacter.shortName} wurden Erzfeinde`,
        es: `${sourceCharacter.shortName} y ${targetCharacter.shortName} se convirtieron en némesis`,
        ja: `${sourceCharacter.shortName}と${targetCharacter.shortName}は宿敵になりました`,
        ko: `${sourceCharacter.shortName}과(와) ${targetCharacter.shortName}은(는) 숙적이 되었습니다`,
        pl: `${sourceCharacter.shortName} i ${targetCharacter.shortName} stali się wrogami`,
        zh: `${sourceCharacter.shortName}和${targetCharacter.shortName}成为了死敌`
      },
      sentiment: 'negative'
    };
  },
};