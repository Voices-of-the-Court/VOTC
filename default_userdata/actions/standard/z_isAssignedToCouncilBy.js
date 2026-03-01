/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

const COUNCIL_POSITIONS = ["chancellor", "steward", "marshal", "spymaster", "court_chaplain", "minister_works", "minister_justice", "minister_personnel", "minister_grand_marshal"];

// CK3 official Simplified Chinese council position names and TGP names
const COUNCIL_POSITION_ZH = {
  "chancellor": "掌玺大臣（宰相）",
  "steward": "财政总管（户部尚书）",
  "marshal": "军事统帅（兵部尚书）",
  "spymaster": "间谍首脑（御史大夫）",
  "court_chaplain": "宫廷祭司（礼部尚书）",
  "minister_works": "工部尚书",
  "minister_justice": "刑部尚书",
  "minister_personnel": "吏部尚书",
  "minister_grand_marshal": "枢密使"
};

module.exports = {
  signature: "isAssignedToCouncilBy",
  title: {
    en: "Source Assigned to Target's Council",
    ru: "Исходный персонаж назначен в совет цели",
    fr: "La source est assignée au conseil de la cible",
    de: "Quellcharakter dem Rat des Ziels zugewiesen",
    es: "La fuente es asignada al consejo del objetivo",
    ja: "ソースがターゲットの評議会に任命",
    ko: "출처가 대상의 평의회에 임명됨",
    pl: "Źródło przypisane do rady celu",
    zh: "被任命至目标的内阁"
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ gameData, sourceCharacter }) => [
    {
      name: "council_position",
      type: "enum",
      description: `The council position to which ${sourceCharacter.shortName} is assigned. Options: chancellor, steward, marshal, spymaster, court_chaplain, minister_works, minister_justice, minister_personnel, minister_grand_marshal.`,
      required: true,
      options: COUNCIL_POSITIONS
    },
    {
      name: "isPlayerSource",
      type: "boolean",
      description: `If true, ${gameData.playerName} is the one being assigned to the council`,
      required: false,
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ gameData, sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} is appointed to the target character's council. Target must be a landed ruler.
    If isPlayerSource is true, ${gameData.playerName} will be assigned instead of ${sourceCharacter.shortName}.
    [Language mapping context for AI]: chancellor(掌玺大臣/宰相), steward(财政总管/户部尚书), marshal(军事统帅/兵部尚书), spymaster(间谍首脑/御史大夫), court_chaplain(宫廷祭司/礼部尚书), minister_works(工部尚书), minister_justice(刑部尚书), minister_personnel(吏部尚书), minister_grand_marshal(枢密使).`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Only landed rulers can have councils
    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => {
      const char = gameData.characters.get(id);
      return char && char.isLandedRuler && id !== sourceCharacter.id;
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

    if (!targetCharacter.isLandedRuler) {
      return {
        message: {
          en: `Failed: ${targetCharacter.shortName} is not a landed ruler and cannot have a council`,
          ru: `Ошибка: ${targetCharacter.shortName} не является землевладельцем и не может иметь совет`,
          fr: `Échec : ${targetCharacter.shortName} n'est pas un dirigeant terrien et ne peut pas avoir de conseil`,
          de: `Fehler: ${targetCharacter.shortName} ist kein Landesherrscher und kann keinen Rat haben`,
          es: `Error: ${targetCharacter.shortName} no es un gobernante con tierras y no puede tener un consejo`,
          ja: `失敗: ${targetCharacter.shortName}は領主ではなく、評議会を持つことができません`,
          ko: `실패: ${targetCharacter.shortName}은(는) 영주가 아니며 평의회를 가질 수 없습니다`,
          pl: `Niepowodzenie: ${targetCharacter.shortName} nie jest władcą lądowym i nie może mieć rady`,
          zh: `失败: ${targetCharacter.shortName}没有封地，无法拥有内阁`
        },
        sentiment: 'negative'
      };
    }

    const position = typeof args?.council_position === "string"
      ? args.council_position.toLowerCase().trim()
      : "";

    if (!COUNCIL_POSITIONS.includes(position)) {
      return {
        message: {
          en: `Failed: Invalid council position "${position}"`,
          ru: `Ошибка: Неверная позиция в совете "${position}"`,
          fr: `Échec : Position de conseil invalide "${position}"`,
          de: `Fehler: Ungültige Ratsposition "${position}"`,
          es: `Error: Posición de consejo inválida "${position}"`,
          ja: `失敗: 無効な評議会の位置 "${position}"`,
          ko: `실패: 잘못된 평의회 위치 "${position}"`,
          pl: `Niepowodzenie: Nieprawidłowa pozycja rady "${position}"`,
          zh: `失败: 无效的内阁职位 "${position}"`
        },
        sentiment: 'negative'
      };
    }

    const isPlayerSource = args && typeof args.isPlayerSource === "boolean" ? args.isPlayerSource : false;

    const positionMap = {
      "chancellor": "councillor_chancellor",
      "steward": "councillor_steward",
      "marshal": "councillor_marshal",
      "spymaster": "councillor_spymaster",
      "court_chaplain": "councillor_court_chaplain",
      "minister_works": "minister_works",
      "minister_justice": "minister_justice",
      "minister_personnel": "minister_personnel",
      "minister_grand_marshal": "minister_grand_marshal"
    };

    const positionTitleMap = {
      "chancellor": "e_minister_chancellor",
      "steward": "e_minister_of_revenue",
      "marshal": "e_minister_of_war",
      "spymaster": "e_minister_censor",
      "court_chaplain": "e_minister_of_rites",
      "minister_works": "e_minister_of_works",
      "minister_justice": "e_minister_of_justice",
      "minister_personnel": "e_minister_of_personnel",
      "minister_grand_marshal": "e_minister_grand_marshal"
    };

    const councillorType = positionMap[position];
    const councillorTitleRole = positionTitleMap[position];
    const positionZh = COUNCIL_POSITION_ZH[position] || position;

    if (!isPlayerSource) {
      runGameEffect(`
global_var:votc_action_target = {
    save_scope_as = councillor_liege
    if = {
        limit = {
            tgp_has_access_to_ministry_trigger = yes
        }
        global_var:votc_action_source = {
            got_minister_position_effect = { MINISTER_TITLE = ${councillorTitleRole} MINISTER_POSITION = ${councillorType} }
        }
    }
    else = {
        fire_councillor = cp:${councillorType}
        assign_councillor_type = {
            type = ${councillorType}
            target = global_var:votc_action_source
        }
    }
}`);

      return {
        message: {
          en: `${sourceCharacter.shortName} was assigned as ${position} to ${targetCharacter.shortName}'s council`,
          ru: `${sourceCharacter.shortName} был назначен на должность ${position} в совет ${targetCharacter.shortName}`,
          fr: `${sourceCharacter.shortName} a été assigné en tant que ${position} au conseil de ${targetCharacter.shortName}`,
          de: `${sourceCharacter.shortName} wurde als ${position} dem Rat von ${targetCharacter.shortName} zugewiesen`,
          es: `${sourceCharacter.shortName} fue asignado como ${position} al consejo de ${targetCharacter.shortName}`,
          ja: `${sourceCharacter.shortName}は${targetCharacter.shortName}の評議会に${position}として任命されました`,
          ko: `${sourceCharacter.shortName}은(는) ${targetCharacter.shortName}의 평의회에 ${position}(으)로 임명되었습니다`,
          pl: `${sourceCharacter.shortName} został przypisany jako ${position} do rady ${targetCharacter.shortName}`,
          zh: `${sourceCharacter.shortName}被任命为${positionZh}，加入${targetCharacter.shortName}的内阁`
        },
        sentiment: 'positive'
      };
    } else {
      runGameEffect(`
global_var:votc_action_target = {
    save_scope_as = councillor_liege
    if = {
        limit = {
            tgp_has_access_to_ministry_trigger = yes
        }
        root = {
            got_minister_position_effect = { MINISTER_TITLE = ${councillorTitleRole} MINISTER_POSITION = ${councillorType} }
        }
    }
    else = {
        fire_councillor = cp:${councillorType}
        assign_councillor_type = {
            type = ${councillorType}
            target = root
        }
    }
}`);

      return {
        message: {
          en: `${gameData.playerName} was assigned as ${position} to ${targetCharacter.shortName}'s council`,
          ru: `${gameData.playerName} был назначен на должность ${position} в совет ${targetCharacter.shortName}`,
          fr: `${gameData.playerName} a été assigné en tant que ${position} au conseil de ${targetCharacter.shortName}`,
          de: `${gameData.playerName} wurde als ${position} dem Rat von ${targetCharacter.shortName} zugewiesen`,
          es: `${gameData.playerName} fue asignado como ${position} al consejo de ${targetCharacter.shortName}`,
          ja: `${gameData.playerName}は${targetCharacter.shortName}の評議会に${position}として任命されました`,
          ko: `${gameData.playerName}은(는) ${targetCharacter.shortName}의 평의회에 ${position}(으)로 임명되었습니다`,
          pl: `${gameData.playerName} został przypisany jako ${position} do rady ${targetCharacter.shortName}`,
          zh: `${gameData.playerName}被任命为${positionZh}，加入${targetCharacter.shortName}的内阁`
        },
        sentiment: 'positive'
      };
    }
  },
};
