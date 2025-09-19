import { GameData } from "../gameData/GameData";
import { Character } from "../gameData/Character";
import { parseLog } from "../gameData/parseLog";
import { v4 } from "uuid";
import { llmManager } from "../LLMManager";
import { ILLMStreamChunk, ILLMCompletionResponse } from "../llmProviders/types";
import { ConversationEntry, Message, createError, createMessage } from "./types";
import { EventEmitter } from "events";

export class Conversation {
    id = v4();
    messages: ConversationEntry[] = [];
    gameData!: GameData;
    isActive: boolean = false;
    nextId: number = 0;
    private eventEmitter: EventEmitter;

    constructor() {
        this.eventEmitter = new EventEmitter();
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
     * Get list of all NPCs (characters except the player)
     */
    private getNpcList(): Character[] {
        return [...this.gameData.characters.values()]
            .filter(c => c.id !== this.gameData.playerID);
    }

    /**
     * Handle response for a single NPC
     */
    private async respondAs(npc: Character, history: Message[]): Promise<void> {
        const systemPrompt = this.generateSystemPrompt(npc);
        const llmMessages: any[] = [
            { role: 'system', content: systemPrompt },
            ...history.map(m => ({ role: m.role, content: `${m.name}: ${m.content}` }))
        ];

        const msgId = this.nextId++;
        const placeholder = createMessage({
            id: msgId,
            role: 'assistant',
            name: npc.fullName,
            content: '',
            isStreaming: true
        });
        this.messages.push(placeholder);
        this.emitUpdate();

        try {
            const result = await llmManager.sendChatRequest(llmMessages);

            if (llmManager.getGlobalStreamSetting() &&
                typeof result === 'object' &&
                typeof (result as any)[Symbol.asyncIterator] === 'function') {
                // Handle streaming response
                for await (const chunk of result as AsyncGenerator<ILLMStreamChunk, ILLMCompletionResponse | void>) {
                    if (chunk.delta?.content) {
                        placeholder.content += chunk.delta.content;
                        this.emitUpdate();
                    }
                }
                placeholder.isStreaming = false;
                // this.emitUpdate();
            } else if (result && typeof result === 'object' && 'content' in result && typeof result.content === 'string') {
                // Handle synchronous response
                placeholder.content = result.content;
                placeholder.isStreaming = false;
                this.emitUpdate();
            } else {
                throw new Error('Bad LLM response format');
            }
        } catch (error) {
            console.error('Failed to get response for', npc.shortName, ':', error);
            
            // Remove the placeholder message
            this.messages = this.messages.filter(msg => msg.id !== msgId);
            
            const err = createError({
                id: this.nextId++,
                content: `Failed to get response from ${npc.shortName}`,
                details: error instanceof Error ? error.message : String(error),
            });
            this.messages.push(err);
            this.emitUpdate();
        }
    }

    /**
     * Send a user message and trigger responses from all NPCs
     */
    async sendMessage(userMessage: string): Promise<void> {
        console.log('Conversation.sendMessage called with:', userMessage);
        console.log('Conversation active:', this.isActive);
        console.log('Characters in conversation:', this.gameData.characters.size);

        const user = this.gameData.characters.get(this.gameData.playerID)!;
        if (!this.isActive) {
            console.warn('Conversation is not active');
            return;
        }

        if (this.gameData.characters.size === 0) {
            console.error('No characters in conversation');
            return;
        }

        // Add user message to conversation
        const userMsg = createMessage({
            id: this.nextId++,
            name: user.fullName,
            role: 'user',
            content: userMessage,
        });
        this.messages.push(userMsg);
        this.emitUpdate();

        // Have each NPC respond sequentially
        for (const npc of this.getNpcList()) {
            await this.respondAs(npc, this.getHistory());
        }
        this.emitUpdate();
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

    /**
     * Emit conversation update event
     */
    private emitUpdate(): void {
        this.eventEmitter.emit('conversation-updated', [...this.messages]);
    }

    /**
     * Subscribe to conversation updates
     */
    onConversationUpdate(callback: (entries: ConversationEntry[]) => void): void {
        this.eventEmitter.on('conversation-updated', callback);
    }

    /**
     * Unsubscribe from conversation updates
     */
    offConversationUpdate(callback: (entries: ConversationEntry[]) => void): void {
        this.eventEmitter.off('conversation-updated', callback);
    }
}
