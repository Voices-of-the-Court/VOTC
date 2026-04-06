/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "giveGold",
  title: {
    en: "Give Gold",
    ru: "Дать золото",
    fr: "Donner de l'or",
    de: "Gold geben",
    es: "Dar oro",
    ja: "金を渡す",
    ko: "골드 주기",
    pl: "Daj złoto",
    zh: "赠送金币"
  },
  function: ({ gameData }) => {
    const characterInfo = Array.from(gameData.characters.values())
      .map(c => `${c.shortName} (id=${c.id}): ${c.gold} gold`)
      .join(', ');
    return {
      name: 'give_gold',
      description: `Use when a character gives or pays gold to another character. Characters: ${characterInfo}`,
      parameters: {
        type: 'object',
        properties: {
          targetCharacterId: {
            type: 'number',
            description: 'ID of the character receiving the gold.',
          },
          amount: {
            type: 'number',
            description: `Amount of gold to give.`,
            minimum: 1,
          },
        },
        required: ['targetCharacterId', 'amount'],
        additionalProperties: false,
      },
    };
  },
  check: ({ gameData }) => {
    const allIds = Array.from(gameData.characters.keys());
    const validSources = allIds.filter((id) => {
      const c = gameData.characters.get(id);
      return c && c.gold > 0;
    });

    if (validSources.length === 0) {
      return {
        canExecute: false,
        validSourceCharacterIds: [],
        validTargetCharacterIds: [],
      };
    }

    return {
      canExecute: true,
      validSourceCharacterIds: validSources,
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
   * @param {boolean} params.dryRun - If true, only preview without executing
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args, lang, dryRun }) => {
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
        messageType: 'badge'
      };
    }

    let amount = 0;
    const raw = args?.amount;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      amount = Math.floor(raw);
    } else {
      return {
        message: {
          en: "Failed: Invalid gold amount",
          ru: "Ошибка: Неверное количество золота",
          fr: "Échec : Montant d'or invalide",
          de: "Fehler: Ungültige Goldmenge",
          es: "Error: Cantidad de oro no válida",
          ja: "失敗: 無効な金額",
          ko: "실패: 잘못된 골드 양",
          pl: "Niepowodzenie: Nieprawidłowa ilość złota",
          zh: "失败: 无效的金币数量"
        },
        sentiment: 'negative',
        messageType: 'badge'
      };
    }

    if (sourceCharacter.gold < amount) {
      return {
        message: {
          en: `Failed: ${sourceCharacter.shortName} only has ${sourceCharacter.gold} gold, cannot pay ${amount}`,
          ru: `Ошибка: У ${sourceCharacter.shortName} только ${sourceCharacter.gold} золота, нельзя заплатить ${amount}`,
          fr: `Échec : ${sourceCharacter.shortName} n'a que ${sourceCharacter.gold} or, ne peut pas payer ${amount}`,
          de: `Fehler: ${sourceCharacter.shortName} hat nur ${sourceCharacter.gold} Gold, kann ${amount} nicht zahlen`,
          es: `Error: ${sourceCharacter.shortName} solo tiene ${sourceCharacter.gold} oro, no puede pagar ${amount}`,
          ja: `失敗: ${sourceCharacter.shortName}は${sourceCharacter.gold}金しか持っていないため、${amount}金を支払えません`,
          ko: `실패: ${sourceCharacter.shortName}은(는) ${sourceCharacter.gold}골드만 가지고 있어 ${amount}골드를 지불할 수 없습니다`,
          pl: `Niepowodzenie: ${sourceCharacter.shortName} ma tylko ${sourceCharacter.gold} złota, nie może zapłacić ${amount}`,
          zh: `失败: ${sourceCharacter.shortName}只有${sourceCharacter.gold}金币，无法支付${amount}`
        },
        sentiment: 'negative',
        messageType: 'badge'
      };
    }

    // Dry run - return preview without executing
    if (dryRun) {
      return {
        message: {
          en: `${sourceCharacter.shortName} will pay ${amount} gold to ${targetCharacter.shortName}`,
          ru: `${sourceCharacter.shortName} заплатит ${amount} золота ${targetCharacter.shortName}`,
          fr: `${sourceCharacter.shortName} paiera ${amount} or à ${targetCharacter.shortName}`,
          de: `${sourceCharacter.shortName} wird ${amount} Gold an ${targetCharacter.shortName} zahlen`,
          es: `${sourceCharacter.shortName} pagará ${amount} oro a ${targetCharacter.shortName}`,
          ja: `${sourceCharacter.shortName}は${targetCharacter.shortName}に${amount}金を支払います`,
          ko: `${sourceCharacter.shortName}은(는) ${targetCharacter.shortName}에게 ${amount}골드를 지불할 것입니다`,
          pl: `${sourceCharacter.shortName} zapłaci ${amount} złota ${targetCharacter.shortName}`,
          zh: `${sourceCharacter.shortName}将向${targetCharacter.shortName}支付${amount}金币`
        },
        sentiment: 'neutral',
        messageType: 'badge'
      };
    }

    // Determine correct CK3 game effect scoping
    const isPlayer = sourceCharacter.id === gameData.playerID;

    if (isPlayer) {
      runGameEffect(`
global_var:votc_action_target = {
    add_gold = ${amount}
}

root = {
    remove_short_term_gold = ${amount}
}`);
    } else {
      runGameEffect(`
global_var:votc_action_target = {
    add_gold = ${amount}
}

global_var:votc_action_source = {
    remove_short_term_gold = ${amount}
}`);
    }

    // Update local game data
    sourceCharacter.gold -= amount;
    targetCharacter.gold += amount;

    return {
      message: {
        en: `${sourceCharacter.shortName} paid ${amount} gold to ${targetCharacter.shortName}`,
        ru: `${sourceCharacter.shortName} заплатил ${amount} золота ${targetCharacter.shortName}`,
        fr: `${sourceCharacter.shortName} a payé ${amount} or à ${targetCharacter.shortName}`,
        de: `${sourceCharacter.shortName} zahlte ${amount} Gold an ${targetCharacter.shortName}`,
        es: `${sourceCharacter.shortName} pagó ${amount} oro a ${targetCharacter.shortName}`,
        ja: `${sourceCharacter.shortName}は${targetCharacter.shortName}に${amount}金を支払いました`,
        ko: `${sourceCharacter.shortName}은(는) ${targetCharacter.shortName}에게 ${amount}골드를 지불했습니다`,
        pl: `${sourceCharacter.shortName} zapłacił ${amount} złota ${targetCharacter.shortName}`,
        zh: `${sourceCharacter.shortName}向${targetCharacter.shortName}支付了${amount}金币`
      },
      sentiment: 'neutral',
      messageType: 'badge'
    };
  },
};
