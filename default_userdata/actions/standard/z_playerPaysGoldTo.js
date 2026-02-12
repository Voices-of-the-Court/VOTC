/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "playerPaysGoldTo",
  title: {
    en: "Player Pays Gold to Target",
    ru: "Игрок платит золотом цели",
    fr: "Le joueur paie de l'or à la cible",
    de: "Spieler zahlt Gold an das Ziel",
    es: "El jugador paga oro al objetivo",
    ja: "プレイヤーがターゲットに金を支払う",
    ko: "플레이어가 대상에게 골드 지급",
    pl: "Gracz płaci złoto do celu",
    zh: "玩家向目标支付金币"
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   * @param {GameData} params.gameData
   */
  args: ({ sourceCharacter, gameData }) => {
    const player = gameData.characters.get(gameData.playerID);
    const playerGold = player ? player.gold : 0;
    
    return [
      {
        name: "amount",
        type: "number",
        description: `The amount of gold ${gameData.playerName} pays to the target. ${gameData.playerName} currently has ${playerGold} gold.`,
        required: true,
        min: 1,
        max: playerGold,
        step: 1
      }
    ];
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   * @param {GameData} params.gameData
   */
  description: ({ sourceCharacter, gameData }) => {
    const player = gameData.characters.get(gameData.playerID);
    const playerGold = player ? player.gold : 0;
    return `Execute when ${gameData.playerName} (who has ${playerGold} gold) gives gold to the target character, only if it's clear the target accepted it. The player must have enough gold to pay.`;
  },

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    const player = gameData.characters.get(gameData.playerID);
    
    // Player must have some gold to pay
    if (!player || player.gold <= 0) {
      return {
        canExecute: false,
        validTargetCharacterIds: [],
      };
    }

    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => id !== gameData.playerID);
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
   * @param {Record<string, number|string|boolean|null>} params.args
   * @param {string} params.lang - Language code for i18n
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
        sentiment: 'negative'
      };
    }

    const player = gameData.characters.get(gameData.playerID);
    if (!player) {
      return {
        message: {
          en: "Failed: Player character not found",
          ru: "Ошибка: Персонаж игрока не найден",
          fr: "Échec : Personnage du joueur introuvable",
          de: "Fehler: Spielercharakter nicht gefunden",
          es: "Error: Personaje del jugador no encontrado",
          ja: "失敗: プレイヤーキャラクターが見つかりません",
          ko: "실패: 플레이어 캐릭터를 찾을 수 없습니다",
          pl: "Niepowodzenie: Nie znaleziono postaci gracza",
          zh: "失败: 未找到玩家角色"
        },
        sentiment: 'negative'
      };
    }

    let amount = 0;
    const raw = args?.amount;
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      amount = Math.floor(raw);
    } else {
      return {
        message: {
          en: `Failed: Invalid gold amount`,
          ru: `Ошибка: Неверное количество золота`,
          fr: `Échec : Montant d'or invalide`,
          de: `Fehler: Ungültige Goldmenge`,
          es: `Error: Cantidad de oro no válida`,
          ja: `失敗: 無効な金額`,
          ko: `실패: 잘못된 골드 양`,
          pl: `Niepowodzenie: Nieprawidłowa ilość złota`,
          zh: `失败: 无效的金币数量`
        },
        sentiment: 'negative'
      };
    }

    // Check if player has enough gold
    if (player.gold < amount) {
      return {
        message: {
          en: `Failed: ${gameData.playerName} only has ${player.gold} gold, cannot pay ${amount}`,
          ru: `Ошибка: У ${gameData.playerName} только ${player.gold} золота, нельзя заплатить ${amount}`,
          fr: `Échec : ${gameData.playerName} n'a que ${player.gold} or, ne peut pas payer ${amount}`,
          de: `Fehler: ${gameData.playerName} hat nur ${player.gold} Gold, kann ${amount} nicht zahlen`,
          es: `Error: ${gameData.playerName} solo tiene ${player.gold} oro, no puede pagar ${amount}`,
          ja: `失敗: ${gameData.playerName}は${player.gold}金しか持っていないため、${amount}金を支払えません`,
          ko: `실패: ${gameData.playerName}은(는) ${player.gold}골드만 가지고 있어 ${amount}골드를 지불할 수 없습니다`,
          pl: `Niepowodzenie: ${gameData.playerName} ma tylko ${player.gold} złota, nie może zapłacić ${amount}`,
          zh: `失败: ${gameData.playerName}只有${player.gold}金币，无法支付${amount}`
        },
        sentiment: 'negative'
      };
    }

    // Transfer gold: target gains, player (root) loses
    runGameEffect(`
global_var:votc_action_target = {
    add_gold = ${amount}
}

root = {
    remove_short_term_gold = ${amount}
}`);

    // Update local game data
    player.gold -= amount;
    targetCharacter.gold += amount;

    return {
      message: {
        en: `${gameData.playerName} paid ${amount} gold to ${targetCharacter.shortName}`,
        ru: `${gameData.playerName} заплатил ${amount} золота ${targetCharacter.shortName}`,
        fr: `${gameData.playerName} a payé ${amount} or à ${targetCharacter.shortName}`,
        de: `${gameData.playerName} zahlte ${amount} Gold an ${targetCharacter.shortName}`,
        es: `${gameData.playerName} pagó ${amount} oro a ${targetCharacter.shortName}`,
        ja: `${gameData.playerName}は${targetCharacter.shortName}に${amount}金を支払いました`,
        ko: `${gameData.playerName}은(는) ${targetCharacter.shortName}에게 ${amount}골드를 지불했습니다`,
        pl: `${gameData.playerName} zapłacił ${amount} złota ${targetCharacter.shortName}`,
        zh: `${gameData.playerName}向${targetCharacter.shortName}支付了${amount}金币`
      },
      sentiment: 'neutral'
    };
  },
};
