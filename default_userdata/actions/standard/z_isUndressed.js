/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
    signature: "isUndressed",
    title: {
        en: "Undress Character",
        ru: "Раздеть персонажа",
        fr: "Déshabiller le personnage",
        de: "Charakter entkleiden",
        es: "Desnudar personaje",
        ja: "キャラクターを脱がす",
        ko: "캐릭터 옷 벗기기",
        pl: "Rozbierz postać",
        zh: "脱掉角色衣服"
    },

    /**
     * @param {object} params
     * @param {Character} params.sourceCharacter
     */
    args: ({ sourceCharacter }) => [],

    /**
     * @param {object} params
     * @param {Character} params.sourceCharacter
     */
    description: ({ sourceCharacter }) =>
        `Execute when target character is to be undressed (naked). Can target self or another character.`,

    /**
     * @param {object} params
     * @param {GameData} params.gameData
     * @param {Character} params.sourceCharacter
     */
    check: ({ gameData, sourceCharacter }) => {
        // Allow undressing self (no target) or any other character
        const allIds = Array.from(gameData.characters.keys());
        // const validTargets = allIds.filter((id) => id !== sourceCharacter.id);
        return {
            canExecute: true,
            validTargetCharacterIds: allIds
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
    run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, lang = "en" }) => {
        if (!targetCharacter) return;

        // Undress the target character
        runGameEffect(`
global_var:votc_action_target = {
    add_character_flag = {
        flag = is_naked
        days = 1
    }
}`);
        return {
            message: {
                en: `${targetCharacter.shortName} is undressed`,
                ru: `${targetCharacter.shortName} раздет`,
                fr: `${targetCharacter.shortName} est déshabillé`,
                de: `${targetCharacter.shortName} ist entkleidet`,
                es: `${targetCharacter.shortName} está desnudo`,
                ja: `${targetCharacter.shortName}は裸です`,
                ko: `${targetCharacter.shortName}은(는) 벌거벗었습니다`,
                pl: `${targetCharacter.shortName} jest rozebrany`,
                zh: `${targetCharacter.shortName}没穿衣服`
            },
            sentiment: 'neutral'
        };
    },
}