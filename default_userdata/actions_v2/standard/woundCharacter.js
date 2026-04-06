/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

const WOUND_TRAITS = {
  wounded_1: {
    en: "Wounded", ru: "Ранение", fr: "Blessé", de: "Verwundet",
    es: "Herido", ja: "負傷", ko: "부상", pl: "Postać ranna", zh: "受伤"
  },
  wounded_2: {
    en: "Severely Injured", ru: "Серьезное ранение", fr: "Blessé gravement", de: "Schwer verletzt",
    es: "Gravemente herido", ja: "重傷", ko: "극심한 부상", pl: "Postać ciężko ranna", zh: "身受重伤"
  },
  wounded_3: {
    en: "Brutally Mauled", ru: "Жестокие увечья", fr: "Lacéré sauvagement", de: "Übel zugerichtet",
    es: "Brutalmente vapuleado", ja: "致命傷", ko: "무참한 부상", pl: "Postać brutalnie okaleczona", zh: "严重撕裂"
  },
  maimed: {
    en: "Maimed", ru: "Серьезное увечье", fr: "Mutilé", de: "Verstümmelt",
    es: "Mutilado", ja: "不具", ko: "불구자", pl: "Postać okaleczona", zh: "残废"
  }
};

const TIER_TO_TRAIT = {
  'Wounded': 'wounded_1',
  'Severely Injured': 'wounded_2',
  'Brutally Mauled': 'wounded_3'
};

