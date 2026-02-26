import { GameData, SummaryImportResult } from "../gameData/GameData";
import { Character } from "../gameData/Character";
import { parseLog, cleanLogFile } from "../gameData/parseLog";
import { v4 } from "uuid";
import { llmManager } from "../LLMManager";
import { settingsRepository } from "../SettingsRepository";
import { ILLMStreamChunk, ILLMCompletionResponse } from "../llmProviders/types";
import { ConversationEntry, Message, createError, createMessage, createActionFeedback, createSummaryImport, createActionApproval } from "./types";
import { PromptBuilder } from "./PromptBuilder";
import { ActionEngine } from "../actions/ActionEngine";
import { EventEmitter } from "events";
import { runFileManager } from "../actions/RunFileManager";
import { shell } from "electron";
import { TokenCounter } from "../utils/TokenCounter";
import type { ActionInvocation } from "../actions/types";

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

    // Summary import management
    private pendingSummaryImports: Map<string, SummaryImportResult> = new Map(); // Key: "characterId_sourcePlayerId"
    private hasAcceptedImports: Set<number> = new Set(); // Track which characters have accepted imports
    
    // Action approval management
    private pendingActionApprovals: Map<number, {
        npc: Character;
        action: {
            actionId: string;
            actionTitle?: string;
            sourceCharacterId: number;
            sourceCharacterName: string;
            targetCharacterId?: number;
            targetCharacterName?: string;
            args: Record<string, any>;
            isDestructive: boolean;
            invocation: ActionInvocation;
        };
        previewFeedback?: string;
        previewSentiment?: 'positive' | 'negative' | 'neutral';
        approvalEntryId: number;
    }> = new Map();


    constructor() {
        this.eventEmitter = new EventEmitter();
        this.initializeGameData();
    }

    private async initializeGameData(): Promise<void> {
        const ck3DebugPath = settingsRepository.getCK3DebugLogPath();
        console.log(`Conversation.initializeGameData: CK3 debug log path: ${ck3DebugPath}`);
        
        // Only clear run file if it's available
        if (runFileManager.isAvailable()) {
            console.log('Conversation.initializeGameData: Clearing run file');
            runFileManager.clear();
        } else {
            console.warn('Conversation.initializeGameData: RunFileManager not available - CK3 path not configured');
        }
        
        if (!ck3DebugPath) {
            console.error('Conversation.initializeGameData: CK3 debug log path is not configured');
            this.isActive = false;
            
            const initError = createError({
                id: this.nextId++,
                content: 'CK3 debug log path is not configured',
                details: 'Please configure the CK3 user folder path in settings'
            });
            this.messages.push(initError);
            this.emitUpdate();
            return;
        }
        
        try {
            this.gameData = await parseLog(ck3DebugPath);
            console.log('GameData initialized with', this.gameData.characters.size, 'characters');
            this.gameData.loadCharactersSummaries();
            
            // Check for summaries from other players
            await this.checkForOtherPlayerSummaries();
            
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
            console.log('[TOKEN_COUNT] Rolling summary: ', this.estimateTokenCount(summaryPrompt));
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
        return TokenCounter.calculateTotalTokens(messages);
    }
    
    private estimateMessageTokens(message: Message): number {
        return TokenCounter.estimateMessageTokens(message);
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

        // Create AbortController for this stream
        this.currentStreamController = new AbortController();
        let wasCancelled = false;
        let streamCompleted = false;

        try {
            // Has to be called after emitUpdate to show placeholder in UI in right time
            await this.checkAndSummarizeIfNeeded(npc);
            
            const llmMessages = PromptBuilder.buildMessages(
                this.getHistory().slice(this.lastSummarizedMessageIndex), 
                npc, 
                this.gameData,
                this.currentSummary
            );

            console.log(`Message from ${npc.fullName}:`, llmMessages);
            console.log(`[TOKEN_COUNT] Message from ${npc.fullName}:`, this.estimateTokenCount(llmMessages));
            
            // Check if OpenRouter is the active provider
            const activeConfig = settingsRepository.getActiveProviderConfig();
            const isOpenRouter = activeConfig?.providerType === 'openrouter';
            
            // For OpenRouter, don't pass the signal to avoid double billing on cancellation
            // For other providers, pass the signal for immediate cancellation
            const result = await llmManager.sendChatRequest(
                llmMessages,
                isOpenRouter ? undefined : this.currentStreamController.signal
            );

            if (settingsRepository.getGlobalStreamSetting() &&
                typeof result === 'object' &&
                typeof (result as any)[Symbol.asyncIterator] === 'function') {
                // Handle streaming response
                try {
                    const streamIterator = result as AsyncGenerator<ILLMStreamChunk, ILLMCompletionResponse | void>;
                    
                    // For OpenRouter: wrap stream consumption in a detachable promise since they are double charging on cancellation
                    if (isOpenRouter) {
                        const streamPromise = (async () => {
                            for await (const chunk of streamIterator) {
                                // Check local cancellation flag
                                if (wasCancelled) {
                                    // Continue consuming silently without UI updates
                                    continue;
                                }
                                
                                if (chunk.delta?.content) {
                                    placeholder.content += chunk.delta.content;
                                    this.emitUpdate();
                                }
                            }
                        })();
                        
                        // Poll for cancellation while stream is active
                        const checkCancellation = async () => {
                            while (!streamCompleted && !wasCancelled) {
                                if (this.currentStreamController?.signal.aborted) {
                                    wasCancelled = true;
                                    console.log('[OpenRouter] Cancellation detected - stream will continue in background');
                                    // Don't await streamPromise - let it finish in background
                                    streamPromise.catch(err => console.error('[OpenRouter] Background stream error:', err));
                                    throw new Error('AbortError: Message cancelled');
                                }
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                        };
                        
                        // Race between stream completion and cancellation check
                        await Promise.race([streamPromise, checkCancellation()]);
                        streamCompleted = true;
                    } else {
                        // For other providers: normal cancellation with signal
                        for await (const chunk of streamIterator) {
                            if (this.currentStreamController?.signal.aborted) {
                                wasCancelled = true;
                                throw new Error('AbortError: Message cancelled');
                            }
                            
                            if (chunk.delta?.content) {
                                placeholder.content += chunk.delta.content;
                                this.emitUpdate();
                            }
                        }
                        streamCompleted = true;
                    }
                } catch (streamError) {
                    // Stream was aborted
                    if (streamError instanceof Error && streamError.message === 'AbortError: Message cancelled') {
                        wasCancelled = true;
                        throw streamError;
                    }
                    throw streamError;
                }
                
                placeholder.isStreaming = false;
                
                // Only execute actions if stream completed successfully (not cancelled)
                if (streamCompleted && !wasCancelled) {
                    const actionResults = await ActionEngine.evaluateForCharacter(this, npc, this.currentStreamController?.signal);
                    await this.handleActionResults(msgId, npc, actionResults);
                }
            } else if (result && typeof result === 'object' && 'content' in result && typeof result.content === 'string') {
                // Handle synchronous response
                placeholder.content = result.content;
                this.emitUpdate();
                placeholder.isStreaming = false;
                streamCompleted = true;
                
                // Execute actions and collect feedback
                const actionResults = await ActionEngine.evaluateForCharacter(this, npc, this.currentStreamController?.signal);
                await this.handleActionResults(msgId, npc, actionResults);
            } else {
                throw new Error('Bad LLM response format');
            }
        } catch (error) {
            console.error('Failed to get response for', npc.shortName, ':', error);

            // Remove the placeholder message
            this.messages = this.messages.filter(msg => msg.id !== msgId);

            // Check if this was an abort (user cancelled)
            if (error instanceof Error && error.message === 'AbortError: Message cancelled') {
                wasCancelled = true;
            } else {
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
            // Clear pause state if queue is empty and this was a cancellation
            if (wasCancelled && this.npcQueue.length === 0 && this.isPaused) {
                this.isPaused = false;
            }
            
            this.emitUpdate();
            this.currentStreamController = null;
        }
    }

    /**
     * Handle action results from ActionEngine - separate auto-approved from needs-approval
     */
    private async handleActionResults(
        associatedMessageId: number,
        npc: Character,
        actionResults: import("../actions/ActionEngine").ActionEvaluationResult
    ): Promise<void> {
        const autoFeedbackResults: import("../actions/types").ActionExecutionResult[] = [...actionResults.autoApproved];

        // Process actions that need approval individually
        for (const action of actionResults.needsApproval) {
            // Try to build a preview without writing any effects
            let previewFeedback: string | undefined;
            let previewSentiment: 'positive' | 'negative' | 'neutral' | undefined;
            try {
                const previewResult = await ActionEngine.runInvocation(this, npc, action.invocation, { dryRun: true });
                if (previewResult.feedback?.message) {
                    previewFeedback = previewResult.feedback.message;
                    previewSentiment = previewResult.feedback.sentiment || 'neutral';
                } else {
                    // Treat actions without feedback as background and auto-approve immediately
                    const executed = await ActionEngine.runInvocation(this, npc, action.invocation);
                    autoFeedbackResults.push(executed);
                    continue;
                }
            } catch (err) {
                console.error('[Conversation] Preview action failed:', err);
            }

            const approvalEntry = createActionApproval({
                id: this.nextId++,
                associatedMessageId,
                action: {
                    actionId: action.actionId,
                    actionTitle: action.actionTitle,
                    sourceCharacterId: action.sourceCharacterId,
                    sourceCharacterName: action.sourceCharacterName,
                    targetCharacterId: action.targetCharacterId,
                    targetCharacterName: action.targetCharacterName,
                    args: action.args,
                    isDestructive: action.isDestructive
                },
                previewFeedback,
                previewSentiment
            });

            this.messages.push(approvalEntry);

            // Store pending action for later execution
            this.pendingActionApprovals.set(approvalEntry.id, {
                npc,
                action,
                previewFeedback,
                previewSentiment,
                approvalEntryId: approvalEntry.id
            });
        }

        // Add feedback for auto-approved/background actions
        if (autoFeedbackResults.length > 0) {
            this.addActionFeedback(associatedMessageId, autoFeedbackResults);
        }

        // Pause conversation if setting is enabled and we have pending approvals
        const approvalSettings = settingsRepository.getActionApprovalSettings();
        if (this.pendingActionApprovals.size > 0 && approvalSettings.pauseOnApproval && this.npcQueue.length > 0) {
            this.pauseConversation();
        }

        if (this.pendingActionApprovals.size > 0) {
            this.emitUpdate();
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
            try {
                await this.respondAs(npc);
            } catch (error) {
                console.error('Unhandled error in respondAs for', npc.shortName, ':', error);
                this.emitUpdate();
            }
        }

        // Clear pause state if queue is now empty (handles case where queue was emptied during processing)
        if (this.npcQueue.length === 0 && this.isPaused) {
            this.isPaused = false;
        }

        if (this.npcQueue.length === 0) {
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
                for (let i = latestUserIndex + 1; i < targetIndex; i++) {
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
                
                // Refill the NPC queue and process without adding a duplicate user message
                if (this.npcQueue.length === 0) {
                    this.fillNpcQueue();
                }
                
                this.emitUpdate();
                this.resumeConversation();
            }
        }
        
        this.emitUpdate();
    }

    // Edit user message and resend
    async editUserMessage(messageId: number, newContent: string): Promise<void> {
        console.log('Editing message with ID:', messageId);

        // Find target message
        const targetIndex = this.messages.findIndex(msg => 'id' in msg && msg.id === messageId);
        if (targetIndex === -1) {
            console.error('Message not found for editing:', messageId);
            return;
        }

        const targetMessage = this.messages[targetIndex] as Message;
        if (targetMessage.role !== 'user' && targetMessage.role !== 'assistant') {
            console.error('Can only edit user or assistant messages:', targetMessage.role);
            return;
        }

        // For user messages: remove and resend
        if (targetMessage.role === 'user') {
            // Remove messages from last to target (inclusive)
            for (let i = this.messages.length - 1; i >= targetIndex; i--) {
                this.messages.splice(i, 1);
            }

            this.emitUpdate();

            await this.sendMessage(newContent);
        } else {
            // For assistant messages: just update the content
            targetMessage.content = newContent;
            this.emitUpdate();
        }
    }


    
    // Create final comprehensive summary and save to characters
    async finalizeConversation(): Promise<void> {
        runFileManager.write(`
            trigger_event = mcc_event_v2.9002
            trigger_event = mcc_event_v2.9003
            `);
        setTimeout(() => {
            runFileManager.clear();
            console.log('Run file cleared after conversation end event.');
        }, 500);
        if (this.messages.length < 2) {
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
            console.log(`[TOKEN_COUNT] Final summary prompt tokens: ${estimatedTokens}`);
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

    /**
     * Check for conversation summaries from other player characters
     */
    private async checkForOtherPlayerSummaries(): Promise<void> {
        try {
            const importResults = await this.gameData.checkForSummariesFromOtherPlayers();
            
            for (const result of importResults) {
                // Create a unique key for each character+sourcePlayer combination
                const importKey = `${result.characterId}_${result.sourcePlayerId}`;
                
                // Only show import notification if we haven't already handled this specific import
                if (!this.pendingSummaryImports.has(importKey)) {
                    
                    // Store the import result using a composite key to handle multiple sources per character
                    this.pendingSummaryImports.set(importKey, result);
                    
                    const importEntry = createSummaryImport({
                        id: this.nextId++,
                        sourcePlayerId: result.sourcePlayerId,
                        characterId: result.characterId,
                        characterName: result.characterName,
                        summaryCount: result.summaryCount,
                        sourceFilePath: result.sourceFilePath,
                        status: 'pending'
                    });
                    
                    this.messages.push(importEntry);
                }
            }
            
            if (importResults.length > 0) {
                this.emitUpdate();
            }
        } catch (error) {
            console.error('Error checking for other player summaries:', error);
        }
    }

    /**
     * Accept summary import for a character
     */
    async acceptSummaryImport(characterId: number, sourcePlayerId: string): Promise<void> {
        const importKey = `${characterId}_${sourcePlayerId}`;
        const importResult = this.pendingSummaryImports.get(importKey);
        if (!importResult) {
            throw new Error(`No pending import found for character ${characterId} from player ${sourcePlayerId}`);
        }

        try {
            // Check if we already have summaries for this character (merge case)
            const character = this.gameData.characters.get(characterId);
            const mergeWithExisting = character && character.conversationSummaries.length > 0;
            
            await this.gameData.importSummariesFromOtherPlayer(
                characterId,
                importResult.sourcePlayerId,
                mergeWithExisting
            );
            
            // Mark as accepted for this character (allows future imports to be merged)
            this.hasAcceptedImports.add(characterId);
            
            // Remove from pending imports
            this.pendingSummaryImports.delete(importKey);
            
            // Find and remove the specific entry (not all entries for this character)
            const entryIndex = this.messages.findIndex(
                msg => msg.type === 'summary-import' &&
                'characterId' in msg &&
                'sourcePlayerId' in msg &&
                msg.characterId === characterId &&
                msg.sourcePlayerId === importResult.sourcePlayerId
            );
            
            if (entryIndex !== -1) {
                // Remove the entry as requested
                this.messages.splice(entryIndex, 1);
                this.emitUpdate();
            }
            
            console.log(`Accepted summary import for character ${characterId} from player ${importResult.sourcePlayerId}`);
        } catch (error) {
            console.error(`Failed to accept summary import for character ${characterId}:`, error);
            throw error;
        }
    }

    /**
     * Decline summary import for a character
     */
    async declineSummaryImport(characterId: number, sourcePlayerId: string): Promise<void> {
        const importKey = `${characterId}_${sourcePlayerId}`;
        const importResult = this.pendingSummaryImports.get(importKey);
        if (!importResult) {
            throw new Error(`No pending import found for character ${characterId} from player ${sourcePlayerId}`);
        }

        // Remove from pending
        this.pendingSummaryImports.delete(importKey);
        
        // Find and remove the specific entry (not all entries for this character)
        const entryIndex = this.messages.findIndex(
            msg => msg.type === 'summary-import' &&
            'characterId' in msg &&
            'sourcePlayerId' in msg &&
            msg.characterId === characterId &&
            msg.sourcePlayerId === importResult.sourcePlayerId
        );
        
        if (entryIndex !== -1) {
            // Remove the entry as requested
            this.messages.splice(entryIndex, 1);
            this.emitUpdate();
        }
        
        console.log(`Declined summary import for character ${characterId} from player ${importResult.sourcePlayerId}`);
    }

    /**
     * Open summary file in default editor
     */
    async openSummaryFile(filePath: string): Promise<void> {
        try {
            await shell.openPath(filePath);
        } catch (error) {
            console.error('Failed to open summary file:', error);
            throw error;
        }
    }

    /**
     * Approve actions for pending approval
     */
    async approveActions(approvalEntryId: number): Promise<void> {
        const pending = this.pendingActionApprovals.get(approvalEntryId);
        if (!pending) {
            throw new Error(`No pending approval found for ID ${approvalEntryId}`);
        }

        // Find the approval entry in messages
        const entryIndex = this.messages.findIndex(
            msg => msg.type === 'action-approval' && msg.id === approvalEntryId
        );

        if (entryIndex === -1) {
            throw new Error(`Approval entry not found for ID ${approvalEntryId}`);
        }

        const approvalEntry = this.messages[entryIndex];
        if (approvalEntry.type !== 'action-approval') {
            throw new Error(`Entry ${approvalEntryId} is not an action-approval entry`);
        }

        // Immediately update status to prevent double-clicking
        approvalEntry.status = 'approved';
        approvalEntry.resultFeedback = pending.previewFeedback || pending.action.actionTitle || pending.action.actionId;
        approvalEntry.resultSentiment = pending.previewSentiment || 'neutral';
        this.pendingActionApprovals.delete(approvalEntryId);
        this.emitUpdate();

        // Execute the approved action in the background (don't await)
        ActionEngine.runInvocation(this, pending.npc, pending.action.invocation).then(result => {
            // Update with final feedback if different from preview
            if (result.feedback?.message && result.feedback.message !== approvalEntry.resultFeedback) {
                approvalEntry.resultFeedback = result.feedback.message;
                approvalEntry.resultSentiment = result.feedback.sentiment || 'neutral';
                this.emitUpdate();
            }
        }).catch(err => {
            console.error('[Conversation] Background action execution failed:', err);
            // Update with error feedback
            approvalEntry.resultFeedback = `Failed: ${err instanceof Error ? err.message : String(err)}`;
            approvalEntry.resultSentiment = 'negative';
            this.emitUpdate();
        });

        // Resume conversation if it was paused
        const approvalSettings = settingsRepository.getActionApprovalSettings();
        if (approvalSettings.pauseOnApproval && this.isPaused && this.npcQueue.length > 0) {
            this.resumeConversation();
        }
    }

    /**
     * Decline actions for pending approval
     */
    async declineActions(approvalEntryId: number): Promise<void> {
        const pending = this.pendingActionApprovals.get(approvalEntryId);
        if (!pending) {
            throw new Error(`No pending approval found for ID ${approvalEntryId}`);
        }

        // Find the approval entry in messages
        const entryIndex = this.messages.findIndex(
            msg => msg.type === 'action-approval' && msg.id === approvalEntryId
        );

        if (entryIndex === -1) {
            throw new Error(`Approval entry not found for ID ${approvalEntryId}`);
        }

        const approvalEntry = this.messages[entryIndex];
        if (approvalEntry.type !== 'action-approval') {
            throw new Error(`Entry ${approvalEntryId} is not an action-approval entry`);
        }

        // Remove approval entry entirely on decline
        this.messages.splice(entryIndex, 1);
        this.pendingActionApprovals.delete(approvalEntryId);
        this.emitUpdate();

        // Resume conversation if it was paused
        const approvalSettings = settingsRepository.getActionApprovalSettings();
        if (approvalSettings.pauseOnApproval && this.isPaused && this.npcQueue.length > 0) {
            this.resumeConversation();
        }
    }
    /**
     * Create a summary for a character that is leaving the conversation
     * @param characterId - The ID of the character leaving
     * @param summaryPrompt - The prompt messages to use for generating the summary
     * @returns The generated summary or null if failed
     */
    async createCharacterLeavingSummary(characterId: number, summaryPrompt: any[]): Promise<string | null> {
        const character = this.gameData.characters.get(characterId);
        if (!character) {
            console.error(`Character ${characterId} not found for leaving summary`);
            return null;
        }

        console.log(`Creating leaving summary for ${character.fullName}`);

        try {
            const estimatedTokens = this.estimateTokenCount(summaryPrompt);
            console.log(`[TOKEN_COUNT] Character leaving summary for ${character.fullName}: ${estimatedTokens}`);
            
            const result = await llmManager.sendSummaryRequest(summaryPrompt);

            if (result && typeof result === 'object' && 'content' in result) {
                const summary = result.content as string;
                console.log(`Generated leaving summary for ${character.fullName}: ${summary.substring(0, 100)}...`);
                return summary;
            }

            console.error('Invalid response format for character leaving summary');
            return null;
        } catch (error) {
            console.error(`Failed to create leaving summary for ${character.fullName}:`, error);
            return null;
        }
    }

    /**
     * Remove a character from the conversation entirely
     */
    removeCharacterFromConversation(characterId: number): void {
        const character = this.gameData.characters.get(characterId);
        if (!character) {
            console.warn(`Character ${characterId} not found in conversation`);
            return;
        }

        console.log(`Removing ${character.fullName} from conversation`);

        // Remove from characters map
        this.gameData.characters.delete(characterId);

        // Remove from NPC queue if present
        const initialQueueLength = this.npcQueue.length;
        this.npcQueue = this.npcQueue.filter(char => char.id !== characterId);
        if (this.npcQueue.length < initialQueueLength) {
            console.log(`Removed ${character.fullName} from NPC queue`);
        }

        // Remove from custom queue if exists
        if (this.customQueue) {
            const initialCustomQueueLength = this.customQueue.length;
            this.customQueue = this.customQueue.filter(char => char.id !== characterId);
            if (this.customQueue.length < initialCustomQueueLength) {
                console.log(`Removed ${character.fullName} from custom queue`);
            }
        }

        // Clear any pending action approvals for this character
        const approvalsToRemove: number[] = [];
        for (const [approvalId, pending] of this.pendingActionApprovals.entries()) {
            if (pending.npc.id === characterId) {
                approvalsToRemove.push(approvalId);
            }
        }
        
        for (const approvalId of approvalsToRemove) {
            this.pendingActionApprovals.delete(approvalId);
            
            // Remove approval entry from messages
            const entryIndex = this.messages.findIndex(
                msg => msg.type === 'action-approval' && msg.id === approvalId
            );
            
            if (entryIndex !== -1) {
                this.messages.splice(entryIndex, 1);
                console.log(`Removed pending action approval for ${character.fullName}`);
            }
        }

        console.log(`Character ${character.fullName} successfully removed from conversation`);
        this.emitUpdate();
    }
}
