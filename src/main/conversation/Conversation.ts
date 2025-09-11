import { GameData } from "../gameData/GameData";
import { Character } from "../gameData/Character";
import { parseLog } from "../gameData/parseLog";
import { v4 } from "uuid";
import { llmManager } from "../LLMManager";
import { ILLMStreamChunk, ILLMCompletionResponse } from "../llmProviders/types";
import { ConversationEntry, Message, ErrorEntry } from "./types";

export class Conversation {
    id = v4();
    messages: ConversationEntry[] = [];
    gameData!: GameData;
    isActive: boolean = false;
    nextId: number = 0;

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
    async sendMessage(userMessage: string): Promise<ConversationEntry | AsyncGenerator<ILLMStreamChunk, ConversationEntry, undefined> | null> {
        console.log('Conversation.sendMessage called with:', userMessage);
        console.log('Conversation active:', this.isActive);
        console.log('Characters in conversation:', this.gameData.characters.size);
        
        const char = this.gameData.characters.get(this.gameData.aiID)!;
        const user = this.gameData.characters.get(this.gameData.playerID)!;
        if (!this.isActive) {
            console.warn('Conversation is not active');
            return null;
        }

        if (this.gameData.characters.size === 0) {
            console.error('No characters in conversation');
            return null;
        }

        // Add user message to conversation
        const userMsg: Message = 
        {
            id: this.nextId++,
            name: user.shortName,
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
                id: this.nextId++,
                role: 'system',
                content: systemPrompt,
                datetime: new Date()
            };
            llmMessages.push({
                role: systemMsg.role,
                content: systemMsg.content
            });

            // Add conversation history
            const conversationHistory = this.getHistory().map(msg => ({
                role: msg.role,
                content: msg.content
            }))

            llmMessages.push(...conversationHistory);

            console.log('Final LLM messages array:', llmMessages.map(msg => ({
                role: msg.role,
                content: msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '')
            })));

            // Generate response
            const result = await llmManager.sendChatRequest(llmMessages);
            console.log('LLM result type:', typeof result);

            if (llmManager.getGlobalStreamSetting()) {
                // Handle streaming response
                if (typeof result === 'object' && typeof (result as any)[Symbol.asyncIterator] === 'function') {
                    const fullContent: string[] = [];

                    // Return async generator that yields chunks and returns final message
                    return (async function*(this: Conversation) {
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
                                id: (this as Conversation).nextId++,
                                role: 'assistant',
                                content: finalContent,
                                name: char?.shortName ?? 'NPC',
                                datetime: new Date()
                            };
                            (this as Conversation).messages.push(assistantMsg);
                            return assistantMsg;

                        } catch (streamingError) {
                            console.error('Error during streaming:', streamingError);
                            if (streamingError instanceof Error) {
                                const errorMsg: ErrorEntry = {
                                    id: (this as Conversation).nextId++,
                                    datetime: new Date(),
                                    content: 'Error during streaming',
                                    details: streamingError.message
                                };
                                (this as Conversation).messages.push(errorMsg);
                                throw streamingError;
                            } else {
                                const errorMsg: ErrorEntry = {
                                    id: (this as Conversation).nextId++,
                                    datetime: new Date(),
                                    content: 'Unknown error during streaming'
                                };
                                (this as Conversation).messages.push(errorMsg);
                                throw new Error('Unknown error during streaming');
                            }
                        }
                    }.bind(this))();
                } else {
                    throw new Error('Expected streaming response but got non-streaming');
                }
            } else {
                // Handle synchronous response
                console.log('LLM result:', result);

                if (result && typeof result === 'object' && 'content' in result && typeof result.content === 'string') {
                    // Add assistant message to conversation
                    const assistantMsg: Message = {
                        id: this.nextId++,
                        role: 'assistant',
                        content: result.content,
                        name: char?.shortName ?? 'NPC',
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
            console.error('Failed to get response:', error);
            const err: ErrorEntry = {
                id: this.nextId++,
                datetime: new Date(),
                content: 'Failed to get response',
                details: error instanceof Error ? error.message : String(error),
            };
            this.messages.push(err);
            return err;
        }

    }

    /**
     * Get conversation history
     */
    getHistory(): Message[] {
        return this.messages.filter(
            (entry): entry is Message => 'role' in entry
        );
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
