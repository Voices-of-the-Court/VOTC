/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
    signature: "leavesConversation",
    title: "Character Leaves Conversation",
    isDestructive: true,
  
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
        `Execute when target character is leaving the conversation.`,

    /**
     * @param {object} params
     * @param {GameData} params.gameData
     * @param {Character} params.sourceCharacter
     */
    check: ({ gameData, sourceCharacter }) => {
        // Get all characters except the player
        const allIds = Array.from(gameData.characters.keys());
        const validTargets = allIds.filter((id) => id !== gameData.playerID);
        
        return {
            canExecute: validTargets.length > 0,
            validTargetCharacterIds: validTargets
        };
    },

    /**
     * @param {object} params
     * @param {GameData} params.gameData
     * @param {Character} params.sourceCharacter
     * @param {Character} params.targetCharacter
     * @param {Function} params.runGameEffect
     * @param {Record<string, number|string|null>} params.args
     * @param {Conversation} params.conversation
     */
    run: async ({ gameData, sourceCharacter, targetCharacter, runGameEffect, conversation }) => {
        if (!targetCharacter) {
            return {
                message: "Failed: No character specified to leave",
                sentiment: 'negative'
            };
        }

        if (!conversation) {
            return {
                message: "Failed: No active conversation",
                sentiment: 'negative'
            };
        }

        try {
            // Get all conversation messages
            const allMessages = conversation.getHistory();
            
            // Build summary prompt for the leaving character
            const summaryPrompt = [
                {
                    role: 'system',
                    content: `You are summarizing a conversation from the perspective of ${targetCharacter.fullName} who is leaving the conversation. Focus on their experiences, interactions, and key events they participated in. The summary should be comprehensive but concise, written from their point of view.`
                },
                // Include current rolling summary if it exists
                ...(conversation.currentSummary ? [{
                    role: 'system',
                    content: `Previous summary of this conversation:\n\n${conversation.currentSummary}`
                }] : []),
                {
                    role: 'system',
                    content: `Full conversation:\n` + allMessages.map(m => `${m.name}: ${m.content}`).join('\n')
                },
                {
                    role: 'user',
                    content: `Create a comprehensive summary of this conversation from ${targetCharacter.fullName}'s perspective. Include their interactions with ${gameData.playerName} and other characters, key events they participated in, and their overall experience. This summary will be saved as their personal record of this conversation.`
                }
            ];

            // Generate summary for leaving character
            const summary = await conversation.createCharacterLeavingSummary(targetCharacter.id, summaryPrompt);
            
            if (summary) {
                // Save summary to character's file
                gameData.saveCharacterSummary(targetCharacter.id, {
                    date: gameData.date,
                    totalDays: gameData.totalDays,
                    content: summary
                });
            }
            
            // Remove character from conversation
            conversation.removeCharacterFromConversation(targetCharacter.id);
            
            // Empty game effect (for debugging purposes)
            runGameEffect(`
remove_list_global_variable = {
    name = mcc_characters_list_v2
    target = global_var:votc_action_target
}
if = {
    limit = { 
        global_variable_list_size = {
            name = mcc_characters_list_v2
            value > 0
        }
    }
    ordered_in_global_list = {
        variable = mcc_characters_list_v2
        position = 0
        set_global_variable = {
            name = mcc_character_0
            value = this
        }
    }
}
if = {
    limit = { 
        global_variable_list_size = {
            name = mcc_characters_list_v2
            value > 1
        }
    }
    ordered_in_global_list = {
        variable = mcc_characters_list_v2
        position = 1
        set_global_variable = {
            name = mcc_character_1
            value = this
        }
    }
}
if = {
    limit = { 
        global_variable_list_size = {
            name = mcc_characters_list_v2
            value > 2
        }
    }
    ordered_in_global_list = {
        variable = mcc_characters_list_v2
        position = 2
        set_global_variable = {
            name = mcc_character_2
            value = this
        }
    }
}
if = {
    limit = { 
        global_variable_list_size = {
            name = mcc_characters_list_v2
            value > 3
        }
    }
    ordered_in_global_list = {
        variable = mcc_characters_list_v2
        position = 3
        set_global_variable = {
            name = mcc_character_3
            value = this
        }
    }
}
if = {
    limit = { 
        global_variable_list_size = {
            name = mcc_characters_list_v2
            value > 4
        }
    }
    ordered_in_global_list = {
        variable = mcc_characters_list_v2
        position = 4
        set_global_variable = {
            name = mcc_character_4
            value = this
        }
    }
}
if = {
    limit = { 
        global_variable_list_size = {
            name = mcc_characters_list_v2
            value > 5
        }
    }
    ordered_in_global_list = {
        variable = mcc_characters_list_v2
        position = 5
        set_global_variable = {
            name = mcc_character_5
            value = this
        }
    }
}
                `);
            
            return {
                message: `${targetCharacter.shortName} has left the conversation`,
                sentiment: 'neutral'
            };
        } catch (error) {
            console.error('Failed to process character leaving:', error);
            return {
                message: `Failed to process ${targetCharacter.shortName} leaving: ${error.message || error}`,
                sentiment: 'negative'
            };
        }
    },
}