import { GameData } from "../gameData/GameData";
import { Character } from "../gameData/Character";
import { Message } from "./types";

export class PromptBuilder {
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
        if (gameData.characters.size === 0) {
            console.log('No characters in conversation for system prompt');
            return "You are characters in a medieval strategy game. Engage in conversation naturally.";
        }

        if (!char) {
            console.log('Primary character not found for ID:', gameData.aiID);
            return "You are characters in a medieval strategy game. Engage in conversation naturally.";
        }

        console.log('Generating system prompt for character:', char.shortName);

        let prompt = `You are ${char.fullName}, ${char.primaryTitle} in a medieval strategy game.

## Current Scene:
${gameData.scene}

## Character Background:
- Name: ${char.shortName}
- Age: ${char.age} years old
- Personality: ${char.personality}
- Culture: ${char.culture}, Faith: ${char.faith}
- Sexuality: ${char.sexuality}
${char.liege ? `- Liege: ${char.liege}` : ''}
${char.consort ? `- Consort: ${char.consort}` : ''}

## Traits and Personality:
${char.traits.map(trait => `- ${trait.category}: ${trait.name} - ${trait.desc}`).join('\n') || 'None specific'}

## Current Situation:
- Gold: ${char.gold} gold coins
- Opinion of Player: ${char.opinionOfPlayer}/100
${char.isRuler ? '- Ruler status' : '- Not a ruler'}
${char.isIndependentRuler ? '- Independent ruler' : ''}
${char.capitalLocation ? `- Rules from: ${char.capitalLocation}` : ''}

## Key Relationships:
${char.relationsToPlayer.map(rel => `- ${rel}`).join('\n') || 'None noted'}

Other characters in this conversation:
${Array.from(gameData.characters.values()).map(c => `- ${c.shortName}`).filter(c => c !== char.shortName).join('\n')}

You should respond as this character would, taking into account their personality, traits, and opinions. Be politically minded, strategic, and true to medieval courtly behavior and feudal relationships.
Characters should include phrases in their native language besides English, to make conversation more realistic.
Respond to other character's replica only if is addressed to you, alas your character would retort.
`;

        console.log('Generated system prompt:', prompt.substring(0, 200) + '...');
        return prompt;
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
        const llmMessages: any[] = [
            { role: 'system', content: systemPrompt }
        ];
        
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
        
        // Add current session summary (rolling summary for context management)
        if (currentSessionSummary) {
            llmMessages.push({
                role: 'system',
                content: `Summary of earlier messages in this conversation:\n${currentSessionSummary}`
            });
        }
        
        // Add recent message history
        llmMessages.push(
            ...history.map(m => ({ 
                role: m.role, 
                content: `${m.name}: ${m.content}` 
            }))
        );
        
        // Add instruction
        llmMessages.push({
            role: 'user',
            content: `[Write next reply only as ${char.shortName}]`
        });
        
        return llmMessages;
    }

        /**
     * Build context from character's past conversation summaries
     */
    private static buildPastSummariesContext(char: Character, gameData: GameData): string | null {
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
     * Create final comprehensive summary using ALL messages
     */
    static buildFinalSummary(history: Message[]): any[] {
        return [
            {
                role: 'system',
                content: 'You are summarizing a medieval roleplay conversation between multiple characters.'
            },
            {
                role: 'system',
                content: 'Full conversation:\n' + 
                    history.map(m => `${m.name}: ${m.content}`).join('\n')
            },
            {
                role: 'user',
                content: `Create a detailed summary of this conversation. Include:
- Key events and decisions made
- Important character interactions and relationship developments
- Plot developments and revelations
- Emotional moments and conflicts
- Any agreements, promises, or plans made`
            }
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


}