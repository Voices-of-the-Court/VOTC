//Based on Troller action


/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
    signature: "makeAlliance",
    title: {
        en: "Characters Agree On Mutual Military Alliance",
        ru: "Персонажи согласились на взаимный военный союз",
        fr: "Les personnages acceptent une alliance militaire mutuelle",
        de: "Charaktere verpflichten sich zu einer mutuellen militären Allianz",
        es: "Los personajes acuerdan una alianza militar mutua",
        ja: "文字は、相互の軍事同盟に合意しました",
        ko: "캐릭터들은 상호 군사 동맹에 동의했습니다.",
        pl: "Postaci zgadzają sie na wojenne alianje",
        zh: "缔结军事同盟",
    },
    isDestructive: true,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  args: ({ gameData, sourceCharacter }) => [],

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  description: ({ gameData, sourceCharacter }) =>
    `Execute when ${sourceCharacter.shortName} (who is a ruler) decides to make an alliance with the target character.`,
    
  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Only rulers (including unlanded) can make alliances
    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => {
      const char = gameData.characters.get(id);
      return char && char.isRuler && id !== sourceCharacter.id;
    });

    return {
      canExecute: (validTargets.length > 0 && sourceCharacter.isRuler),
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
    runGameEffect(`
global_var:votc_action_source = { 
    create_alliance = { 
        target = global_var:votc_action_target 
        allied_through_owner = global_var:votc_action_source
        allied_through_target = global_var:votc_action_target
    } 
}
global_var:votc_action_target = {
    add_opinion = {
        modifier = perk_negotiated_alliance_opinion
        target = global_var:votc_action_source
    }
}
    `);
    return {
      message: {
        en: `${sourceCharacter.shortName} and ${targetCharacter.shortName} agreed on a mutual military alliance`,
        ru: `${sourceCharacter.shortName} и ${targetCharacter.shortName} согласились на взаимный военный союз`,
        fr: `${sourceCharacter.shortName} et ${targetCharacter.shortName} acceptent une alliance militaire mutuelle`,
        de: `${sourceCharacter.shortName} und ${targetCharacter.shortName} verpflichten sich zu einer mutuellen militären Allianz`,
        es: `${sourceCharacter.shortName} y ${targetCharacter.shortName} acuerdan una alianza militar mutua`,
        ja: `${sourceCharacter.shortName} と ${targetCharacter.shortName} は、相互の軍事同盟に合意しました`,
        ko: `${sourceCharacter.shortName} 와 ${targetCharacter.shortName}는 상호 군사 동맹에 동의했습니다.`,
        pl: `${sourceCharacter.shortName} i ${targetCharacter.shortName} zgadzają sie na wojenne alianje`,
        zh: `${sourceCharacter.shortName}和${targetCharacter.shortName}达成了军事同盟`,
        
      },
      sentiment: "positive"
    };
  },
};
