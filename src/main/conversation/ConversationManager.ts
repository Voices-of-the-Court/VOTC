import { Conversation } from "./Conversation";
import { ILLMStreamChunk } from "../llmProviders/types";
import { EventEmitter } from "events";
import { PromptBuilder } from "./PromptBuilder";

export class ConversationManager {
    private static instance: ConversationManager;
    private currentConversation: Conversation | null = null;
    private eventEmitter: EventEmitter;

    private constructor() {
        this.eventEmitter = new EventEmitter();
    }

    static getInstance(): ConversationManager {
        if (!ConversationManager.instance) {
            ConversationManager.instance = new ConversationManager();
        }
        return ConversationManager.instance;
    }

    private setupConversationListeners(): void {
        if (this.currentConversation) {
            this.currentConversation.onConversationUpdate((entries) => {
                // Forward conversation updates to ConversationManager listeners
                this.eventEmitter.emit('conversation-updated', entries);
            });
        }
    }

    private emitConversationUpdate(): void {
        const entries = this.getConversationEntries();
        this.eventEmitter.emit('conversation-updated', entries);
    }

    /**
     * Create a new conversation with an NPC
     */
    createConversation(): Conversation | null {
        try {
            this.endCurrentConversation();
            this.currentConversation = new Conversation();
            this.setupConversationListeners();
            return this.currentConversation;
        } catch (error) {
            console.error('Failed to create conversation:', error);
            return null;
        }
    }

    /**
     * Get the current active conversation
     */
    getCurrentConversation(): Conversation | null {
        return this.currentConversation;
    }

    /**
     * Send a message in the current conversation
     */
    async sendMessage(userMessage: string, streaming: boolean = false): Promise<any | AsyncGenerator<ILLMStreamChunk, any>> {
        console.log('ConversationManager.sendMessage called with:', userMessage, 'streaming:', streaming);
        console.log('Current conversation exists:', !!this.currentConversation);
        console.log('Current conversation active:', this.currentConversation?.isActive);

        if (!this.currentConversation) {
            console.error('No active conversation');
            throw new Error('No active conversation');
        }

        if (!this.currentConversation.isActive) {
            console.error('Current conversation is not active');
            throw new Error('Current conversation is not active');
        }

        try {
            const result = await this.currentConversation.sendMessage(userMessage);
            console.log('Conversation sendMessage returned type:', typeof result);

            // Type guard for async generator
            if (streaming && result && typeof result[Symbol.asyncIterator] === 'function') {
                console.log('Returning async generator for streaming');
                return result as AsyncGenerator<ILLMStreamChunk, any>;
            } else {
                console.log('Conversation sendMessage returned:', result);
                // Emit update for non-streaming responses
                this.emitConversationUpdate();
                return result;
            }
        } catch (error) {
            console.error('Error in ConversationManager.sendMessage:', error);
            // Emit update even on error
            this.emitConversationUpdate();
            throw error;
        }
    }

    /**
     * Get all conversation entries (messages and errors)
     */
    getConversationEntries(): any[] {
        if (!this.currentConversation) {
            return [];
        }

        return this.currentConversation.messages.map(entry => {
            if ('role' in entry) {
                // Message entry
                return {
                    type: 'message',
                    id: entry.id,
                    role: entry.role,
                    content: entry.content,
                    datetime: entry.datetime,
                    name: entry.name,
                    isStreaming: entry.isStreaming
                };
            } else if (entry.type === 'action-feedback') {
                // Action feedback entry
                return {
                    type: 'action-feedback',
                    id: entry.id,
                    associatedMessageId: entry.associatedMessageId,
                    feedbacks: entry.feedbacks.map(f => ({
                        actionId: f.actionId,
                        success: f.success,
                        message: f.message,
                        sentiment: f.sentiment
                    })),
                    datetime: entry.datetime
                };
            } else if (entry.type === 'summary-import') {
                // Summary import entry
                return {
                    type: 'summary-import',
                    id: entry.id,
                    sourcePlayerId: entry.sourcePlayerId,
                    characterId: entry.characterId,
                    characterName: entry.characterName,
                    summaryCount: entry.summaryCount,
                    sourceFilePath: entry.sourceFilePath,
                    status: entry.status,
                    datetime: entry.datetime
                };
            } else if (entry.type === 'action-approval') {
                // Action approval entry
                return {
                    type: 'action-approval',
                    id: entry.id,
                    associatedMessageId: entry.associatedMessageId,
                    actions: entry.actions,
                    status: entry.status,
                    datetime: entry.datetime
                };
            } else {
                // Error entry
                return {
                    type: 'error',
                    id: entry.id,
                    content: entry.content,
                    datetime: entry.datetime,
                    details: entry.details
                };
            }
        });
    }

