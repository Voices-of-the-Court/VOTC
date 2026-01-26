import { GameData } from "../gameData/GameData";
import { Character } from "../gameData/Character";
import { parseLog, cleanLogFile } from "../gameData/parseLog";
import { v4 } from "uuid";
import { llmManager } from "../LLMManager";
import { settingsRepository } from "../SettingsRepository";
import { ILLMStreamChunk, ILLMCompletionResponse } from "../llmProviders/types";
import { ConversationEntry, Message, createError, createMessage, createActionFeedback } from "./types";
import { PromptBuilder } from "./PromptBuilder";
import { ActionEngine } from "../actions/ActionEngine";
import { EventEmitter } from "events";
import { runFileManager } from "../actions/RunFileManager";

export class Conversation {
    id = v4();
    messages: ConversationEntry[] = [];
    gameData!: GameData;
    isActive: boolean = false;
    nextId: number = 0;
    private eventEmitter: EventEmitter;
    private currentStreamController: AbortController | null = null;

    currentSummary: string = '';
    private lastSummarizedMessageIndex: number = 0;
    
    // Configuration placeholders
    private readonly CONTEXT_LIMIT_PERCENTAGE = 0.75; // Trigger summary at 75% of context
    private readonly MESSAGES_TO_SUMMARIZE_PERCENTAGE = 0.40; // Summarize oldest 40%

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
        runFileManager.clear();
        try {
            this.gameData = await parseLog(settingsRepository.getCK3DebugLogPath()!);
            console.log('GameData initialized with', this.gameData.characters.size, 'characters');
            this.gameData.loadCharactersSummaries();
            this.isActive = true;
        } catch (error) {
            console.error('Failed to parse log file:', error);
            this.isActive = false;
            
            // Add initialization error message to conversation
            const initError = createError({
                id: this.nextId++,
                content: 'Failed to initialize conversation',
                details: error instanceof Error ? error.message : String(error)
            });
            this.messages.push(initError);
            this.emitUpdate();
        }
    }

    private async checkAndSummarizeIfNeeded(npc: Character): Promise<void> {
        const currentMessages = PromptBuilder.buildMessages(
            this.getHistory().slice(this.lastSummarizedMessageIndex),
            npc, 
            this.gameData,
            this.currentSummary
        );
        
        const estimatedTokens = this.estimateTokenCount(currentMessages);
        const contextLimit = await llmManager.getCurrentContextLength() || 10000;
        
        if (estimatedTokens > contextLimit * this.CONTEXT_LIMIT_PERCENTAGE) {
            console.log(`Context approaching limit (${estimatedTokens}/${contextLimit}), creating rolling summary`);
            await this.createRollingSummary(contextLimit);
        }
    }

    /**
     * Create a rolling summary of older messages to compress context
     */
    private async createRollingSummary(contextLimit: number): Promise<void> {
        const history = this.getHistory().slice(this.lastSummarizedMessageIndex);
        const tokensToSummarize = Math.floor(
            contextLimit * this.MESSAGES_TO_SUMMARIZE_PERCENTAGE
        );
        
        // Find messages to summarize (oldest messages not yet summarized)
        let tokenCount = 0;
        const messagesToSummarize: Message[] = [];
        
        for (let i = this.lastSummarizedMessageIndex; i < history.length; i++) {
            const msg = history[i];
            const msgTokens = this.estimateMessageTokens(msg);
            
            if (tokenCount + msgTokens > tokensToSummarize) {
                break;
            }
            
            messagesToSummarize.push(msg);
            tokenCount += msgTokens;
            this.lastSummarizedMessageIndex = i + 1;
        }
        
        if (messagesToSummarize.length === 0) {
            console.log('No new messages to summarize');
            return;
        }
        
        // Create summary prompt
        const summaryPrompt = PromptBuilder.buildResummarizePrompt(messagesToSummarize, this.currentSummary);
        
        try {
            const result = await llmManager.sendSummaryRequest(summaryPrompt);
            
            if (result && typeof result === 'object' && 'content' in result) {
                // Append to existing summary or create new one
                if (this.currentSummary) {
                    this.currentSummary = `${this.currentSummary}\n\n${result.content}`;
                } else {
                    this.currentSummary = result.content as string;
                }
                
                console.log('Updated rolling summary:', this.currentSummary.substring(0, 100) + '...');
            }
        } catch (error) {
            console.error('Failed to create rolling summary:', error);
        }
    }

    /**
     * Estimate token count (simple approximation)
     */
    private estimateTokenCount(messages: any[]): number {
        const text = JSON.stringify(messages);
        return Math.ceil(text.length / 4); // Rough estimate: 1 token ≈ 4 characters
    }
    
    private estimateMessageTokens(message: Message): number {
        const text = `${message.name}: ${message.content}`;
        return Math.ceil(text.length / 4);
    }

    // Get list of all NPCs (characters except the player)
    private getNpcList(): Character[] {
        return [...this.gameData.characters.values()]
            .filter(c => c.id !== this.gameData.playerID);
    }

    // Handle response for a single NPC
    private async respondAs(npc: Character): Promise<void> {
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

        // Has to be called after emitUpdate to show placeholder in UI in right time
        await this.checkAndSummarizeIfNeeded(npc);
        
        const llmMessages = PromptBuilder.buildMessages(
            this.getHistory().slice(this.lastSummarizedMessageIndex), 
            npc, 
            this.gameData,
            this.currentSummary
        );


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
                
                // Execute actions and collect feedback
                const actionResults = await ActionEngine.evaluateForCharacter(this, npc);
                this.addActionFeedback(msgId, actionResults);
            } else if (result && typeof result === 'object' && 'content' in result && typeof result.content === 'string') {
                // Handle synchronous response
                placeholder.content = result.content;
                this.emitUpdate();
                placeholder.isStreaming = false;
                
                // Execute actions and collect feedback
                const actionResults = await ActionEngine.evaluateForCharacter(this, npc);
                this.addActionFeedback(msgId, actionResults);
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

    private addActionFeedback(associatedMessageId: number, actionResults: import("../actions/types").ActionExecutionResult[]): void {
        console.log('[Conversation] addActionFeedback called with results:', actionResults);
        
        // Filter results that have feedback or errors
        const feedbackItems = actionResults
            .filter(r => r.feedback || r.error)
            .map(r => ({
                actionId: r.actionId,
                success: r.success,
                message: r.feedback?.message || r.error || 'Unknown error',
                sentiment: (r.feedback?.sentiment || 'negative') as 'positive' | 'negative' | 'neutral'
            }));

        console.log('[Conversation] Filtered feedback items:', feedbackItems);

        // Add feedback entry if any actions provided feedback
        if (feedbackItems.length > 0) {
            const feedbackEntry = createActionFeedback({
                id: this.nextId++,
                associatedMessageId,
                feedbacks: feedbackItems
            });
            console.log('[Conversation] Creating feedback entry:', feedbackEntry);
            this.messages.push(feedbackEntry);
            this.emitUpdate();
            console.log('[Conversation] Feedback entry added and update emitted');
        } else {
            console.log('[Conversation] No feedback items to display');
        }
    }

    cancelCurrentStream(): void {
        if (this.currentStreamController) {
            console.log('Cancelling current stream');
            this.currentStreamController.abort();
        }
    }

    pauseConversation(): void {
        console.log('Pausing conversation');
        this.isPaused = true;
        this.emitUpdate();
    }

    resumeConversation(): void {
        console.log('Resuming conversation');
        this.isPaused = false;
        this.emitUpdate();
        if (this.npcQueue.length > 0) {
            this.processQueue();
        }
    }

    // setCustomQueue(queue: []): void {
    //     // TODO: use ids instead. Frontend side of the app should send an array of character ids in order of custom queue.
    //     // Additionally we need to send to UI participating charaters as id's and their names to use for creation of custom queue.
    //     this.emitUpdate();
    // }

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

        const userMsg = createMessage({
            id: this.nextId++,
            name: user.fullName,
            role: 'user',
            content: userMessage,
        });
        this.messages.push(userMsg);
        this.emitUpdate();

        if (this.npcQueue.length === 0) {
            this.fillNpcQueue();
        }

        this.resumeConversation();
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

    // Regenerate error message and retry the operation
    async regenerateError(messageId: number): Promise<void> {
        console.log('Regenerating error with ID:', messageId);

        // Find target error
        const targetIndex = this.messages.findIndex(msg => 'id' in msg && msg.id === messageId);
        if (targetIndex === -1) {
            console.error('Error not found for regeneration:', messageId);
            return;
        }

        const targetError = this.messages[targetIndex];
        if (targetError.type !== 'error') {
            console.error('Can only regenerate error entries:', targetError.type);
            return;
        }

        // Remove the error message
        this.messages.splice(targetIndex, 1);
        
        // Check if this was an initialization error
        if (targetError.content === 'Failed to initialize conversation') {
            // Try to reinitialize
            await this.initializeGameData();
        } else {
            // For other errors, find the latest user message and try to regenerate responses
            const userMessages = this.messages.filter(msg => 'role' in msg && msg.role === 'user') as Message[];
            if (userMessages.length > 0) {
                const latestUserMessage = userMessages[userMessages.length - 1];
                // Remove all assistant messages and errors after the latest user message
                for (let i = this.messages.length - 1; i >= 0; i--) {
                    const msg = this.messages[i];
                    if (('role' in msg && msg.role === 'user' && msg.id === latestUserMessage.id) ||
                        (msg.type === 'action-feedback' && msg.associatedMessageId === latestUserMessage.id)) {
                        break;
                    }
                    if (('role' in msg && msg.role === 'assistant') || msg.type === 'error') {
                        this.messages.splice(i, 1);
                    }
                }
                // Trigger message processing again
                await this.sendMessage(latestUserMessage.content);
            }
        }
        
        this.emitUpdate();
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

        await this.sendMessage(newContent);
    }


    
    // Create final comprehensive summary and save to characters
    async finalizeConversation(): Promise<void> {
        runFileManager.write("trigger_event = mcc_event_v2.9002");
        setTimeout(() => {
            runFileManager.clear();
            console.log('Run file cleared after conversation end event.');
        }, 500);
        if (this.messages.length < 6) {
            console.log('Not enough messages for final summarization');
            this.end();
            return;
        }

        console.log('Creating final conversation summary...');
        
        // Create comprehensive final summary using ALL messages + current rolling summary
        const finalSummary = await this.createFinalSummary();
        
        if (finalSummary) {
            // Save to game data (which will distribute to all participating characters)
            this.gameData.saveCharactersSummaries(finalSummary);
            console.log('Final conversation summary saved to all participants');
        }

        this.end();
    }

    //  Create final comprehensive summary using ALL messages
    private async createFinalSummary(): Promise<string | null> {
        const allMessages = this.getHistory();
        const estimatedTokens = this.estimateTokenCount(allMessages);
        const contextLimit = await llmManager.getCurrentContextLength() || 10000;

        let summaryPrompt;

        // Choose summary mode based on compression setting or token threshold
        if (
            // TODO: settingsRepository.compressSummarySetting ||
            estimatedTokens > contextLimit * this.CONTEXT_LIMIT_PERCENTAGE
        ) {
            summaryPrompt = PromptBuilder.buildFinalSummary(
                this.gameData,
                allMessages,
                this.currentSummary,
                this.lastSummarizedMessageIndex
            );
        } else {
            summaryPrompt = PromptBuilder.buildFinalSummary(this.gameData, allMessages);
        }

        try {
            const result = await llmManager.sendSummaryRequest(summaryPrompt);

            if (result && typeof result === 'object' && 'content' in result) {
                const finalSummary = result.content as string;
                return finalSummary;
            }

            console.error('Invalid response format for final summary');
            return null;
        } catch (error) {
            console.error('Failed to create final summary:', error);
            return null;
        }
    }

    // Get conversation history
    getHistory(): Message[] {
        return this.messages.filter(
            (entry): entry is Message => 'role' in entry
        );
    }

    clearHistory(): void {
        this.messages = [];
    }

    end(): void {
        this.isActive = false;
        this.clearHistory();
        cleanLogFile(settingsRepository.getCK3DebugLogPath()!);
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
