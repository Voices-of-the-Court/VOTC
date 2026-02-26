/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
    signature: "leavesConversation",
    title: {
        en: "Character Leaves Conversation",
        ru: "Персонаж уходит из разговора",
        fr: "Le personnage quitte la conversation",
        de: "Charakter verlässt das Gespräch",
        es: "El personaje abandona la conversación",
        ja: "キャラクターが会話を離れる",
        ko: "캐릭터가 대화를 떠남",
        pl: "Postać opuszcza rozmowę",
        zh: "角色离开对话"
    },
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
            canExecute: validTargets.length > 1,
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
     * @param {boolean} params.dryRun
     * @param {string} params.lang - Language code for i18n
     */
    run: async ({ gameData, sourceCharacter, targetCharacter, runGameEffect, conversation, dryRun, lang = "en" }) => {
        if (!targetCharacter) {
            return {
                message: {
                    en: "Failed: No character specified to leave",
                    ru: "Ошибка: Не указан персонаж для ухода",
                    fr: "Échec : Aucun personnage spécifié pour partir",
                    de: "Fehler: Kein Charakter zum Verlassen angegeben",
                    es: "Error: No se especificó ningún personaje para salir",
                    ja: "失敗: 離れるキャラクターが指定されていません",
                    ko: "실패: 떠날 캐릭터가 지정되지 않았습니다",
                    pl: "Niepowodzenie: Nie określono postaci do wyjścia",
                    zh: "失败: 未指定要离开的角色"
                },
                sentiment: 'negative'
            };
        }

        if (!conversation) {
            return {
                message: {
                    en: "Failed: No active conversation",
                    ru: "Ошибка: Нет активного разговора",
                    fr: "Échec : Aucune conversation active",
                    de: "Fehler: Kein aktives Gespräch",
                    es: "Error: No hay conversación activa",
                    ja: "失敗: アクティブな会話がありません",
                    ko: "실패: 활성 대화가 없습니다",
                    pl: "Niepowodzenie: Brak aktywnej rozmowy",
                    zh: "失败: 没有活动的对话"
                },
                sentiment: 'negative'
            };
        }

        // If this is a dry run (preview), just return the preview message
        if (dryRun) {
            return {
                message: {
                    en: `${targetCharacter.shortName} will leave the conversation`,
                    ru: `${targetCharacter.shortName} уйдет из разговора`,
                    fr: `${targetCharacter.shortName} quittera la conversation`,
                    de: `${targetCharacter.shortName} wird das Gespräch verlassen`,
                    es: `${targetCharacter.shortName} abandonará la conversación`,
                    ja: `${targetCharacter.shortName}は会話を離れます`,
                    ko: `${targetCharacter.shortName}은(는) 대화를 떠날 것입니다`,
                    pl: `${targetCharacter.shortName} opuści rozmowę`,
                    zh: `${targetCharacter.shortName}将离开对话`
                },
                sentiment: 'neutral'
            };
        }

        // Actual execution (only when approved)
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
            
            runGameEffect(`
remove_list_global_variable = {
    name = mcc_characters_list_v2
    target = global_var:votc_action_target
}
if ={
    limit = {
        global_var:mcc_character_0 = global_var:votc_action_target
    }
    remove_global_variable = mcc_character_0
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
                name = mcc_character_0
                value = this
            }
        }
    }
}
if ={
    limit = {
        global_var:mcc_character_1 = global_var:votc_action_target
    }
    remove_global_variable = mcc_character_1
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
                name = mcc_character_1
                value = this
            }
        }
    }
}
if ={
    limit = {
        global_var:mcc_character_2 = global_var:votc_action_target
    }
    remove_global_variable = mcc_character_2   
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
                name = mcc_character_2
                value = this
            }
        }
    }
}
if ={
    limit = {
        global_var:mcc_character_3 = global_var:votc_action_target
    }
    remove_global_variable = mcc_character_3
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
                name = mcc_character_3
                value = this
            }
        }
    }
}
if ={
    limit = {
        global_var:mcc_character_4 = global_var:votc_action_target
    }
    remove_global_variable = mcc_character_4   
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
                name = mcc_character_4
                value = this
            }
        }
    }
}
if ={
    limit = {
        global_var:mcc_character_5 = global_var:votc_action_target
    }
    remove_global_variable = mcc_character_5
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
}`);

                
            // Generate summary for leaving character
            console.log(`[leavesConversation] Starting summary generation for ${targetCharacter.fullName}`);
            const summary = await conversation.createCharacterLeavingSummary(targetCharacter.id, summaryPrompt);
            console.log(`[leavesConversation] Summary generation completed, summary exists: ${!!summary}`);
            
            if (summary) {
                // Save summary to character's file
                console.log(`[leavesConversation] Saving summary for ${targetCharacter.fullName}`);
                gameData.saveCharacterSummary(targetCharacter.id, {
                    date: gameData.date,
                    totalDays: gameData.totalDays,
                    content: summary
                });
                console.log(`[leavesConversation] Summary saved successfully`);
            }
            
            // Remove character from conversation
            console.log(`[leavesConversation] Removing ${targetCharacter.fullName} from conversation`);
            conversation.removeCharacterFromConversation(targetCharacter.id);
            console.log(`[leavesConversation] Character removed successfully`);

            const feedbackMessage = {
                message: {
                    en: `${targetCharacter.shortName} has left the conversation`,
                    ru: `${targetCharacter.shortName} ушел из разговора`,
                    fr: `${targetCharacter.shortName} a quitté la conversation`,
                    de: `${targetCharacter.shortName} hat das Gespräch verlassen`,
                    es: `${targetCharacter.shortName} ha abandonado la conversación`,
                    ja: `${targetCharacter.shortName}は会話を離れました`,
                    ko: `${targetCharacter.shortName}은(는) 대화를 떠났습니다`,
                    pl: `${targetCharacter.shortName} opuścił rozmowę`,
                    zh: `${targetCharacter.shortName}已经离开了对话`
                },
                sentiment: 'neutral'
            };
            console.log(`[leavesConversation] Returning feedback:`, feedbackMessage);
            return feedbackMessage;
        } catch (error) {
            console.error('Failed to process character leaving:', error);
            return {
                message: `Failed to process ${targetCharacter.shortName} leaving: ${error.message || error}`,
                sentiment: 'negative'
            };
        }
    },
}