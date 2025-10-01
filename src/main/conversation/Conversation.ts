import { GameData } from "../gameData/GameData";
import { Character } from "../gameData/Character";
import { parseLog } from "../gameData/parseLog";
import { v4 } from "uuid";
import { llmManager } from "../LLMManager";
import { settingsRepository } from "../SettingsRepository";
import { ILLMStreamChunk, ILLMCompletionResponse } from "../llmProviders/types";
import { ConversationEntry, Message, createError, createMessage } from "./types";
import { PromptBuilder } from "./PromptBuilder";
import { EventEmitter } from "events";

export class Conversation {
    id = v4();
    messages: ConversationEntry[] = [];
    gameData!: GameData;
    isActive: boolean = false;
    nextId: number = 0;
    private eventEmitter: EventEmitter;
    private currentStreamController: AbortController | null = null;

    // Queue and pause management
    npcQueue: Character[] = [];
    customQueue: Character[] | null = null;
    isPaused: boolean = false;
    persistCustomQueue: boolean = false;

    constructor() {
        this.eventEmitter = new EventEmitter();
        this.initializeGameData();
    }

    private async initializeGameData(): Promise<void> {
        try {
            this.gameData = await parseLog(settingsRepository.getCK3DebugLogPath()!);
            console.log('GameData initialized with', this.gameData.characters.size, 'characters');
            this.isActive = true;
        } catch (error) {
            console.error('Failed to parse log file:', error);
            this.isActive = false;
        }
    }


    // Get list of all NPCs (characters except the player)
    private getNpcList(): Character[] {
        return [...this.gameData.characters.values()]
            .filter(c => c.id !== this.gameData.playerID);
    }

    // Handle response for a single NPC
    private async respondAs(npc: Character): Promise<void> {
        const llmMessages = PromptBuilder.buildMessages(this.getHistory(), npc, this.gameData);

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

        // Create AbortController for this stream
        this.currentStreamController = new AbortController();

        try {
            const result = await llmManager.sendChatRequest(llmMessages, this.currentStreamController.signal);

            if (settingsRepository.getGlobalStreamSetting() &&
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
            } else if (result && typeof result === 'object' && 'content' in result && typeof result.content === 'string') {
                // Handle synchronous response
                placeholder.content = result.content;
                this.emitUpdate();
                placeholder.isStreaming = false;
            } else {
                throw new Error('Bad LLM response format');
            }
        } catch (error) {
            console.error('Failed to get response for', npc.shortName, ':', error);

            // Remove the placeholder message
            this.messages = this.messages.filter(msg => msg.id !== msgId);

            // Check if this was an abort (user cancelled)
            if (error instanceof Error && error.message !== 'AbortError: Message cancelled') {
                const err = createError({
                    id: this.nextId++,
                    content: `Failed to get response from ${npc.shortName}`,
                    details: error instanceof Error ? error.message : String(error),
                });
                this.messages.push(err);
            }
            // Pause conversation on any interruption if more NPCs remain
            if (this.npcQueue.length > 0) {
                this.pauseConversation();
            }
        } finally {
            // Clean up the AbortController
            this.emitUpdate();
            this.currentStreamController = null;
        }
    }

    // Cancel currently active stream
    cancelCurrentStream(): void {
        if (this.currentStreamController) {
            console.log('Cancelling current stream');
            this.currentStreamController.abort();
        }
    }

    // Pause the conversation
    pauseConversation(): void {
        console.log('Pausing conversation');
        this.isPaused = true;
        this.emitUpdate();
    }

    // Resume the conversation
    resumeConversation(): void {
        console.log('Resuming conversation');
        this.isPaused = false;
        this.emitUpdate();
        // Start processing remaining queue if not empty
        if (this.npcQueue.length > 0) {
            this.processQueue();
        }
    }

    // Set custom queue for conversation
    setCustomQueue(queue: []): void {
        // TODO: use ids instead. Frontend side of the app should send an array of character ids in order of custom queue.
        // Additionally we need to send to UI participating charaters as id's and their names to use for creation of custom queue.
        this.emitUpdate();
    }

    // Fill NPC queue with shuffled characters or custom queue
    private fillNpcQueue(): void {
        if (this.customQueue && this.customQueue.length > 0) {
            this.npcQueue = [...this.customQueue];
            console.log('Using custom queue:', this.npcQueue.map(c => c.shortName));
            if (!this.persistCustomQueue) {
                this.customQueue = null;
            }
        } else {
            // Shuffle the NPCs
            const npcs = this.getNpcList();
            this.npcQueue = [...npcs].sort(() => Math.random() - 0.5);
            console.log('Filled shuffled queue:', this.npcQueue.map(c => c.shortName));
        }
    }