    /**
     * End current conversation
     */
    endCurrentConversation(): void {
        if (this.currentConversation) {
            this.currentConversation.finalizeConversation();
            console.log('Conversation ended');
        }
        this.currentConversation = null;
    }

    /**
     * Cancel the current stream in the active conversation
     */
    cancelCurrentStream(): void {
        if (this.currentConversation) {
            this.currentConversation.cancelCurrentStream();
        }
    }

    /**
     * Check if there's an active conversation
     */
    hasActiveConversation(): boolean {
        return this.currentConversation !== null && this.currentConversation.isActive;
    }

    /**
     * Pause the current conversation
     */
    pauseConversation(): void {
        if (this.currentConversation) {
            this.currentConversation.pauseConversation();
        }
    }

    /**
     * Resume the current conversation
     */
    resumeConversation(): void {
        if (this.currentConversation) {
            this.currentConversation.resumeConversation();
        }
    }

    /**
     * Get conversation state (paused, queue length)
     */
    getConversationState(): { isPaused: boolean; queueLength: number } {
        if (!this.currentConversation) {
            return { isPaused: false, queueLength: 0 };
        }
        return {
            isPaused: this.currentConversation.isPaused,
            queueLength: this.currentConversation.npcQueue.length
        };
    }

    /**
     * Regenerate an error message
     */
    async regenerateError(messageId: number): Promise<any> {
        if (!this.currentConversation) {
            throw new Error('No active conversation');
        }

        try {
            await this.currentConversation.regenerateError(messageId);
            this.emitConversationUpdate();
            return { success: true };
        } catch (error) {
            console.error('Error in ConversationManager.regenerateError:', error);
            this.emitConversationUpdate();
            throw error;
        }
    }

    /**
     * Subscribe to conversation updates
     */
    onConversationUpdate(callback: (entries: any[]) => void): void {
        this.eventEmitter.on('conversation-updated', callback);
    }

    /**
     * Unsubscribe from conversation updates
     */
    offConversationUpdate(callback: (entries: any[]) => void): void {
        this.eventEmitter.off('conversation-updated', callback);
    }

    /**
     * Get active conversation data
     */
    getActiveConversationData(): any | null {
        if (!this.currentConversation || !this.currentConversation.isActive) {
            return null;
        }

        const characters = Array.from(this.currentConversation.gameData.characters.values()).map(char => ({
            id: char.id,
            fullName: char.fullName,
            shortName: char.shortName
        }));

        return {
            characters,
            playerID: this.currentConversation.gameData.playerID,
            aiID: this.currentConversation.gameData.aiID,
            historyLength: this.currentConversation.getHistory().length
        };
    }

    /**
     * Get prompt preview for a specific character
     */
    getPromptPreview(characterId: number): any | null {
        if (!this.currentConversation || !this.currentConversation.isActive) {
            return null;
        }

        const character = this.currentConversation.gameData.characters.get(characterId);
        if (!character) {
            return null;
        }

        const history = this.currentConversation.getHistory();
        const result = PromptBuilder.buildMessagesWithTokenCount(
            history,
            character,
            this.currentConversation.gameData,
            this.currentConversation.currentSummary
        );

        return {
            characterId,
            characterName: character.fullName,
            ...result
        };
    }
}

// Export singleton instance
export const conversationManager = ConversationManager.getInstance();
