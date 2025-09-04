import { GameData } from "../gameData/GameData";
import { Character } from "../gameData/Character";
import { v4 } from "uuid";
import { llmManager } from "../LLMManager";
import { ILLMStreamChunk, ILLMCompletionResponse } from "../llmProviders/types";

export interface Message {
    role: 'system' | 'user' | 'assistant';
    name?: string;
    content: string;
    datetime: Date;
}

export interface ErrorMessage {
    text: string,
}

export class Conversation {
    id = v4();
    messages: Message[] = [];
    characters: Map<number, Character> = new Map();
    playerId: number | null = null;
    isActive: boolean = false;

    constructor(characters?: Character[], playerId?: number) {
        if (characters && characters.length > 0) {
            characters.forEach(char => {
                this.characters.set(char.id, char);
            });
    }

        if (playerId !== undefined) {
            this.playerId = playerId;
        }
        this.isActive = characters && characters.length > 0;
    }

    /**
     * Generate a system prompt based on the characters in the conversation
     */
    private generateSystemPrompt(): string {
        if (this.characters.size === 0) {
            console.log('No characters in conversation for system prompt');
            return "You are characters in a medieval strategy game. Engage in conversation naturally.";
        }

        // Assume first character is the primary NPC for now
        const primaryCharId = this.characters.keys().next().value;
        if (!primaryCharId) {
            console.log('No primary character ID found');
            return "You are characters in a medieval strategy game. Engage in conversation naturally.";
        }

        const char = this.characters.get(primaryCharId);
        if (!char) {
            console.log('Primary character not found for ID:', primaryCharId);
            return "You are characters in a medieval strategy game. Engage in conversation naturally.";
        }

        console.log('Generating system prompt for character:', char.shortName);

        let prompt = `You are ${char.fullName}, ${char.primaryTitle} in a medieval strategy game.

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

You should respond as this character would, taking into account their personality, traits, and opinions. Be politically minded, strategic, and true to medieval courtly behavior and feudal relationships.`;

        console.log('Generated system prompt:', prompt.substring(0, 200) + '...');
        return prompt;
    }

