/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

// All localized strings for rival relation
const RIVAL_STRINGS = ["Rival", "Rival", "Rivale", "好敵手", "경쟁자", "Rywal", "Соперник", "仇敌", "Rival"];
// Nemesis strings (already at higher level)
const NEMESIS_STRINGS = ["Nemesis", "Ennemi juré", "Erzfeind", "宿敵", "천적", "Śmiertelny wróg", "Заклятый враг", "死敌", "Némesis"];
// Friend strings (can transition from friend to rival)
const FRIEND_STRINGS = ["Friend", "Ami", "Freund", "友人", "친구", "Przyjaciel", "Друг", "朋友", "Amigo"];
// Best friend strings (can transition from best friend to rival)
const BEST_FRIEND_STRINGS = ["Best Friend", "Meilleur ami", "Bester Freund", "親友", "단짝 친구", "Najlepszy przyjaciel", "Лучший друг", "至交", "Mejor amigo"];

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

function getLocalizedRival(lang) {
  const map = {
    en: "Rival", fr: "Rival", de: "Rivale", ja: "好敵手", ko: "경쟁자",
    pl: "Rywal", ru: "Соперник", zh: "仇敌", es: "Rival"
  };
  return map[lang] || map.en;
}

module.exports = {
  signature: "becomeRivalsWith",
  title: {
    en: "Become Rivals",
    ru: "Стать соперниками",
    fr: "Devenir rivaux",
    de: "Rivalen werden",
    es: "Convertirse en rivales",
    ja: "ライバルになる",
    ko: "라이벌이 되다",
    pl: "Zostać rywalami",
    zh: "成为仇敌"
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "reason",
      type: "string",
      description: `The reason (event) that made ${sourceCharacter.shortName} and the target become rivals (in past tense).`,
      required: false
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} and the target character become fierce rivals with each other. This creates a mutual rival relationship.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => {
      if (id === sourceCharacter.id) return false;
      // Cannot become rival if already rival
      if (hasRelation(sourceCharacter, id, RIVAL_STRINGS)) return false;
      // Cannot become rival if already nemesis (higher level)
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
      : "became_rivals";

    runGameEffect(`
global_var:votc_action_source = {
    set_relation_rival = {
        reason = "${reason.replaceAll('"', '')}"
        target = global_var:votc_action_target
    }
}`);

    // Update game data model
    // Remove friendship relations (friend/best friend) if present
    removeRelationFromBoth(sourceCharacter, targetCharacter, sourceCharacter.id, targetCharacter.id, FRIEND_STRINGS);
    removeRelationFromBoth(sourceCharacter, targetCharacter, sourceCharacter.id, targetCharacter.id, BEST_FRIEND_STRINGS);
    
    // Add rival relation
    const rivalString = getLocalizedRival(lang);
    addRelationToBoth(sourceCharacter, targetCharacter, sourceCharacter.id, targetCharacter.id, rivalString);

    return {
      message: {
        en: `${sourceCharacter.shortName} and ${targetCharacter.shortName} became rivals`,
        ru: `${sourceCharacter.shortName} и ${targetCharacter.shortName} стали соперниками`,
        fr: `${sourceCharacter.shortName} et ${targetCharacter.shortName} sont devenus rivaux`,
        de: `${sourceCharacter.shortName} und ${targetCharacter.shortName} wurden Rivalen`,
        es: `${sourceCharacter.shortName} y ${targetCharacter.shortName} se convirtieron en rivales`,
        ja: `${sourceCharacter.shortName}と${targetCharacter.shortName}はライバルになりました`,
        ko: `${sourceCharacter.shortName}과(와) ${targetCharacter.shortName}은(는) 라이벌이 되었습니다`,
        pl: `${sourceCharacter.shortName} i ${targetCharacter.shortName} stali się rywalami`,
        zh: `${sourceCharacter.shortName}和${targetCharacter.shortName}成为了宿敌`
      },
      sentiment: 'negative'
    };
  },
};