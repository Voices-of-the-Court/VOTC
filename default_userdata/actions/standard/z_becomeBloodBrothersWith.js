/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

// All localized strings for blood brother relation
const BLOOD_BROTHER_STRINGS = ["Blood Brother", "Frère de sang", "Blutsbruder", "兄弟分", "의형제", "Brat krwi", "Побратим", "结义兄弟", "Hermano de sangre"];
// Hostile relations - blood brother replaces these
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

function getLocalizedBloodBrother(lang) {
  const map = {
    en: "Blood Brother", fr: "Frère de sang", de: "Blutsbruder", ja: "兄弟分", ko: "의형제",
    pl: "Brat krwi", ru: "Побратим", zh: "结义兄弟", es: "Hermano de sangre"
  };
  return map[lang] || map.en;
}

module.exports = {
  signature: "becomeBloodBrothersWith",
  title: {
    en: "Become Blood Brothers",
    ru: "Стать побратимами",
    fr: "Devenir frères de sang",
    de: "Blutsbrüder werden",
    es: "Convertirse en hermanos de sangre",
    ja: "血の盟友になる",
    ko: "결의 형제가 되다",
    pl: "Zostać braćmi krwi",
    zh: "成为结义兄弟"
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "reason",
      type: "string",
      description: `The reason (event) that made ${sourceCharacter.shortName} and the target become blood brothers (in past tense).`,
      required: false
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} and the target character swear an oath of blood kinship. This creates a mutual blood brother relationship.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => {
      if (id === sourceCharacter.id) return false;
      // Cannot become blood brother if already blood brother
      if (hasRelation(sourceCharacter, id, BLOOD_BROTHER_STRINGS)) return false;
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
      : "became_blood_brothers";

    runGameEffect(`
global_var:votc_action_source = {
    set_relation_blood_brother = {
        reason = "${reason.replaceAll('"', '')}"
        target = global_var:votc_action_target
    }
}`);

    // Update game data model
    // Remove hostile relations (rival/nemesis) if present - blood brother replaces these
    removeRelationFromBoth(sourceCharacter, targetCharacter, sourceCharacter.id, targetCharacter.id, RIVAL_STRINGS);
    removeRelationFromBoth(sourceCharacter, targetCharacter, sourceCharacter.id, targetCharacter.id, NEMESIS_STRINGS);
    
    // Add blood brother relation
    const bloodBrotherString = getLocalizedBloodBrother(lang);
    addRelationToBoth(sourceCharacter, targetCharacter, sourceCharacter.id, targetCharacter.id, bloodBrotherString);

    return {
      message: {
        en: `${sourceCharacter.shortName} and ${targetCharacter.shortName} became blood brothers`,
        ru: `${sourceCharacter.shortName} и ${targetCharacter.shortName} стали побратимами`,
        fr: `${sourceCharacter.shortName} et ${targetCharacter.shortName} sont devenus frères de sang`,
        de: `${sourceCharacter.shortName} und ${targetCharacter.shortName} wurden Blutsbrüder`,
        es: `${sourceCharacter.shortName} y ${targetCharacter.shortName} se convirtieron en hermanos de sangre`,
        ja: `${sourceCharacter.shortName}と${targetCharacter.shortName}は血の盟友になりました`,
        ko: `${sourceCharacter.shortName}과(와) ${targetCharacter.shortName}은(는) 결의 형제가 되었습니다`,
        pl: `${sourceCharacter.shortName} i ${targetCharacter.shortName} stali się braćmi krwi`,
        zh: `${sourceCharacter.shortName}和${targetCharacter.shortName}成为了结义兄弟`
      },
      sentiment: 'positive'
    };
  },
};
