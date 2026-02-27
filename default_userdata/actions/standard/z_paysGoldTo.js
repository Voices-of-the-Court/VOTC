/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "paysGoldTo",
  title: {
    en: "Source Pays Gold to Target",
    ru: "Исходный персонаж платит золотом цели",
    fr: "La source paie de l'or à la cible",
    de: "Quellcharakter zahlt Gold an das Ziel",
    es: "La fuente paga oro al objetivo",
    ja: "ソースがターゲットに金を支払う",
    ko: "출처가 대상에게 골드 지급",
    pl: "Źródło płaci złoto do celu",
    zh: "向目标支付金币"
  },

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "amount",
      type: "number",
      description: `The amount of gold ${sourceCharacter.shortName} pays to the target. ${sourceCharacter.shortName} currently has ${sourceCharacter.gold} gold.`,
      required: true,
      min: 1,
      max: sourceCharacter.gold,
      step: 1
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} (who has ${sourceCharacter.gold} gold) gives gold to the target character, only if it's clear the target accepted it. The source must have enough gold to pay.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Source must have some gold to pay
    if (sourceCharacter.gold <= 0) {
      return {
        canExecute: false,
        validTargetCharacterIds: [],
      };
    }

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

    // Check if source has enough gold
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
        sentiment: 'negative'
      };
    }

    // Transfer gold: target gains, source loses
    runGameEffect(`
global_var:votc_action_target = {
    add_gold = ${amount}
}

global_var:votc_action_source = {
    remove_short_term_gold = ${amount}
}`);

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
      sentiment: 'neutral'
    };
  },
};
