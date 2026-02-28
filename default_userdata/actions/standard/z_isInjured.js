/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

// Localized trait names
const TRAIT_NAMES = {
  wounded_1: {
    en: "Wounded",
    de: "Verwundet",
    es: "Herido",
    fr: "Blessé",
    ja: "負傷",
    ko: "부상",
    pl: "Postać ranna",
    ru: "Ранение",
    zh: "受伤"
  },
  wounded_2: {
    en: "Severely Injured",
    de: "Schwer verletzt",
    es: "Gravemente herido",
    fr: "Blessé gravement",
    ja: "重傷",
    ko: "극심한 부상",
    pl: "Postać ciężko ranna",
    ru: "Серьезное ранение",
    zh: "身受重伤"
  },
  wounded_3: {
    en: "Brutally Mauled",
    de: "Übel zugerichtet",
    es: "Brutalmente vapuleado",
    fr: "Lacéré sauvagement",
    ja: "致命傷",
    ko: "무참한 부상",
    pl: "Postać brutalnie okaleczona",
    ru: "Жестокие увечья",
    zh: "严重撕裂"
  },
  one_eyed: {
    en: "One-Eyed",
    de: "Einäugig",
    es: "Tuerto",
    fr: "Borgne",
    ja: "隻眼",
    ko: "애꾸눈",
    pl: "Postać jednooka",
    ru: "Один глаз",
    zh: "独眼"
  },
  blind: {
    en: "Blind",
    de: "Blind",
    es: "Ciego",
    fr: "Aveugle",
    ja: "盲目",
    ko: "맹인",
    pl: "Postać niewidoma",
    ru: "Слепота",
    zh: "失明"
  },
  one_legged: {
    en: "One-Legged",
    de: "Einbeinig",
    es: "Cojo",
    fr: "Unijambiste",
    ja: "隻脚",
    ko: "외다리",
    pl: "Postać jednonoga",
    ru: "Одна нога",
    zh: "独腿"
  },
  disfigured: {
    en: "Disfigured",
    de: "Entstellt",
    es: "Desfigurado",
    fr: "Défiguré",
    ja: "醜い",
    ko: "흉측한",
    pl: "Postać oszpecona",
    ru: "Обезображенное лицо",
    zh: "毁容"
  },
  maimed: {
    en: "Maimed",
    de: "Verstümmelt",
    es: "Mutilado",
    fr: "Mutilé",
    ja: "不具",
    ko: "불구자",
    pl: "Postać okaleczona",
    ru: "Серьезное увечье",
    zh: "残废"
  },
  eunuch: {
    en: "Eunuch",
    de: "Eunuch",
    es: "Eunuco",
    fr: "Eunuque",
    ja: "去勢",
    ko: "고자",
    pl: "Postać wykastrowana",
    ru: "Евнух",
    zh: "阉人"
  },
  beardless_eunuch: {
    en: "Beardless Eunuch",
    de: "Bartloser Eunuch",
    es: "Eunuco imberbe",
    fr: "Eunuque imberbe",
    ja: "未成熟な宦官",
    ko: "수염 없는 환관",
    pl: "Bezbrody eunuch",
    ru: "Безбородый евнух",
    zh: "无须阉人"
  },
  lunatic_1: {
    en: "Lunatic",
    de: "Wahnsinnig",
    es: "Lunático",
    fr: "Lunatique",
    ja: "狂気",
    ko: "미치광이",
    pl: "Postać szalona",
    ru: "Помешательство",
    zh: "精神错乱"
  },
  possessed_1: {
    en: "Possessed",
    de: "Besessen",
    es: "Poseído",
    fr: "Possédé",
    ja: "悪魔憑き",
    ko: "빙의됨",
    pl: "Postać opętana",
    ru: "Одержимость",
    zh: "附身"
  }
};

// Localized gender words for checking
const GENDER_WORDS = {
  en: { he: "he", she: "she" },
  ru: { he: "он", she: "она" },
  fr: { he: "il", she: "elle" },
  de: { he: "er", she: "sie" },
  es: { he: "él", she: "ella" },
  ja: { he: "彼", she: "彼女" },
  ko: { he: "그", she: "그녀" },
  pl: { he: "on", she: "ona" },
  zh: { he: "他", she: "她" }
};

