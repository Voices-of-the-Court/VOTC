/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

// All localized strings for friend relation
const FRIEND_STRINGS = ["Friend", "Ami", "Freund", "友人", "친구", "Przyjaciel", "Друг", "朋友", "Amigo"];
// Best friend strings (already at higher level)
const BEST_FRIEND_STRINGS = ["Best Friend", "Meilleur ami", "Bester Freund", "親友", "단짝 친구", "Najlepszy przyjaciel", "Лучший друг", "至交", "Mejor amigo"];
// Rival strings (can transition from rival to friend)
const RIVAL_STRINGS = ["Rival", "Rival", "Rivale", "好敵手", "경쟁자", "Rywal", "Соперник", "仇敌", "Rival"];
// Nemesis strings (hostile, but can still become friend - will remove nemesis)
const NEMESIS_STRINGS = ["Nemesis", "Ennemi juré", "Erzfeind", "宿敵", "천적", "Śmiertelny wróg", "Заклятый враг", "死敌", "Némesis"];

const ALL_STRINGS = [...FRIEND_STRINGS, ...BEST_FRIEND_STRINGS, ...RIVAL_STRINGS, ...NEMESIS_STRINGS].map(s => s.toLowerCase());

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

function getLocalizedFriend(lang) {
  const map = {
    en: "Friend", fr: "Ami", de: "Freund", ja: "友人", ko: "친구",
    pl: "Przyjaciel", ru: "Друг", zh: "朋友", es: "Amigo"
  };
  return map[lang] || map.en;
}

module.exports = {
  signature: "becomeFriendsWith",
  title: {
    en: "Become Friends",
    ru: "Стать друзьями",
    fr: "Devenir amis",
    de: "Freunde werden",
    es: "Convertirse en amigos",
    ja: "友達になる",
    ko: "친구가 되다",
    pl: "Zostać przyjaciółmi",
    zh: "成为朋友"
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "reason",
      type: "string",
      description: `The reason (event) that made ${sourceCharacter.shortName} and the target become friends (in past tense).`,
      required: false
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when a friendship forms between ${sourceCharacter.shortName} and the target character. This creates a mutual friend relationship.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => {
      if (id === sourceCharacter.id) return false;
      // Cannot become friend if already a friend
      if (hasRelation(sourceCharacter, id, FRIEND_STRINGS)) return false;
      // Cannot become friend if already best friend (higher level)
      if (hasRelation(sourceCharacter, id, BEST_FRIEND_STRINGS)) return false;
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
      : "became_friends";

    runGameEffect(`
global_var:votc_action_source = {
    set_relation_friend = {
        reason = "${reason.replaceAll('"', '')}"
        target = global_var:votc_action_target
    }
}`);

    // Update game data model
    // Remove hostile relations (rival/nemesis) if present
    removeRelationFromBoth(sourceCharacter, targetCharacter, sourceCharacter.id, targetCharacter.id, RIVAL_STRINGS);
    removeRelationFromBoth(sourceCharacter, targetCharacter, sourceCharacter.id, targetCharacter.id, NEMESIS_STRINGS);
    
    // Add friend relation
    const friendString = getLocalizedFriend(lang);
    addRelationToBoth(sourceCharacter, targetCharacter, sourceCharacter.id, targetCharacter.id, friendString);

    return {
      message: {
        en: `${sourceCharacter.shortName} and ${targetCharacter.shortName} became friends`,
        ru: `${sourceCharacter.shortName} и ${targetCharacter.shortName} стали друзьями`,
        fr: `${sourceCharacter.shortName} et ${targetCharacter.shortName} sont devenus amis`,
        de: `${sourceCharacter.shortName} und ${targetCharacter.shortName} wurden Freunde`,
        es: `${sourceCharacter.shortName} y ${targetCharacter.shortName} se convirtieron en amigos`,
        ja: `${sourceCharacter.shortName}と${targetCharacter.shortName}は友達になりました`,
        ko: `${sourceCharacter.shortName}과(와) ${targetCharacter.shortName}은(는) 친구가 되었습니다`,
        pl: `${sourceCharacter.shortName} i ${targetCharacter.shortName} stali się przyjaciółmi`,
        zh: `${sourceCharacter.shortName}和${targetCharacter.shortName}成为了朋友`
      },
      sentiment: 'positive'
    };
  },
};