    /**
     * Send a user message and get AI response
     */
    async sendMessage(userMessage: string, streaming: boolean = false): Promise<Message | AsyncGenerator<ILLMStreamChunk, Message, undefined> | null> {
        console.log('Conversation.sendMessage called with:', userMessage, 'streaming:', streaming);
        console.log('Conversation active:', this.isActive);
        console.log('Characters in conversation:', this.characters.size);

        if (!this.isActive) {
            console.warn('Conversation is not active');
            return null;
        }

        if (this.characters.size === 0) {
            console.error('No characters in conversation');
            return null;
        }

        // Add user message to conversation
        const userMsg: Message = {
            role: 'user',
            content: userMessage,
            datetime: new Date()
        };
        this.messages.push(userMsg);

        // Get primary character for naming (for demo purposes - will be replaced with individual characters)
        const primaryCharId = this.characters.keys().next().value;
        const primaryChar = primaryCharId ? this.characters.get(primaryCharId) : null;

        try {
            // Prepare messages for LLM (include system prompt if first message)
            const llmMessages: any[] = [];

            if (this.messages.length === 1) {
                // Add system prompt for first message
                const systemPrompt = this.generateSystemPrompt();
                console.log('Adding system prompt:', systemPrompt.substring(0, 100) + '...');
                const systemMsg: Message = {
                    role: 'system',
                    content: systemPrompt,
                    datetime: new Date()
                };
                llmMessages.push({
                    role: systemMsg.role,
                    content: systemMsg.content
                });
            }

            // Add conversation history
            const conversationHistory = this.messages.slice(-10).map(msg => ({
                role: msg.role,
                content: msg.content,
                ...(msg.name && { name: msg.name })
            }));

            llmMessages.push(...conversationHistory);

            console.log('Final LLM messages array:', llmMessages.map(msg => ({
                role: msg.role,
                content: msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '')
            })));

            // Generate response
            const requestId = v4();
            console.log('LLM request ID:', requestId);
            const result = await llmManager.sendChatRequest(llmMessages, {}, streaming);
            console.log('LLM result type:', typeof result);

            if (streaming) {
                // Handle streaming response
                if (typeof result === 'object' && typeof (result as any)[Symbol.asyncIterator] === 'function') {
                    const fullContent: string[] = [];

                    // Return async generator that yields chunks and returns final message
                    return (async function*() {
                        try {
                            for await (const chunk of result as AsyncGenerator<ILLMStreamChunk, ILLMCompletionResponse | void, undefined>) {
                                if (chunk.delta?.content) {
                                    fullContent.push(chunk.delta.content);
                                }
                                yield chunk;
                            }

                            // Create and add the final assistant message to conversation
                            const finalContent = fullContent.join('');
                            const assistantMsg: Message = {
                                role: 'assistant',
                                content: finalContent,
                                name: primaryChar?.shortName || 'NPC',
                                datetime: new Date()
                            };
                            this.messages.push(assistantMsg);
                            return assistantMsg;

                        } catch (streamingError) {
                            console.error('Error during streaming:', streamingError);
                            const errorMsg: Message = {
                                role: 'assistant',
                                content: `Error: ${streamingError instanceof Error ? streamingError.message : 'Unknown error during streaming'}`,
                                name: primaryChar?.shortName || 'NPC',
                                datetime: new Date()
                            };
                            this.messages.push(errorMsg);
                            return errorMsg;
                        }
                    }.bind(this))();
                } else {
                    throw new Error('Expected streaming response but got non-streaming');
                }
            } else {
                // Handle synchronous response
                console.log('LLM result:', result);

                if (result && typeof result === 'object' && 'content' in result) {
                    // Add assistant message to conversation
                    const assistantMsg: Message = {
                        role: 'assistant',
                        content: result.content,
                        name: primaryChar?.shortName || 'NPC',
                        datetime: new Date()
                    };
                    this.messages.push(assistantMsg);
                    return assistantMsg;
                } else {
                    console.error('Unexpected non-streaming response format:', result);
                    return null;
                }
            }

        } catch (error) {
            console.error('Error sending message:', error);
            return null;
        }
    }

    /**
     * Get conversation history
     */
    getHistory(): Message[] {
        return [...this.messages];
    }

    /**
     * Clear conversation history
     */
    clearHistory(): void {
        this.messages = [];
    }

    /**
     * End conversation
     */
    end(): void {
        this.isActive = false;
        this.clearHistory();
    }

    /**
     * Create demo NPC character for testing
     */
    static createDemoNPC(): Character {
        const demoData = [
            "1234", // ID
            "Lord Alaric", // shortName
            "Lord Alaric Thorne, Duke of Ironvale", // fullName
            "Duke", // primaryTitle
            "he", // sheHe
            "47", // age
            "1500", // gold
            "65", // opinionOfPlayer
            "heterosexual", // sexuality
            "scheming and ambitious", // personality
            "7", // greed
            "1", // isIndependentRuler
            "King Roland", // liege
            "Lady Elara", // consort
            "English", // culture
            "Catholic", // faith
            "House Thorne", // house
            "1", // isRuler
            "Alaric", // firstName
            "Castle Ironvale", // capitalLocation
            "Emperor Maximilian", // topLiege
            "15", // prowess
            "0", // isKnight
            "Crown Authority", // liegeRealmLaw
            "1", // isLandedRuler
            "Marshal and Steward", // heldCourtAndCouncilPositions
            "duke" // titleRankConcept
        ];

        const demoChar = new Character(demoData);

        // Add demo traits
        demoChar.addTrait({
            category: "Education",
            name: "Administrator",
            desc: "Excellent at managing court and territory"
        });
        demoChar.addTrait({
            category: "Personality",
            name: "Ambitious",
            desc: "Always seeking ways to advance in power"
        });
        demoChar.addTrait({
            category: "Personality",
            name: "Intrigue",
            desc: "Skilled at courtly intrigue and scheming"
        });

        return demoChar;
    }
}