module.exports = {
  signature: "isInjured",
  title: {
    en: "Target Is Injured",
    ru: "Цель ранена",
    fr: "La cible est blessée",
    de: "Ziel ist verletzt",
    es: "El objetivo está herido",
    ja: "ターゲットが負傷",
    ko: "대상이 부상함",
    pl: "Cel jest ranny",
    zh: "目标受伤"
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "injuryType",
      type: "enum",
      description: `Type of injury inflicted on the target character. Options: wounded (simple injury), remove_eye, blind, cut_leg, cut_balls (castration), disfigured.`,
      required: true,
      options: ["wounded", "remove_eye", "blind", "cut_leg", "cut_balls", "disfigured"]
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when the target character is injured in various ways. The injury happens generally, not from a specific source. Choose the target and injury type.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Allow targeting any character including source
    const allIds = Array.from(gameData.characters.keys());
    return {
      canExecute: true,
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
   * @param {string} params.lang - Language code for i18n
   * @param {boolean} params.dryRun - If true, return preview without state modifications
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args, dryRun, lang = "en" }) => {
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

    const injuryType = typeof args?.injuryType === "string" ? args.injuryType.toLowerCase().trim() : "wounded";

    // If this is a dry run (preview), just return the preview message without state modifications
    if (dryRun) {
      let previewMessage = "";
      switch (injuryType) {
        case "remove_eye":
          previewMessage = {
            en: `${targetCharacter.shortName} will lose an eye`,
            ru: `${targetCharacter.shortName} потеряет глаз`,
            fr: `${targetCharacter.shortName} perdra un œil`,
            de: `${targetCharacter.shortName} wird ein Auge verlieren`,
            es: `${targetCharacter.shortName} perderá un ojo`,
            ja: `${targetCharacter.shortName}は片目を失います`,
            ko: `${targetCharacter.shortName}은(는) 눈 하나를 잃게 됩니다`,
            pl: `${targetCharacter.shortName} straci oko`,
            zh: `${targetCharacter.shortName}将失去一只眼睛`
          };
          break;
        case "blind":
          previewMessage = {
            en: `${targetCharacter.shortName} will be blinded`,
            ru: `${targetCharacter.shortName} будет ослеплен`,
            fr: `${targetCharacter.shortName} sera aveuglé`,
            de: `${targetCharacter.shortName} wird geblendet`,
            es: `${targetCharacter.shortName} quedará ciego`,
            ja: `${targetCharacter.shortName}は盲目になります`,
            ko: `${targetCharacter.shortName}은(는) 실명하게 됩니다`,
            pl: `${targetCharacter.shortName} straci wzrok`,
            zh: `${targetCharacter.shortName}将失明`
          };
          break;
        case "cut_leg":
          previewMessage = {
            en: `${targetCharacter.shortName} will lose a leg`,
            ru: `${targetCharacter.shortName} потеряет ногу`,
            fr: `${targetCharacter.shortName} perdra une jambe`,
            de: `${targetCharacter.shortName} wird ein Bein verlieren`,
            es: `${targetCharacter.shortName} perderá una pierna`,
            ja: `${targetCharacter.shortName}は脚を失います`,
            ko: `${targetCharacter.shortName}은(는) 다리를 잃게 됩니다`,
            pl: `${targetCharacter.shortName} straci nogę`,
            zh: `${targetCharacter.shortName}将失去一条腿`
          };
          break;
        case "cut_balls":
          previewMessage = {
            en: `${targetCharacter.shortName} will be castrated`,
            ru: `${targetCharacter.shortName} будет кастрирован`,
            fr: `${targetCharacter.shortName} sera castré`,
            de: `${targetCharacter.shortName} wird kastriert`,
            es: `${targetCharacter.shortName} será castrado`,
            ja: `${targetCharacter.shortName}は去勢されます`,
            ko: `${targetCharacter.shortName}은(는) 거세당하게 됩니다`,
            pl: `${targetCharacter.shortName} zostanie wykastrowany`,
            zh: `${targetCharacter.shortName}将被阉割`
          };
          break;
        case "disfigured":
          previewMessage = {
            en: `${targetCharacter.shortName} will be disfigured`,
            ru: `${targetCharacter.shortName} будет изуродован`,
            fr: `${targetCharacter.shortName} sera défiguré`,
            de: `${targetCharacter.shortName} wird entstellt`,
            es: `${targetCharacter.shortName} será desfigurado`,
            ja: `${targetCharacter.shortName}は醜くなります`,
            ko: `${targetCharacter.shortName}은(는) 흉측하게 됩니다`,
            pl: `${targetCharacter.shortName} zostanie oszpecony`,
            zh: `${targetCharacter.shortName}将被毁容`
          };
          break;
        default:
          previewMessage = {
            en: `${targetCharacter.shortName} will be injured`,
            ru: `${targetCharacter.shortName} будет ранен`,
            fr: `${targetCharacter.shortName} sera blessé`,
            de: `${targetCharacter.shortName} wird verletzt`,
            es: `${targetCharacter.shortName} resultará herido`,
            ja: `${targetCharacter.shortName}は負傷します`,
            ko: `${targetCharacter.shortName}은(는) 부상당하게 됩니다`,
            pl: `${targetCharacter.shortName} zostanie ranny`,
            zh: `${targetCharacter.shortName}将受伤`
          };
          break;
      }
      return {
        message: previewMessage,
        sentiment: 'negative'
      };
    }
    const genderWords = GENDER_WORDS[lang] || GENDER_WORDS.en;
    const isMale = targetCharacter.sheHe === genderWords.he;

    // Helper function to get localized trait name
    const getTraitName = (traitKey) => {
      return TRAIT_NAMES[traitKey]?.[lang] || TRAIT_NAMES[traitKey]?.en || traitKey;
    };

    // Localized trait names for checking and adding
    const traitOneEyed = getTraitName('one_eyed');
    const traitBlind = getTraitName('blind');
    const traitOneLegged = getTraitName('one_legged');
    const traitDisfigured = getTraitName('disfigured');
    const traitWounded1 = getTraitName('wounded_1');
    const traitWounded2 = getTraitName('wounded_2');
    const traitWounded3 = getTraitName('wounded_3');
    const traitMaimed = getTraitName('maimed');
    const traitEunuch = getTraitName('eunuch');
    const traitBeardlessEunuch = getTraitName('beardless_eunuch');
    const traitLunatic1 = getTraitName('lunatic_1');
    const traitPossessed1 = getTraitName('possessed_1');

    let message = "";

    // Apply specific injury based on type
    switch (injuryType) {
      case "remove_eye":
        if (targetCharacter.hasTrait(traitOneEyed)) {
          runGameEffect(`
global_var:votc_action_target = {
    add_trait = blind
    remove_trait = one_eyed
}`);
          try {
            targetCharacter.addTrait({
              category: "health",
              name: traitBlind,
              desc: `${targetCharacter.shortName} is blind`
            });
          } catch (e) {}
          message = {
            en: `${targetCharacter.shortName}'s remaining eye was destroyed, leaving them blind`,
            ru: `Оставшийся глаз ${targetCharacter.shortName} был уничтожен, что привело к слепоте`,
            fr: `L'œil restant de ${targetCharacter.shortName} a été détruit, les rendant aveugle`,
            de: `${targetCharacter.shortName}s verbleibendes Auge wurde zerstört, ${targetCharacter.sheHe === 'he' ? 'ihn' : 'sie'} blind lassend`,
            es: `El ojo restante de ${targetCharacter.shortName} fue destruido, dejándol${targetCharacter.sheHe === 'he' ? 'o' : 'a'} ciego`,
            ja: `${targetCharacter.shortName}の残った目が破壊され、盲目になりました`,
            ko: `${targetCharacter.shortName}의 남은 눈이 파괴되어 실명했습니다`,
            pl: `Pozostałe oko ${targetCharacter.shortName} zostało zniszczone, powodując ślepotę`,
            zh: `${targetCharacter.shortName}剩下的眼睛被毁，导致失明`
          };
        } else {
          runGameEffect(`
global_var:votc_action_target = {
    add_trait = one_eyed
}`);
          try {
            targetCharacter.addTrait({
              category: "health",
              name: traitOneEyed,
              desc: `${targetCharacter.shortName} is one-eyed`
            });
          } catch (e) {}
          message = {
            en: `${targetCharacter.shortName}'s eye was brutally removed`,
            ru: `Глаз ${targetCharacter.shortName} был жестоко выколот`,
            fr: `L'œil de ${targetCharacter.shortName} a été brutalement retiré`,
            de: `${targetCharacter.shortName}s Auge wurde brutal entfernt`,
            es: `El ojo de ${targetCharacter.shortName} fue brutalmente extirpado`,
            ja: `${targetCharacter.shortName}の目は残酷に取り除かれました`,
            ko: `${targetCharacter.shortName}의 눈이 무참하게 제거되었습니다`,
            pl: `Oko ${targetCharacter.shortName} zostało brutalnie usunięte`,
            zh: `${targetCharacter.shortName}的眼睛被残酷地摘除了`
          };
        }
        break;

      case "blind":
        if (!targetCharacter.hasTrait(traitBlind)) {
          runGameEffect(`
global_var:votc_action_target = {
    add_trait = blind
}`);
          try {
            targetCharacter.addTrait({
              category: "health",
              name: traitBlind,
              desc: `${targetCharacter.shortName} is blind`
            });
          } catch (e) {}
          message = {
            en: `${targetCharacter.shortName} was blinded`,
            ru: `${targetCharacter.shortName} ослеп`,
            fr: `${targetCharacter.shortName} a été aveuglé`,
            de: `${targetCharacter.shortName} wurde geblendet`,
            es: `${targetCharacter.shortName} quedó ciego`,
            ja: `${targetCharacter.shortName}は盲目になりました`,
            ko: `${targetCharacter.shortName}은(는) 실명했습니다`,
            pl: `${targetCharacter.shortName} stracił wzrok`,
            zh: `${targetCharacter.shortName}失明了`
          };
        } else {
          message = {
            en: `${targetCharacter.shortName} is already blind`,
            ru: `${targetCharacter.shortName} уже слеп`,
            fr: `${targetCharacter.shortName} est déjà aveugle`,
            de: `${targetCharacter.shortName} ist bereits blind`,
            es: `${targetCharacter.shortName} ya es ciego`,
            ja: `${targetCharacter.shortName}はすでに盲目です`,
            ko: `${targetCharacter.shortName}은(는) 이미 실명했습니다`,
            pl: `${targetCharacter.shortName} jest już niewidomy`,
            zh: `${targetCharacter.shortName}已经失明了`
          };
        }
        break;

      case "cut_leg":
        if (!targetCharacter.hasTrait(traitOneLegged)) {
          runGameEffect(`
global_var:votc_action_target = {
    add_trait = one_legged
}`);
          try {
            targetCharacter.addTrait({
              category: "health",
              name: traitOneLegged,
              desc: `${targetCharacter.shortName} is one-legged`
            });
          } catch (e) {}
          message = {
            en: `${targetCharacter.shortName}'s leg was severed`,
            ru: `Нога ${targetCharacter.shortName} была отрублена`,
            fr: `La jambe de ${targetCharacter.shortName} a été coupée`,
            de: `${targetCharacter.shortName}s Bein wurde abgetrennt`,
            es: `La pierna de ${targetCharacter.shortName} fue amputada`,
            ja: `${targetCharacter.shortName}の脚が切断されました`,
            ko: `${targetCharacter.shortName}의 다리가 잘려나갔습니다`,
            pl: `Noga ${targetCharacter.shortName} została odcięta`,
            zh: `${targetCharacter.shortName}的腿被切断了`
          };
        } else {
          message = {
            en: `${targetCharacter.shortName} already has only one leg`,
            ru: `${targetCharacter.shortName} уже с одной ногой`,
            fr: `${targetCharacter.shortName} n'a déjà qu'une seule jambe`,
            de: `${targetCharacter.shortName} hat bereits nur noch ein Bein`,
            es: `${targetCharacter.shortName} ya tiene una sola pierna`,
            ja: `${targetCharacter.shortName}はすでに片足しかありません`,
            ko: `${targetCharacter.shortName}은(는) 이미 다리 하나뿐입니다`,
            pl: `${targetCharacter.shortName} ma już tylko jedną nogę`,
            zh: `${targetCharacter.shortName}已经只有一条腿了`
          };
        }
        break;

      case "cut_balls":
        if (isMale && (!targetCharacter.hasTrait(traitEunuch) && !targetCharacter.hasTrait(traitBeardlessEunuch))) {
          runGameEffect(`
global_var:votc_action_target = {
    if = {
        limit = {
            age < 12
        }
        ep3_child_castration_effect = yes
    }
    else = {
        ep3_youth_castration_effect = yes
    }
}`);
          try {
            targetCharacter.addTrait({
              category: "health",
              name: traitEunuch,
              desc: `${targetCharacter.shortName} is an eunuch`
            });
          } catch (e) {}
          message = {
            en: `${targetCharacter.shortName} was castrated`,
            ru: `${targetCharacter.shortName} был кастрирован`,
            fr: `${targetCharacter.shortName} a été castré`,
            de: `${targetCharacter.shortName} wurde kastriert`,
            es: `${targetCharacter.shortName} fue castrado`,
            ja: `${targetCharacter.shortName}は去勢されました`,
            ko: `${targetCharacter.shortName}은(는) 거세되었습니다`,
            pl: `${targetCharacter.shortName} został wykastrowany`,
            zh: `${targetCharacter.shortName}被阉割了`
          };
        } else {
          message = {
            en: `${targetCharacter.shortName} cannot be castrated`,
            ru: `${targetCharacter.shortName} не может быть кастрирован`,
            fr: `${targetCharacter.shortName} ne peut pas être castré`,
            de: `${targetCharacter.shortName} kann nicht kastriert werden`,
            es: `${targetCharacter.shortName} no puede ser castrado`,
            ja: `${targetCharacter.shortName}は去勢できません`,
            ko: `${targetCharacter.shortName}은(는) 거세될 수 없습니다`,
            pl: `${targetCharacter.shortName} nie może być wykastrowany`,
            zh: `${targetCharacter.shortName}不能被阉割`
          };
        }
        break;

      case "disfigured":
        if (!targetCharacter.hasTrait(traitDisfigured)) {
          runGameEffect(`
global_var:votc_action_target = {
    add_trait = disfigured
}`);
          try {
            targetCharacter.addTrait({
              category: "health",
              name: traitDisfigured,
              desc: `${targetCharacter.shortName} is disfigured`
            });
          } catch (e) {}
          message = {
            en: `${targetCharacter.shortName}'s face was horribly disfigured`,
            ru: `Лицо ${targetCharacter.shortName} было ужасно обезображено`,
            fr: `Le visage de ${targetCharacter.shortName} a été horriblement défiguré`,
            de: `${targetCharacter.shortName}s Gesicht wurde schrecklich entstellt`,
            es: `La cara de ${targetCharacter.shortName} fue horriblemente desfigurada`,
            ja: `${targetCharacter.shortName}の顔は恐ろしく傷つきました`,
            ko: `${targetCharacter.shortName}의 얼굴은 끔찍하게 훼손되었습니다`,
            pl: `Twarz ${targetCharacter.shortName} została okropnie zniekształcona`,
            zh: `${targetCharacter.shortName}的脸被严重毁容了`
          };
        } else {
          message = {
            en: `${targetCharacter.shortName} is already disfigured`,
            ru: `${targetCharacter.shortName} уже обезображен`,
            fr: `${targetCharacter.shortName} est déjà défiguré`,
            de: `${targetCharacter.shortName} ist bereits entstellt`,
            es: `${targetCharacter.shortName} ya está desfigurado`,
            ja: `${targetCharacter.shortName}はすでに醜くなっています`,
            ko: `${targetCharacter.shortName}은(는) 이미 흉측하게 되었습니다`,
            pl: `${targetCharacter.shortName} jest już oszpecony`,
            zh: `${targetCharacter.shortName}已经毁容了`
          };
        }
        break;

      default:
        message = {
          en: `${targetCharacter.shortName} was injured`,
          ru: `${targetCharacter.shortName} был ранен`,
          fr: `${targetCharacter.shortName} a été blessé`,
          de: `${targetCharacter.shortName} wurde verletzt`,
          es: `${targetCharacter.shortName} resultó herido`,
          ja: `${targetCharacter.shortName}は負傷しました`,
          ko: `${targetCharacter.shortName}은(는) 부상했습니다`,
          pl: `${targetCharacter.shortName} został ranny`,
          zh: `${targetCharacter.shortName}受伤了`
        };
        break;
    }

    // Randomly apply lunatic or possessed with a 5% chance after any injury
    if (Math.random() < 0.05 && !(targetCharacter.hasTrait(traitLunatic1) || targetCharacter.hasTrait(traitPossessed1))) {
      const mentalTrait = Math.random() < 0.5 ? 'lunatic_1' : 'possessed_1';
      runGameEffect(`
global_var:votc_action_target = {
    add_trait = ${mentalTrait}
}`);
    }

    // Apply wound progression based on existing traits
    if (targetCharacter.hasTrait(traitWounded3)) {
      // Replace Wounded_3 with Maimed (25% chance)
      if (Math.random() < 0.25) {
        runGameEffect(`
global_var:votc_action_target = {
    remove_trait = wounded_3
    add_trait = maimed
}`);
        try {
          targetCharacter.removeTrait(traitWounded3);
          targetCharacter.addTrait({
            category: "health",
            name: traitMaimed,
            desc: `${targetCharacter.shortName} is maimed`
          });
        } catch (e) {}
      }
    } else if (targetCharacter.hasTrait(traitWounded2)) {
      // Replace Wounded_2 with Wounded_3 (40% chance)
      if (Math.random() < 0.40) {
        runGameEffect(`
global_var:votc_action_target = {
    remove_trait = wounded_2
    add_trait = wounded_3
}`);
        try {
          targetCharacter.removeTrait(traitWounded2);
          targetCharacter.addTrait({
            category: "health",
            name: traitWounded3,
            desc: `${targetCharacter.shortName} is heavily wounded`
          });
        } catch (e) {}
      }
    } else if (targetCharacter.hasTrait(traitWounded1)) {
      // Replace Wounded_1 with Wounded_2 (65% chance)
      if (Math.random() < 0.65) {
        runGameEffect(`
global_var:votc_action_target = {
    remove_trait = wounded_1
    add_trait = wounded_2
}`);
        try {
          targetCharacter.removeTrait(traitWounded1);
          targetCharacter.addTrait({
            category: "health",
            name: traitWounded2,
            desc: `${targetCharacter.shortName} is really wounded`
          });
        } catch (e) {}
      }
    } else {
      // If the target has no wounded traits, add Wounded_1
      runGameEffect(`
global_var:votc_action_target = {
    add_trait = wounded_1
}`);
      try {
        targetCharacter.addTrait({
          category: "health",
          name: traitWounded1,
          desc: `${targetCharacter.shortName} is wounded`
        });
      } catch (e) {}
    }

    return {
      message: message || {
        en: `${targetCharacter.shortName} was injured`,
        ru: `${targetCharacter.shortName} был ранен`,
        fr: `${targetCharacter.shortName} a été blessé`,
        de: `${targetCharacter.shortName} wurde verletzt`,
        es: `${targetCharacter.shortName} resultó herido`,
        ja: `${targetCharacter.shortName}は負傷しました`,
        ko: `${targetCharacter.shortName}은(는) 부상했습니다`,
        pl: `${targetCharacter.shortName} został ranny`,
        zh: `${targetCharacter.shortName}受伤了`
      },
      sentiment: 'negative'
    };
  },
};
