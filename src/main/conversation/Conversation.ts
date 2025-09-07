import { GameData } from "../gameData/GameData";
import { Character } from "../gameData/Character";
import { parseLog } from "../gameData/parseLog";
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
    gameData!: GameData;
    isActive: boolean = false;

    constructor() {
        this.initializeGameData();
    }

    private async initializeGameData(): Promise<void> {
        try {
            this.gameData = await parseLog(llmManager.getCK3DebugLogPath()!);
            console.log('GameData initialized with', this.gameData.characters.size, 'characters');
            this.isActive = true;
        } catch (error) {
            console.error('Failed to parse log file:', error);
            this.isActive = false;
        }
    }

    /**
     * Generate a system prompt based on the characters in the conversation
     */
    private generateSystemPrompt(char: Character): string {
        if (this.gameData.characters.size === 0) {
            console.log('No characters in conversation for system prompt');
            return "You are characters in a medieval strategy game. Engage in conversation naturally.";
        }

        // const char = this.gameData.characters.get(this.gameData.aiID)!;
        if (!char) {
            console.log('Primary character not found for ID:', this.gameData.aiID);
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
        console.log('Characters in conversation:', this.gameData.characters.size);
        
        const char = this.gameData.characters.get(this.gameData.aiID)!;

        if (!this.isActive) {
            console.warn('Conversation is not active');
            return null;
        }

        if (this.gameData.characters.size === 0) {
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

        try {
            // Prepare messages for LLM (include system prompt if first message)
            const llmMessages: any[] = [];

            console.log('DEBUG: Current messages length:', this.messages.length);
            console.log('DEBUG: Including system prompt in LLM request');

            // Always include system prompt for character awareness
            const systemPrompt = this.generateSystemPrompt(char);
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
                                name: char?.shortName || 'NPC',
                                datetime: new Date()
                            };
                            this.messages.push(assistantMsg);
                            return assistantMsg;

                        } catch (streamingError) {
                            console.error('Error during streaming:', streamingError);
                            const errorMsg: Message = {
                                role: 'assistant',
                                content: `Error: ${streamingError instanceof Error ? streamingError.message : 'Unknown error during streaming'}`,
                                name: char?.shortName || 'NPC',
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
                        name: char?.shortName || 'NPC',
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
}