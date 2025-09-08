import { Conversation } from "./Conversation";
import { Character } from "../gameData/Character";
import { ILLMStreamChunk } from "../llmProviders/types";

export class ConversationManager {
    private static instance: ConversationManager;
    private currentConversation: Conversation | null = null;

    private constructor() {}

    static getInstance(): ConversationManager {
        if (!ConversationManager.instance) {
            ConversationManager.instance = new ConversationManager();
        }
        return ConversationManager.instance;
    }

    /**
     * Create a new conversation with an NPC
     */
    createConversation(): Conversation | null {
        try {
            this.endCurrentConversation();
            this.currentConversation = new Conversation();
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
            const result = await this.currentConversation.sendMessage(userMessage, streaming);
            console.log('Conversation sendMessage returned type:', typeof result);

            // Type guard for async generator
            if (streaming && result && typeof result[Symbol.asyncIterator] === 'function') {
                console.log('Returning async generator for streaming');
                return result as AsyncGenerator<ILLMStreamChunk, any>;
            } else {
                console.log('Conversation sendMessage returned:', result);
                return result;
            }
        } catch (error) {
            console.error('Error in ConversationManager.sendMessage:', error);
            throw error;
        }
    }

    /**
     * Create a streaming message generator for real-time UI updates
     */
    async createStreamingGenerator(userMessage: string): Promise<AsyncGenerator<ILLMStreamChunk, any, undefined>> {
        const generator = await this.sendMessage(userMessage, true);

        if (generator && typeof generator[Symbol.asyncIterator] === 'function') {
            return generator;
        }

        // Fallback to manual generator creation if type casting didn't work
        async function* fallbackGenerator() {
            // This should not happen with proper implementation, but provides fallback
            const result = await this.sendMessage(userMessage, false);
            yield { delta: { content: result?.content || '' } };
        }

        console.warn('Using fallback generator - check type handling');
        return fallbackGenerator.bind(this)();
    }

    /**
     * Get conversation history
     */
    getConversationHistory(): { role: string, content: string, datetime: Date }[] {
        if (!this.currentConversation) {
            return [];
        }

        return this.currentConversation.getHistory().map(msg => ({
            role: msg.role,
            content: msg.content,
            datetime: msg.datetime,
            ...(msg.name && { name: msg.name })
        }));
    }

    /**
     * End current conversation
     */
    endCurrentConversation(): void {
        if (this.currentConversation) {
            this.currentConversation.end();
            console.log('Conversation ended');
        }
        this.currentConversation = null;
    }

    /**
     * Check if there's an active conversation
     */
    hasActiveConversation(): boolean {
        return this.currentConversation !== null && this.currentConversation.isActive;
    }

    /**
     * Get current NPC information (first character for demo purposes)
     */
    getCurrentNPC(): Character | null {
        if (!this.currentConversation) return null;

        const firstCharId = this.currentConversation.gameData.characters.keys().next().value;
        return firstCharId ? this.currentConversation.gameData.characters.get(firstCharId) || null : null;
    }
}

// Export singleton instance
export const conversationManager = ConversationManager.getInstance();