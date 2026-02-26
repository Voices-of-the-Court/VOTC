/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

const COURT_POSITIONS = [
  "physician", "keeper_of_swans", "travel_leader", "master_of_horse", "court_jester",
  "master_of_hunt", "high_almoner", "cupbearer", "seneschal", "antiquarian", "tutor",
  "royal_architect", "court_poet", "bodyguard", "court_champion", "musician", "food_taster",
  "lady_in_waiting", "garuda", "chief_eunuch", "court_gardener", "chief_qadi", "wet_nurse",
  "akolouthos"
];

// CK3 official Simplified Chinese court position names
const COURT_POSITION_ZH = {
  "physician": "私人医生",
  "keeper_of_swans": "天鹅饲养员",
  "travel_leader": "旅队主管",
  "master_of_horse": "御马官",
  "court_jester": "宫廷小丑",
  "master_of_hunt": "狩猎总管",
  "high_almoner": "施赈吏总长",
  "cupbearer": "斟酒人",
  "seneschal": "总管",
  "antiquarian": "古物研究官",
  "tutor": "教师",
  "royal_architect": "御用建筑师",
  "court_poet": "宫廷诗人",
  "bodyguard": "贴身侍卫",
  "court_champion": "勇士",
  "musician": "宫廷乐师",
  "food_taster": "尝膳官",
  "lady_in_waiting": "女侍臣",
  "garuda": "迦楼罗",
  "chief_eunuch": "太监",
  "court_gardener": "宫廷园丁",
  "chief_qadi": "首席教法官",
  "wet_nurse": "乳母",
  "akolouthos": "都长"
};

