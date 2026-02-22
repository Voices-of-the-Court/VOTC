/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

// All localized strings for best friend relation
const BEST_FRIEND_STRINGS = ["Best Friend", "Meilleur ami", "Bester Freund", "親友", "단짝 친구", "Najlepszy przyjaciel", "Лучший друг", "至交", "Mejor amigo"];
// Friend strings (can progress from friend to best friend)
const FRIEND_STRINGS = ["Friend", "Ami", "Freund", "友人", "친구", "Przyjaciel", "Друг", "朋友", "Amigo"];

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

function getLocalizedBestFriend(lang) {
  const map = {
    en: "Best Friend", fr: "Meilleur ami", de: "Bester Freund", ja: "親友", ko: "단짝 친구",
    pl: "Najlepszy przyjaciel", ru: "Лучший друг", zh: "至交", es: "Mejor amigo"
  };
  return map[lang] || map.en;
}

module.exports = {
  signature: "becomeBestFriendsWith",
  title: {
    en: "Become Best Friends",
    ru: "Стать лучшими друзьями",
    fr: "Devenir meilleurs amis",
    de: "Beste Freunde werden",
    es: "Convertirse en mejores amigos",
    ja: "親友になる",
    ko: "최고의 친구가 되다",
    pl: "Zostać najlepszymi przyjaciółmi",
    zh: "成为挚友"
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "reason",
      type: "string",
      description: `The reason (event) that made ${sourceCharacter.shortName} and the target become best friends (in past tense).`,
      required: false
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when a strong and close friendship forms between ${sourceCharacter.shortName} and the target character. This creates a mutual best friend relationship.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => {
      if (id === sourceCharacter.id) return false;
      // Cannot become best friend if already best friend
      if (hasRelation(sourceCharacter, id, BEST_FRIEND_STRINGS)) return false;
      // Must be friend first (progression requirement)
      if (!hasRelation(sourceCharacter, id, FRIEND_STRINGS)) return false;
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
      : "became_close_friends";

    runGameEffect(`
global_var:votc_action_source = {
    set_relation_best_friend = {
        reason = "${reason.replaceAll('"', '')}"
        target = global_var:votc_action_target
    }
}`);

    // Update game data model
    // Remove friend relation (upgrade to best friend)
    removeRelationFromBoth(sourceCharacter, targetCharacter, sourceCharacter.id, targetCharacter.id, FRIEND_STRINGS);
    
    // Add best friend relation
    const bestFriendString = getLocalizedBestFriend(lang);
    addRelationToBoth(sourceCharacter, targetCharacter, sourceCharacter.id, targetCharacter.id, bestFriendString);

    return {
      message: {
        en: `${sourceCharacter.shortName} and ${targetCharacter.shortName} became best friends`,
        ru: `${sourceCharacter.shortName} и ${targetCharacter.shortName} стали лучшими друзьями`,
        fr: `${sourceCharacter.shortName} et ${targetCharacter.shortName} sont devenus meilleurs amis`,
        de: `${sourceCharacter.shortName} und ${targetCharacter.shortName} wurden beste Freunde`,
        es: `${sourceCharacter.shortName} y ${targetCharacter.shortName} se convirtieron en mejores amigos`,
        ja: `${sourceCharacter.shortName}と${targetCharacter.shortName}は親友になりました`,
        ko: `${sourceCharacter.shortName}과(와) ${targetCharacter.shortName}은(는) 최고의 친구가 되었습니다`,
        pl: `${sourceCharacter.shortName} i ${targetCharacter.shortName} stali się najlepszymi przyjaciółmi`,
        zh: `${sourceCharacter.shortName}和${targetCharacter.shortName}成为了挚友`
      },
      sentiment: 'positive'
    };
  },
};
