import { GameData, Memory } from "../gameData/GameData";
import { Character } from "../gameData/Character";
import { Message } from "./types";
import { TemplateEngine } from "./TemplateEngine";
import { PromptScriptLoader } from "./PromptScriptLoader";
import { settingsRepository } from "../SettingsRepository";
import { promptConfigManager } from "./PromptConfigManager";

export class PromptBuilder {
        private static templateEngine = new TemplateEngine();
        private static scriptLoader = new PromptScriptLoader();
        /**
     * Build prompt for resummarization
     */
    static buildResummarizePrompt(
        messagesToSummarize: Message[],
        existingSummary?: string
    ): any[] {
        const prompt: any[] = [];
        
        if (existingSummary) {
            prompt.push({
                role: 'system',
                content: `Previous summary of this conversation:\n\n${existingSummary}`
            });
        }
        
        prompt.push({
            role: 'system',
            content: 'New messages to incorporate into the summary:\n\n' + 
                messagesToSummarize.map(m => `${m.name}: ${m.content}`).join('\n')
        });
        
        prompt.push({
            role: 'user',
            content: existingSummary 
                ? 'Update the previous summary by incorporating the new messages. Create a cohesive summary that includes both the previous events and the new information. Keep it concise but preserve important details like character names, key events, decisions, and emotional moments. Please summarize the conversation into a single paragraph.'
                : 'Create a concise summary of these messages. Preserve important details like character names, key events, decisions, relationship developments, and emotional moments. Keep it brief but informative. Please summarize the conversation into a single paragraph.'
        });
        
        return prompt;
    }

    /**
     * Generate a system prompt based on the characters in the conversation
     */
    static generateSystemPrompt(char: Character, gameData: GameData): string {
        const promptSettings = settingsRepository.getPromptSettings();
        const templatePath = promptConfigManager.resolvePath(promptSettings.systemPromptTemplate);

        if (gameData.characters.size === 0 || !char) {
            console.log('No characters or main character missing for system prompt');
            return "You are characters in a medieval strategy game. Engage in conversation naturally.";
        }

        try {
            const rendered = this.templateEngine.renderTemplate(templatePath, {
                character: char,
                gameData
            });
            return rendered;
        } catch (error) {
            console.error('Failed to render system template, using fallback:', error);
        }

        return "You are characters in a medieval strategy game. Engage in conversation naturally.";
    }

    /**
     * Build the full LLM messages array for a character response
     */
    // static buildMessages(history: Message[], char: Character, gameData: GameData): any[] {
    //     const systemPrompt = this.generateSystemPrompt(char, gameData);
    //     const llmMessages: any[] = [
    //         { role: 'system', content: systemPrompt },
    //         ...history.map(m => ({ role: m.role, content: `${m.name}: ${m.content}` })),
    //         { role: 'user', content: `[Write next reply only as ${char.shortName}]`}
    //     ];
    //     return llmMessages;
    // }


    static buildMessages(
        history: Message[], 
        char: Character, 
        gameData: GameData,
        currentSessionSummary?: string
    ): any[] {
        const systemPrompt = this.generateSystemPrompt(char, gameData);
        const promptSettings = settingsRepository.getPromptSettings();
        const descScriptPath = promptConfigManager.resolvePath(promptSettings.characterDescriptionScript);
        const examplesScriptPath = promptConfigManager.resolvePath(promptSettings.exampleMessagesScript);
        
        console.log('Building messages for character', char.id, 'with system prompt:', systemPrompt);
        let descriptionBlock = '';
        let exampleMessages: any[] = [];

        try {
            descriptionBlock = this.scriptLoader.executeDescription(descScriptPath, gameData, char.id);
        } catch (error) {
            console.error('Failed to run description script:', error);
        }

        try {
            exampleMessages = this.scriptLoader.executeExamples(examplesScriptPath, gameData, char.id);
        } catch (error) {
            console.error('Failed to run example script:', error);
        }

        const llmMessages: any[] = [
            { role: 'system', content: systemPrompt }
        ];

        if (exampleMessages.length > 0) {
            llmMessages.push(...exampleMessages);
        }
        
        // Add character's past conversation summaries (long-term memory)
        if (char.conversationSummaries && char.conversationSummaries.length > 0) {
            const pastSummaries = this.buildPastSummariesContext(char, gameData);
            if (pastSummaries) {
                llmMessages.push({
                    role: 'system',
                    content: pastSummaries
                });
            }
        }

        const workingHistory: any[] = [
            ...history.map(m => ({
                role: m.role,
                name: m.name,
                content: m.content
            }))
        ];

        // Drop empty placeholders that are still streaming or blank
        for (let i = workingHistory.length - 1; i >= 0; i--) {
            const msg = workingHistory[i];
            if (!msg.content) {
                workingHistory.splice(i, 1);
            }
        }

        // Insert description/persona
        if (descriptionBlock) {
            this.insertMessageAtDepth(workingHistory, { role: 'system', content: descriptionBlock }, promptSettings.descInsertDepth);
        }

        // Insert memories
        const memoriesBlock = this.buildMemoriesBlock(gameData);
        if (memoriesBlock) {
            this.insertMessageAtDepth(workingHistory, { role: 'system', content: memoriesBlock }, promptSettings.memoriesInsertDepth);
        }

        // Insert rolling summary
        if (currentSessionSummary) {
            this.insertMessageAtDepth(workingHistory, { role: 'system', content: `Summary of earlier messages in this conversation:\n${currentSessionSummary}` }, promptSettings.summariesInsertDepth);
        }

        // Add recent message history
        llmMessages.push(
            ...workingHistory.map(m => ({ 
                role: m.role, 
                content: m.name ? `${m.name}: ${m.content}` : m.content
            }))
        );
        
        // Add instruction
        llmMessages.push({
            role: 'user',
            content: `[Write next reply only as ${char.fullName}]`
        });

        if (promptSettings.enableSuffixPrompt && promptSettings.suffixPrompt) {
            llmMessages.push({
                role: 'system',
                content: promptSettings.suffixPrompt
            });
        }
        
        return llmMessages;
    }