    // Process the NPC queue asynchronously
    private async processQueue(): Promise<void> {
        if (this.npcQueue.length === 0 || this.isPaused) {
            return;
        }

        console.log('Processing queue with', this.npcQueue.length, 'NPCs remaining');

        while (this.npcQueue.length > 0 && !this.isPaused) {
            const npc = this.npcQueue.shift()!;
            await this.respondAs(npc);
        }

        if (this.npcQueue.length === 0 && !this.isPaused) {
            console.log('Queue processing complete');
            this.emitUpdate();
        }
    }

    // Send a user message and trigger responses from all NPCs
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

        // Fill queue if empty and start processing
        if (this.npcQueue.length === 0) {
            this.fillNpcQueue();
        }

        // Start processing the queue asynchronously
        this.resumeConversation();
        // this.processQueue();
    }

    // Regenerate assistant message and refill queue
    async regenerateMessage(messageId: number): Promise<void> {
        console.log('Regenerating message with ID:', messageId);

        // Find target message
        const targetIndex = this.messages.findIndex(msg => 'id' in msg && msg.id === messageId);
        if (targetIndex === -1) {
            console.error('Message not found for regeneration:', messageId);
            return;
        }

        const targetMessage = this.messages[targetIndex] as Message;
        if (targetMessage.role !== 'assistant') {
            console.error('Can only regenerate assistant messages:', targetMessage.role);
            return;
        }

        // Remove messages from last to target (inclusive)
        for (let i = this.messages.length - 1; i >= targetIndex; i--) {
            this.messages.splice(i, 1);
        }

        // Find the character who sent this message
        const targetCharacter = this.getNpcList().find(c => c.fullName === targetMessage.name);
        if (!targetCharacter) {
            console.error('Could not find character for message:', targetMessage.name);
            this.emitUpdate();
            return;
        }

        // Check settings for generate following messages
        const generateFollowing = settingsRepository.getGenerateFollowingMessagesSetting();

        if (generateFollowing) {
            // Find latest user message before target
            let latestUserIndex = -1;
            for (let i = targetIndex - 1; i >= 0; i--) {
                const msg = this.messages[i];
                if ('role' in msg && msg.role === 'user') {
                    latestUserIndex = i;
                    break;
                }
            }

            if (latestUserIndex >= 0) {
                // Get all characters who haven't responded after the latest user message
                const respondedCharacters = new Set<string>();
                for (let i = latestUserIndex + 1; i < targetIndex; i++) { // targetIndex is now where we cut off
                    const msg = this.messages[i] as Message;
                    if (msg.role === 'assistant' && msg.name) {
                        respondedCharacters.add(msg.name);
                    }
                }

                const allNpcs = this.getNpcList();
                const remainingCharacters = allNpcs.filter(
                    c => !respondedCharacters.has(c.fullName) &&
                    c.fullName !== targetCharacter.fullName
                );

                // Refill queue: target character first, then remaining characters
                this.npcQueue = [targetCharacter, ...remainingCharacters];
                console.log('Refilled queue for regeneration:', this.npcQueue.map(c => c.shortName));
            } else {
                // No user message found, just queue the target character
                this.npcQueue = [targetCharacter];
            }
        } else {
            // Only regenerate target character
            this.npcQueue = [targetCharacter];
        }

        this.emitUpdate();

        // Check pause setting
        const pauseOnRegeneration = settingsRepository.getPauseOnRegenerationSetting();
        this.processQueue();
        if (pauseOnRegeneration) {
            this.pauseConversation();
        }
    }

    // Edit user message and resend
    async editUserMessage(messageId: number, newContent: string): Promise<void> {
        console.log('Editing user message with ID:', messageId);

        // Find target message
        const targetIndex = this.messages.findIndex(msg => 'id' in msg && msg.id === messageId);
        if (targetIndex === -1) {
            console.error('Message not found for editing:', messageId);
            return;
        }

        const targetMessage = this.messages[targetIndex] as Message;
        if (targetMessage.role !== 'user') {
            console.error('Can only edit user messages:', targetMessage.role);
            return;
        }

        // Remove messages from last to target (inclusive)
        for (let i = this.messages.length - 1; i >= targetIndex; i--) {
            this.messages.splice(i, 1);
        }

        this.emitUpdate();

        // Use existing sendMessage functionality with new content
        await this.sendMessage(newContent);
    }

    // Get conversation history
    getHistory(): Message[] {
        return this.messages.filter(
            (entry): entry is Message => 'role' in entry
        );
    }

    // Clear conversation history
    clearHistory(): void {
        this.messages = [];
    }

    // End conversation
    end(): void {
        this.isActive = false;
        this.clearHistory();
    }

    // Emit conversation update event
    private emitUpdate(): void {
        this.eventEmitter.emit('conversation-updated', [...this.messages]);
    }

    // Subscribe to conversation updates
    onConversationUpdate(callback: (entries: ConversationEntry[]) => void): void {
        this.eventEmitter.on('conversation-updated', callback);
    }

    // Unsubscribe from conversation updates
    offConversationUpdate(callback: (entries: ConversationEntry[]) => void): void {
        this.eventEmitter.off('conversation-updated', callback);
    }
}
