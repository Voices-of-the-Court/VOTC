/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "isImprisonedBy",
  title: {
    en: "Source Is Imprisoned By Target",
    ru: "Исходный персонаж заключен в тюрьму целью",
    fr: "La source est emprisonnée par la cible",
    de: "Quellcharakter vom Ziel eingesperrt",
    es: "La fuente es encarcelada por el objetivo",
    ja: "ソースがターゲットによって投獄",
    ko: "출처가 대상에 의해 투옥됨",
    pl: "Źródło uwięzione przez cel",
    zh: "玩家被目标囚禁"
  },

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  args: ({ gameData, sourceCharacter }) => [
    {
      name: "prisonType",
      type: "enum",
      description: `Type of prison ${sourceCharacter.shortName} is sent to. Possible values: house_arrest, dungeon.`,
      required: true,
      options: ["house_arrest", "dungeon"],
    },
    {
      name: "isPlayerSource",
      type: "boolean",  // ← Add to args
      description: `If true, ${gameData.playerName} is the one being imprisoned`,
      required: false,
    }
  ],

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  description: ({ gameData, sourceCharacter }) =>
    `Imprison ${sourceCharacter.shortName} by the chosen target (the jailor). Optionally specify prisonType: house_arrest, or dungeon.
    If isPlayerSource is true, the ${gameData.playerName} will be imprisoned instead of ${sourceCharacter.shortName}.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Minimal logic per instructions: allow execution.
    // Still provide valid targets so the model MUST choose a jailor.
    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => id !== sourceCharacter.id);
    return {
      canExecute: true,
      validTargetCharacterIds: validTargets,
    };
  },

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   * @param {Character} params.targetCharacter
   * @param {Function} params.runGameEffect
   * @param {Record<string, number|string|null>} params.args
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

    const raw = (args && typeof args.prisonType === "string") ? args.prisonType.trim().toLowerCase() : "default";
    const isPlayerSource = args && typeof args.isPlayerSource === "boolean" ? args.isPlayerSource : false;
    const prisonType = ["default", "house_arrest", "dungeon"].includes(raw) ? raw : "default";

    if (!isPlayerSource) {
      if (prisonType === "house_arrest") {
        runGameEffect(`
if = {
    limit = {
        global_var:votc_action_source = { target_is_liege_or_above = global_var:votc_action_target }
    }
    imprison_character_effect = {
        TARGET = global_var:votc_action_source
        IMPRISONER = global_var:votc_action_target
    }
    global_var:votc_action_target = {
        consume_imprisonment_reasons = global_var:votc_action_source
    }
}
else = {
    rightfully_imprison_character_effect = {
        TARGET = global_var:votc_action_source
        IMPRISONER = global_var:votc_action_target
    }
}`);
        return {
          message: {
            en: `${sourceCharacter.shortName} was placed under house arrest by ${targetCharacter.shortName}`,
            ru: `${sourceCharacter.shortName} был помещен под домашний арест ${targetCharacter.shortName}`,
            fr: `${sourceCharacter.shortName} a été mis en résidence surveillée par ${targetCharacter.shortName}`,
            de: `${sourceCharacter.shortName} wurde von ${targetCharacter.shortName} unter Hausarrest gestellt`,
            es: `${sourceCharacter.shortName} fue puesto bajo arresto domiciliario por ${targetCharacter.shortName}`,
            ja: `${sourceCharacter.shortName}は${targetCharacter.shortName}によって軟禁されました`,
            ko: `${sourceCharacter.shortName}은(는) ${targetCharacter.shortName}에 의해 가택 연금되었습니다`,
            pl: `${sourceCharacter.shortName} został umieszczony w areszcie domowym przez ${targetCharacter.shortName}`,
            zh: `${sourceCharacter.shortName}被${targetCharacter.shortName}软禁`
          },
          sentiment: 'negative'
        };
      }

      if (prisonType === "dungeon") {
        runGameEffect(`
