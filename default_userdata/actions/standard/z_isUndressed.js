/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
    signature: "isUndressed",
    title: "Undress Character",

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
     */
    run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect }) => {
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
                message: `${targetCharacter.shortName} is undressed`,
                sentiment: 'neutral'
            };
    },
}