module.exports = {
  signature: "woundCharacter",
  title: {
    en: "Wound Character",
    ru: "Ранить персонажа",
    fr: "Blesser le personnage",
    de: "Charakter verwunden",
    es: "Herir al personaje",
    ja: "キャラクターを負傷させる",
    ko: "캐릭터 부상",
    pl: "Zranić postać",
    zh: "伤害角色"
  },
  function: ({ gameData }) => ({
    name: 'wound_character',
    description: `Use when one of the characters is injured, or is reasonably likely to get injured.`,
    parameters: {
      type: 'object',
      properties: {
        targetCharacterId: {
          type: 'number',
          description: 'ID of the character being wounded.',
        },
        tier: {
          type: 'string',
          description: 'Wound severity tier to apply.',
          enum: ['Wounded', 'Severely Injured', 'Brutally Mauled'],
        },
        chance_of_happening: {
          type: 'number',
          description: 'Chance of the wound happening, from 0 to 100.',
          minimum: 0,
          maximum: 100,
        },
        narration_if_happens: {
          type: 'string',
          description: 'Narrate in detail how the wound happens. Third person, 1-2 sentences, present tense.',
        },
        narration_if_not_happens: {
          type: 'string',
          description: 'Narrate in detail how the wound is avoided. Third person, 1-2 sentences, present tense.',
        },
      },
      required: ['targetCharacterId', 'tier', 'chance_of_happening', 'narration_if_happens', 'narration_if_not_happens'],
      additionalProperties: false,
    },
  }),

  check: ({ gameData }) => {
    const allIds = Array.from(gameData.characters.keys());
    return {
      canExecute: true,
      validSourceCharacterIds: allIds,
      validTargetCharacterIds: allIds,
    };
  },

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   * @param {Character} params.targetCharacter
   * @param {Function} params.runGameEffect
   * @param {Record<string, number|string|boolean|null>} params.args
   * @param {string} params.lang
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args, lang = "en" }) => {
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
        messageType: 'narration'
      };
    }

    const tier = typeof args?.tier === 'string' ? args.tier : 'Wounded';
    const chance = typeof args?.chance_of_happening === 'number' ? Math.max(0, Math.min(100, args.chance_of_happening)) : 0;
    const narrationIfHappens = typeof args?.narration_if_happens === 'string' ? args.narration_if_happens : '';
    const narrationIfNotHappens = typeof args?.narration_if_not_happens === 'string' ? args.narration_if_not_happens : '';

    const randomRoll = Math.random() * 100;

    if (randomRoll > chance) {
      return {
        title: `${targetCharacter.shortName} avoids injury`,
        message: narrationIfNotHappens || {
          en: `${targetCharacter.shortName} avoids the wound`,
          ru: `${targetCharacter.shortName} избежал ранения`,
          fr: `${targetCharacter.shortName} évite la blessure`,
          de: `${targetCharacter.shortName} vermeidet die Verwundung`,
          es: `${targetCharacter.shortName} evita la herida`,
          ja: `${targetCharacter.shortName}は負傷を回避しました`,
          ko: `${targetCharacter.shortName}은(는) 부상을 피했습니다`,
          pl: `${targetCharacter.shortName} uniknął rany`,
          zh: `${targetCharacter.shortName}避免了受伤`
        },
        sentiment: 'neutral',
        messageType: 'narration'
      };
    }

    // Wound happens — apply the trait
    const traitKey = TIER_TO_TRAIT[tier] || 'wounded_1';
    const getTraitName = (key) => WOUND_TRAITS[key]?.[lang] || WOUND_TRAITS[key]?.en || key;

    const traitWounded1 = getTraitName('wounded_1');
    const traitWounded2 = getTraitName('wounded_2');
    const traitWounded3 = getTraitName('wounded_3');
    const traitMaimed = getTraitName('maimed');

    // Apply wound progression based on existing traits and requested tier
    if (traitKey === 'wounded_3' || targetCharacter.hasTrait(traitWounded3)) {
      if (targetCharacter.hasTrait(traitWounded3) && Math.random() < 0.25) {
        runGameEffect(`
global_var:votc_action_target = {
    remove_trait = wounded_3
    add_trait = maimed
}`);
        try {
          targetCharacter.removeTrait(traitWounded3);
          targetCharacter.addTrait({ category: "health", name: traitMaimed, desc: `${targetCharacter.shortName} is maimed` });
        } catch (e) {}
      } else if (!targetCharacter.hasTrait(traitWounded3)) {
        runGameEffect(`
global_var:votc_action_target = {
    remove_trait = wounded_2
    remove_trait = wounded_1
    add_trait = wounded_3
}`);
        try {
          targetCharacter.removeTrait(traitWounded2);
          targetCharacter.removeTrait(traitWounded1);
          targetCharacter.addTrait({ category: "health", name: traitWounded3, desc: `${targetCharacter.shortName} is brutally mauled` });
        } catch (e) {}
      }
    } else if (traitKey === 'wounded_2' || targetCharacter.hasTrait(traitWounded2)) {
      if (targetCharacter.hasTrait(traitWounded2) && Math.random() < 0.40) {
        runGameEffect(`
global_var:votc_action_target = {
    remove_trait = wounded_2
    add_trait = wounded_3
}`);
        try {
          targetCharacter.removeTrait(traitWounded2);
          targetCharacter.addTrait({ category: "health", name: traitWounded3, desc: `${targetCharacter.shortName} is brutally mauled` });
        } catch (e) {}
      } else if (!targetCharacter.hasTrait(traitWounded2)) {
        runGameEffect(`
global_var:votc_action_target = {
    remove_trait = wounded_1
    add_trait = wounded_2
}`);
        try {
          targetCharacter.removeTrait(traitWounded1);
          targetCharacter.addTrait({ category: "health", name: traitWounded2, desc: `${targetCharacter.shortName} is severely injured` });
        } catch (e) {}
      }
    } else if (targetCharacter.hasTrait(traitWounded1)) {
      runGameEffect(`
global_var:votc_action_target = {
    remove_trait = wounded_1
    add_trait = wounded_2
}`);
      try {
        targetCharacter.removeTrait(traitWounded1);
        targetCharacter.addTrait({ category: "health", name: traitWounded2, desc: `${targetCharacter.shortName} is severely injured` });
      } catch (e) {}
    } else {
      runGameEffect(`
global_var:votc_action_target = {
    add_trait = ${traitKey}
}`);
      try {
        targetCharacter.addTrait({ category: "health", name: getTraitName(traitKey), desc: `${targetCharacter.shortName} is ${tier.toLowerCase()}` });
      } catch (e) {}
    }

    return {
      title: `${targetCharacter.shortName} is ${tier.toLowerCase()}`,
      message: narrationIfHappens || {
        en: `${targetCharacter.shortName} is ${tier.toLowerCase()}`,
        ru: `${targetCharacter.shortName} ${tier === 'Wounded' ? 'ранен' : tier === 'Severely Injured' ? 'тяжело ранен' : 'жестоко изувечен'}`,
        fr: `${targetCharacter.shortName} est ${tier === 'Wounded' ? 'blessé' : tier === 'Severely Injured' ? 'gravement blessé' : 'brutalement lacéré'}`,
        de: `${targetCharacter.shortName} ist ${tier === 'Wounded' ? 'verwundet' : tier === 'Severely Injured' ? 'schwer verletzt' : 'übel zugerichtet'}`,
        es: `${targetCharacter.shortName} está ${tier === 'Wounded' ? 'herido' : tier === 'Severely Injured' ? 'gravemente herido' : 'brutalmente vapuleado'}`,
        ja: `${targetCharacter.shortName}は${tier === 'Wounded' ? '負傷' : tier === 'Severely Injured' ? '重傷' : '致命傷'}を負いました`,
        ko: `${targetCharacter.shortName}은(는) ${tier === 'Wounded' ? '부상' : tier === 'Severely Injured' ? '중상' : '무참한 부상'}을 입었습니다`,
        pl: `${targetCharacter.shortName} jest ${tier === 'Wounded' ? 'ranny' : tier === 'Severely Injured' ? 'ciężko ranny' : 'brutalnie okaleczony'}`,
        zh: `${targetCharacter.shortName}${tier === 'Wounded' ? '受伤了' : tier === 'Severely Injured' ? '身受重伤' : '被严重撕裂'}`
      },
      sentiment: 'negative',
      messageType: 'narration'
    };
  },
};