if = {
    limit = {
        global_var:votc_action_source = { target_is_liege_or_above = global_var:votc_action_target }
    }
    imprison_character_effect = {
        TARGET = global_var:votc_action_source
        IMPRISONER = global_var:votc_action_target
    }
    global_var:votc_action_source = {
        change_prison_type = dungeon
    }
    global_var:votc_action_target = {
        consume_imprisonment_reasons = global_var:votc_action_source
    }
}
else = {
    rightfully_imprison_character_effect = {
        TARGET = global_var:votc_action_source
        IMPRISONER = global_var:votc_action_target
    }
    global_var:votc_action_source = {
        change_prison_type = dungeon
    }
}`);
        return {
          message: {
            en: `${sourceCharacter.shortName} was thrown into the dungeon by ${targetCharacter.shortName}`,
            ru: `${sourceCharacter.shortName} был брошен в темницу ${targetCharacter.shortName}`,
            fr: `${sourceCharacter.shortName} a été jeté au donjon par ${targetCharacter.shortName}`,
            de: `${sourceCharacter.shortName} wurde von ${targetCharacter.shortName} in den Kerker geworfen`,
            es: `${sourceCharacter.shortName} fue arrojado a la mazmorra por ${targetCharacter.shortName}`,
            ja: `${sourceCharacter.shortName}は${targetCharacter.shortName}によって地下牢に投げ込まれました`,
            ko: `${sourceCharacter.shortName}은(는) ${targetCharacter.shortName}에 의해 지하 감옥에 투입되었습니다`,
            pl: `${sourceCharacter.shortName} został wrzucony do lochu przez ${targetCharacter.shortName}`,
            zh: `${sourceCharacter.shortName}被${targetCharacter.shortName}扔进地牢`
          },
          sentiment: 'negative'
        };
      }

      runGameEffect(`
if = {
    limit = {
        global_var:votc_action_source = { target_is_liege_or_above = global_var:votc_action_target }
    }
    imprison_character_effect = {
        TARGET = global_var:votc_action_source
        IMPRISONER = global_var:votc_action_target
    }
    global_var:votc_action_target = {
        consume_imprisonment_reasons = global_var:votc_action_source
    }
}
else = {
    rightfully_imprison_character_effect = {
        TARGET = global_var:votc_action_source
        IMPRISONER = global_var:votc_action_target
    }
}`);
      return {
        message: {
          en: `${sourceCharacter.shortName} was imprisoned by ${targetCharacter.shortName}`,
          ru: `${sourceCharacter.shortName} был заключен в тюрьму ${targetCharacter.shortName}`,
          fr: `${sourceCharacter.shortName} a été emprisonné par ${targetCharacter.shortName}`,
          de: `${sourceCharacter.shortName} wurde von ${targetCharacter.shortName} eingesperrt`,
          es: `${sourceCharacter.shortName} fue encarcelado por ${targetCharacter.shortName}`,
          ja: `${sourceCharacter.shortName}は${targetCharacter.shortName}によって投獄されました`,
          ko: `${sourceCharacter.shortName}은(는) ${targetCharacter.shortName}에 의해 투옥되었습니다`,
          pl: `${sourceCharacter.shortName} został uwięziony przez ${targetCharacter.shortName}`,
          zh: `${sourceCharacter.shortName}被${targetCharacter.shortName}囚禁`
        },
        sentiment: 'negative'
      };
    } else {
      if (prisonType === "house_arrest") {
        runGameEffect(`