        /**
     * Build context from character's past conversation summaries
     */
    static buildPastSummariesContext(char: Character, gameData: GameData): string | null {
        if (!char.conversationSummaries || char.conversationSummaries.length === 0) {
            return null;
        }
        
        let context = `Here are the date and summary of previous conversations between ${char.shortName}, ${gameData.playerName}, and other characters:\n`;
        
        // Include most recent 3-5 conversation summaries
        const recentSummaries = char.conversationSummaries.slice(0, 5);
        
        for (const summary of recentSummaries) {
            const timeAgo = this.getRelativeTime(summary.totalDays, gameData.totalDays);
            if (!timeAgo) {
                context += `${summary.date}: ${summary.content}\n`;
            }
            else {
                context += `${summary.date} (${timeAgo}): ${summary.content}\n`;
            }
        }
        
        return context;
    }

/**
 * Build a final, comprehensive summary using all roleplay messages.
 */
static buildFinalSummary(
    gameData: GameData,
    history: Message[],
    currentSummary?: string,
    lastSummarizedMessageIndex?: number
): any[] {
    const characters = Array.from(gameData.characters.values())
        .map(c => c.shortName)
        .join(', ');

    const baseSystem = {
        role: 'system',
        content: `You are summarizing a medieval roleplay conversation between these characters: ${characters}.`
    };

    const buildConversationText = (msgs: Message[], title: string) => ({
        role: 'system',
        content: `${title}\n` + msgs.map(m => `${m.name}: ${m.content}`).join('\n')
    });

    const userPrompt = {
        role: 'user',
        content: `Create a detailed summary of this conversation. Include:
- Key events and decisions made
- Important character interactions and relationship developments
- Plot developments and revelations
- Emotional moments and conflicts
- Any agreements, promises, or plans made
Please summarize the conversation into only a single paragraph.`
    };

    // Determine whether to include all messages or only the new ones
    if (lastSummarizedMessageIndex == null) {
        return [
            baseSystem,
            buildConversationText(history, 'Full conversation:'),
            userPrompt
        ];
    }

    const newMessages = history.slice(lastSummarizedMessageIndex);
    return [
        baseSystem,
        { role: 'system', content: 'Previous summary of this conversation:\n' + currentSummary },
        buildConversationText(newMessages, 'Recent conversation:'),
        userPrompt
    ];
}


    /**
     * Calculate relative time between dates
     */
    private static getRelativeTime(pastDateTotalDays: number, currentDateTotalDays: number): string | null {
        // check if pastDatrTotal is undefined
        if (pastDateTotalDays === undefined) {
            return null;
        }
        const timeDifference = currentDateTotalDays - pastDateTotalDays;

        if (timeDifference < 1) {
            return 'less than a day ago';
        }

        if (timeDifference < 7) {
            return `${timeDifference} days ago`;
        }

        if (timeDifference < 30) {
            return `${Math.floor(timeDifference / 7)} weeks ago`;
        }

        if (timeDifference < 365) {
            return `${Math.floor(timeDifference / 30)} months ago`;
        }

        return `${Math.floor(timeDifference / 365)} years ago`;
    }

    private static insertMessageAtDepth(messages: any[], messageToInsert: any, insertDepth: number): void {
        if (messages.length < insertDepth) {
            messages.splice(0, 0, messageToInsert);
        } else {
            messages.splice(messages.length - insertDepth + 1, 0, messageToInsert);
        }
    }

    private static buildMemoriesBlock(gameData: GameData): string | null {
        const allMemories: Memory[] = [];
        gameData.characters.forEach((value) => {
            if (value?.memories) {
                allMemories.push(...value.memories);
            }
        });
        if (allMemories.length === 0) return null;
        const sorted = allMemories.sort((a, b) => (b.relevanceWeight ?? 0) - (a.relevanceWeight ?? 0));
        const selected = sorted.slice(0, 5);
        const lines = selected.map(m => `${m.creationDate}: ${m.desc}`);
        return `Relevant memories:\n${lines.join('\n')}`;
    }


}