module.exports = {
  signature: "isAssignedToCourtPositionBy",
  title: {
    en: "Source Assigned to Target's Court Position",
    ru: "Исходный персонаж назначен на придворную должность цели",
    fr: "La source est assignée à une position de cour de la cible",
    de: "Quellcharakter einer Hofposition des Ziels zugewiesen",
    es: "La fuente es asignada a una posición de corte del objetivo",
    ja: "ソースがターゲットの宮廷の役職に任命",
    ko: "출처가 대상의 궁정 직책에 임명됨",
    pl: "Źródło przypisane do stanowiska dworskiego celu",
    zh: "被任命至目标的宫廷职位"
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ gameData, sourceCharacter }) => [
    {
      name: "court_position",
      type: "enum",
      description: `The court position to which ${sourceCharacter.shortName} is assigned.`,
      required: true,
      options: COURT_POSITIONS
    },
    {
      name: "isPlayerSource",
      type: "boolean",
      description: `If true, ${gameData.playerName} is the one being assigned to the court position`,
      required: false,
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ gameData, sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} is appointed to a court position in the target character's court. Target must be a landed ruler.
    If isPlayerSource is true, ${gameData.playerName} will be assigned instead of ${sourceCharacter.shortName}.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Only landed rulers can have court positions
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
          en: `Failed: ${targetCharacter.shortName} is not a landed ruler and cannot have court positions`,
          ru: `Ошибка: ${targetCharacter.shortName} не является землевладельцем и не может иметь придворные должности`,
          fr: `Échec : ${targetCharacter.shortName} n'est pas un dirigeant terrien et ne peut pas avoir de positions de cour`,
          de: `Fehler: ${targetCharacter.shortName} ist kein Landesherrscher und kann keine Hofpositionen haben`,
          es: `Error: ${targetCharacter.shortName} no es un gobernante con tierras y no puede tener posiciones de corte`,
          ja: `失敗: ${targetCharacter.shortName}は領主ではなく、宮廷の役職を持つことができません`,
          ko: `실패: ${targetCharacter.shortName}은(는) 영주가 아니며 궁정 직책을 가질 수 없습니다`,
          pl: `Niepowodzenie: ${targetCharacter.shortName} nie jest władcą lądowym i nie może mieć stanowisk dworskich`,
          zh: `失败: ${targetCharacter.shortName}没有封地，无法设立宫廷职位`
        },
        sentiment: 'negative'
      };
    }

    const position = typeof args?.court_position === "string"
      ? args.court_position.toLowerCase().trim()
      : "";

    if (!COURT_POSITIONS.includes(position)) {
      return {
        message: {
          en: `Failed: Invalid court position "${position}"`,
          ru: `Ошибка: Неверная придворная должность "${position}"`,
          fr: `Échec : Position de cour invalide "${position}"`,
          de: `Fehler: Ungültige Hofposition "${position}"`,
          es: `Error: Posición de corte inválida "${position}"`,
          ja: `失敗: 無効な宮廷の役職 "${position}"`,
          ko: `실패: 잘못된 궁정 직책 "${position}"`,
          pl: `Niepowodzenie: Nieprawidłowe stanowisko dworskie "${position}"`,
          zh: `失败: 无效的宫廷职位 "${position}"`
        },
        sentiment: 'negative'
      };
    }

    const isPlayerSource = args && typeof args.isPlayerSource === "boolean" ? args.isPlayerSource : false;

    const positionMap = {
      "physician": "court_physician_court_position",
      "keeper_of_swans": "keeper_of_swans_court_position",
      "travel_leader": "travel_leader_court_position",
      "master_of_horse": "master_of_horse_court_position",
      "court_jester": "court_jester_court_position",
      "master_of_hunt": "master_of_hunt_court_position",
      "high_almoner": "high_almoner_court_position",
      "cupbearer": "cupbearer_court_position",
      "seneschal": "seneschal_court_position",
      "antiquarian": "antiquarian_court_position",
      "tutor": "court_tutor_court_position",
      "royal_architect": "royal_architect_court_position",
      "court_poet": "court_poet_court_position",
      "bodyguard": "bodyguard_court_position",
      "court_champion": "champion_court_position",
      "musician": "court_musician_court_position",
      "food_taster": "food_taster_court_position",
      "lady_in_waiting": "lady_in_waiting_court_position",
      "garuda": "garuda_court_position",
      "chief_eunuch": "chief_eunuch_court_position",
      "court_gardener": "court_gardener_court_position",
      "chief_qadi": "chief_qadi_court_position",
      "wet_nurse": "wet_nurse_court_position",
      "akolouthos": "akolouthos_court_position"
    };

    const courtPositionType = positionMap[position];
    const positionDisplay = position.replace(/_/g, ' ');
    const positionZh = COURT_POSITION_ZH[position] || positionDisplay;

    if (!isPlayerSource) {
      if (position === "wet_nurse") {
        runGameEffect(`
global_var:votc_action_target = {
    trigger = {
        global_var:votc_action_source = {
            is_female = yes
        }
    }
    revoke_court_position = {
        court_position = ${courtPositionType}
    }
    appoint_court_position = {
        recipient = global_var:votc_action_source
        court_position = ${courtPositionType}
    }
}`);
      } else if (position === "akolouthos") {
        runGameEffect(`
global_var:votc_action_target = {
    trigger = {
        global_var:votc_action_source = {
            is_male = yes
        }
    }
    revoke_court_position = {
        court_position = ${courtPositionType}
    }
    appoint_court_position = {
        recipient = global_var:votc_action_source
        court_position = ${courtPositionType}
    }
}`);
      } else {
        runGameEffect(`
global_var:votc_action_target = {
    revoke_court_position = {
        court_position = ${courtPositionType}
    }
    appoint_court_position = {
        recipient = global_var:votc_action_source
        court_position = ${courtPositionType}
    }
}`);
      }

      return {
        message: {
          en: `${sourceCharacter.shortName} was assigned as ${positionDisplay} to ${targetCharacter.shortName}'s court`,
          ru: `${sourceCharacter.shortName} был назначен на должность ${positionDisplay} к двору ${targetCharacter.shortName}`,
          fr: `${sourceCharacter.shortName} a été assigné en tant que ${positionDisplay} à la cour de ${targetCharacter.shortName}`,
          de: `${sourceCharacter.shortName} wurde als ${positionDisplay} dem Hof von ${targetCharacter.shortName} zugewiesen`,
          es: `${sourceCharacter.shortName} fue asignado como ${positionDisplay} a la corte de ${targetCharacter.shortName}`,
          ja: `${sourceCharacter.shortName}は${targetCharacter.shortName}の宮廷に${positionDisplay}として任命されました`,
          ko: `${sourceCharacter.shortName}은(는) ${targetCharacter.shortName}의 궁정에 ${positionDisplay}(으)로 임명되었습니다`,
          pl: `${sourceCharacter.shortName} został przypisany jako ${positionDisplay} do dworu ${targetCharacter.shortName}`,
          zh: `${sourceCharacter.shortName}被任命为${targetCharacter.shortName}的${positionZh}`
        },
        sentiment: 'positive'
      };
    } else {
      if (position === "wet_nurse") {
        runGameEffect(`
global_var:votc_action_target = {
    trigger = {
        root = {
            is_female = yes
        }
    }
    revoke_court_position = {
        court_position = ${courtPositionType}
    }
    appoint_court_position = {
        recipient = root
        court_position = ${courtPositionType}
    }
}`);
      } else if (position === "akolouthos") {
        runGameEffect(`
global_var:votc_action_target = {
    trigger = {
        root = {
            is_male = yes
        }
    }
    revoke_court_position = {
        court_position = ${courtPositionType}
    }
    appoint_court_position = {
        recipient = root
        court_position = ${courtPositionType}
    }
}`);
      } else {
        runGameEffect(`
global_var:votc_action_target = {
    revoke_court_position = {
        court_position = ${courtPositionType}
    }
    appoint_court_position = {
        recipient = root
        court_position = ${courtPositionType}
    }
}`);
      }

      return {
        message: {
          en: `${gameData.playerName} was assigned as ${positionDisplay} to ${targetCharacter.shortName}'s court`,
          ru: `${gameData.playerName} был назначен на должность ${positionDisplay} к двору ${targetCharacter.shortName}`,
          fr: `${gameData.playerName} a été assigné en tant que ${positionDisplay} à la cour de ${targetCharacter.shortName}`,
          de: `${gameData.playerName} wurde als ${positionDisplay} dem Hof von ${targetCharacter.shortName} zugewiesen`,
          es: `${gameData.playerName} fue asignado como ${positionDisplay} a la corte de ${targetCharacter.shortName}`,
          ja: `${gameData.playerName}は${targetCharacter.shortName}の宮廷に${positionDisplay}として任命されました`,
          ko: `${gameData.playerName}은(는) ${targetCharacter.shortName}의 궁정에 ${positionDisplay}(으)로 임명되었습니다`,
          pl: `${gameData.playerName} został przypisany jako ${positionDisplay} do dworu ${targetCharacter.shortName}`,
          zh: `${gameData.playerName}被任命为${targetCharacter.shortName}的${positionZh}`
        },
        sentiment: 'positive'
      };
    }
  },
};
