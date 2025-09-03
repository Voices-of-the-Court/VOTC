import { Conversation } from "./Conversation";
import { Character } from "../gameData/Character";

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
    createConversationWithNPC(character?: Character): Conversation | null {
        try {
            // End any existing conversation
            this.endCurrentConversation();

            // Use provided character or create demo NPC
            const npc = character || Conversation.createDemoNPC();

            // Create new conversation - wrap single character in array
            this.currentConversation = new Conversation([npc]);

            console.log(`Started conversation with ${npc.shortName}`);
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
    async sendMessage(userMessage: string): Promise<any> {
        console.log('ConversationManager.sendMessage called with:', userMessage);
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
            console.log('Conversation sendMessage returned:', result);
            return result;
        } catch (error) {
            console.error('Error in ConversationManager.sendMessage:', error);
            throw error;
        }
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

        const firstCharId = this.currentConversation.characters.keys().next().value;
        return firstCharId ? this.currentConversation.characters.get(firstCharId) || null : null;
    }

    /**
     * Create and switch to demo conversation for development
     */
    startDemoConversation(): Conversation | null {
        return this.createConversationWithNPC();
    }
}

// Export singleton instance
export const conversationManager = ConversationManager.getInstance();