if = {
    limit = {
        root = { target_is_liege_or_above = global_var:votc_action_target }
    }
    imprison_character_effect = {
        TARGET = root
        IMPRISONER = global_var:votc_action_target
    }
    global_var:votc_action_target = {
        consume_imprisonment_reasons = root
    }
}
else = {
    rightfully_imprison_character_effect = {
        TARGET = root
        IMPRISONER = global_var:votc_action_target
    }
}`);
        return {
          message: {
            en: `${gameData.playerName} was placed under house arrest by ${targetCharacter.shortName}`,
            ru: `${gameData.playerName} был помещен под домашний арест ${targetCharacter.shortName}`,
            fr: `${gameData.playerName} a été mis en résidence surveillée par ${targetCharacter.shortName}`,
            de: `${gameData.playerName} wurde von ${targetCharacter.shortName} unter Hausarrest gestellt`,
            es: `${gameData.playerName} fue puesto bajo arresto domiciliario por ${targetCharacter.shortName}`,
            ja: `${gameData.playerName}は${targetCharacter.shortName}によって軟禁されました`,
            ko: `${gameData.playerName}은(는) ${targetCharacter.shortName}에 의해 가택 연금되었습니다`,
            pl: `${gameData.playerName} został umieszczony w areszcie domowym przez ${targetCharacter.shortName}`,
            zh: `${gameData.playerName}被${targetCharacter.shortName}软禁`
          },
          sentiment: 'negative'
        };
      }

      if (prisonType === "dungeon") {
        runGameEffect(`
if = {
    limit = {
        root = { target_is_liege_or_above = global_var:votc_action_target }
    }
    imprison_character_effect = {
        TARGET = root
        IMPRISONER = global_var:votc_action_target
    }
    root = {
        change_prison_type = dungeon
    }
    global_var:votc_action_target = {
        consume_imprisonment_reasons = root
    }
}
else = {
    rightfully_imprison_character_effect = {
        TARGET = root
        IMPRISONER = global_var:votc_action_target
    }
    root = {
        change_prison_type = dungeon
    }
}`);
        return {
          message: {
            en: `${gameData.playerName} was thrown into the dungeon by ${targetCharacter.shortName}`,
            ru: `${gameData.playerName} был брошен в темницу ${targetCharacter.shortName}`,
            fr: `${gameData.playerName} a été jeté au donjon par ${targetCharacter.shortName}`,
            de: `${gameData.playerName} wurde von ${targetCharacter.shortName} in den Kerker geworfen`,
            es: `${gameData.playerName} fue arrojado a la mazmorra por ${targetCharacter.shortName}`,
            ja: `${gameData.playerName}は${targetCharacter.shortName}によって地下牢に投げ込まれました`,
            ko: `${gameData.playerName}은(는) ${targetCharacter.shortName}에 의해 지하 감옥에 투입되었습니다`,
            pl: `${gameData.playerName} został wrzucony do lochu przez ${targetCharacter.shortName}`,
            zh: `${gameData.playerName}被${targetCharacter.shortName}扔进地牢`
          },
          sentiment: 'negative'
        };
      }

      runGameEffect(`
if = {
    limit = {
        root = { target_is_liege_or_above = global_var:votc_action_target }
    }
    imprison_character_effect = {
        TARGET = root
        IMPRISONER = global_var:votc_action_target
    }
    global_var:votc_action_target = {
        consume_imprisonment_reasons = root
    }
}
else = {
    rightfully_imprison_character_effect = {
        TARGET = root
        IMPRISONER = global_var:votc_action_target
    }
}`);
      return {
        message: {
          en: `${gameData.playerName} was imprisoned by ${targetCharacter.shortName}`,
          ru: `${gameData.playerName} был заключен в тюрьму ${targetCharacter.shortName}`,
          fr: `${gameData.playerName} a été emprisonné par ${targetCharacter.shortName}`,
          de: `${gameData.playerName} wurde von ${targetCharacter.shortName} eingesperrt`,
          es: `${gameData.playerName} fue encarcelado por ${targetCharacter.shortName}`,
          ja: `${gameData.playerName}は${targetCharacter.shortName}によって投獄されました`,
          ko: `${gameData.playerName}은(는) ${targetCharacter.shortName}에 의해 투옥되었습니다`,
          pl: `${gameData.playerName} został uwięziony przez ${targetCharacter.shortName}`,
          zh: `${gameData.playerName}被${targetCharacter.shortName}囚禁`
        },
        sentiment: 'negative'
      };
    }
  },
};