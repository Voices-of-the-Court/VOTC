/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
    signature: "isUndressed",

    /**
     * @param {object} params
     * @param {Character} params.sourceCharacter
     */
    args: ({ sourceCharacter }) => [],
    description: ({ sourceCharacter }) =>
        `Execute when ${sourceCharacter.shortName} is undressed either willingly or by force.`,

    /**
     * @param {object} params
     * @param {GameData} params.gameData
     * @param {Character} params.sourceCharacter
     */
    check: ({ gameData, sourceCharacter }) => {
        return {
            canExecute: true
        }
    },

    /**
     * @param {object} params
     * @param {GameData} params.gameData
     * @param {Character} params.sourceCharacter
     * @param {Character} params.targetCharacter
     * @param {Function} params.runGameEffect
     * @param {string[]} params.args
     */
    run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect }) => {
        runGameEffect(`
global_var:votc_action_source = {
    add_character_flag = {
        flag = is_naked
        days = 1
    }
}`);
    
    
},
}