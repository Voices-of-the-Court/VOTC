import { GameData, Memory } from "../gameData/GameData";
import { Character } from "../gameData/Character";
import { Message } from "./types";
import { TemplateEngine } from "./TemplateEngine";
import { PromptScriptLoader } from "./PromptScriptLoader";
import { settingsRepository } from "../SettingsRepository";
import { promptConfigManager } from "./PromptConfigManager";
import { PromptBlock, PromptSettings } from "@llmTypes";
import { TokenCounter, StateDiffer } from "../utils";

export interface PromptBlockWithTokens {
    block: PromptBlock;
    content: string;
    tokens: number;
    messages?: any[];
    error?: string;
}

export interface PromptPreviewResult {
    messages: Array<{ role: string; content: string; name?: string }>;
    blocks: PromptBlockWithTokens[];
    totalTokens: number;
}

export class PromptBuilder {
        private static templateEngine = new TemplateEngine();
        private static scriptLoader = new PromptScriptLoader();
        /**
     * Build prompt for resummarization
     */
    static buildResummarizePrompt(
        messagesToSummarize: Message[],
        existingSummary?: string
    ): any[] {
        const prompt: any[] = [];
        
        if (existingSummary) {
            prompt.push({
                role: 'system',
                content: `Previous summary of this conversation:\n\n${existingSummary}`
            });
        }
        
        prompt.push({
            role: 'system',
            content: 'New messages to incorporate into the summary:\n\n' +
                messagesToSummarize.map(m => `${m.name}: ${m.content}`).join('\n')
        });

        const summarySettings = settingsRepository.getSummaryPromptSettings();
        
        prompt.push({
            role: 'user',
            content: summarySettings.rollingPrompt
        });
        
        return prompt;
    }

    static buildMessages(
        history: Message[],
        char: Character,
        gameData: GameData,
        currentSessionSummary?: string,
        frozenGameData?: GameData,
        opts?: {
            /** Filled with the index of the last USER message emitted by the history block. */
            cacheBoundary?: { lastHistoryUserMessageIndex: number | null };
        }
    ): any[] {
        const promptSettings = settingsRepository.getPromptSettings();
        const blocks = promptSettings.blocks || [];
        const llmMessages: any[] = [];
        const errors: string[] = [];

        // When prompt caching is enabled, a frozen gameData snapshot renders STABLE
        // cached prefix. The live gameData feeds the 'current_state' block, which sits right
        // after History and renders the live scene + a small per-turn diff, so the
        // model sees current state without invalidating the cached prefix.
        const prefixGameData: GameData = frozenGameData || gameData;
        // The current character in the frozen snapshot (by id); fall back to live char.
        const prefixChar: Character = (frozenGameData && frozenGameData.characters.get(char.id)) || char;

        const context = {
            character: prefixChar,
            gameData: prefixGameData,
            summary: currentSessionSummary,
            liveGameData: gameData,
            frozenGameData: frozenGameData,
        };

        const workingHistory: any[] = history
            .map(m => ({
                role: m.role,
                name: m.name,
                content: m.content
            }))
            .filter(m => !!m.content);

        let lastHistoryUserMessageIndex: number | null = null;

        for (const block of blocks) {
            if (!block.enabled) continue;
            const result = this.applyBlock(block, workingHistory, context, promptSettings);
            if (!result) continue;
            if (result.messages?.length) {
                if (block.type === 'history') {
                    for (let k = 0; k < result.messages.length; k++) {
                        if (result.messages[k].role === 'user') {
                            lastHistoryUserMessageIndex = llmMessages.length + k;
                        }
                    }
                }
                llmMessages.push(...result.messages);
            }
            if (result.error) {
                errors.push(result.error);
            }
        }

        if (promptSettings.suffix?.enabled && promptSettings.suffix.template) {
            try {
                const suffixContent = this.templateEngine.renderTemplateString(promptSettings.suffix.template, context);
                llmMessages.push({ role: 'system', content: suffixContent });
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                errors.push(`Template error in Suffix block: ${errorMsg}`);
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }

        if (opts?.cacheBoundary) {
            opts.cacheBoundary.lastHistoryUserMessageIndex = lastHistoryUserMessageIndex;
        }

        return llmMessages;
    }

    private static renderCurrentState(
        frozenGameData: GameData | undefined,
        liveGameData: GameData,
        prefixChar: Character
    ): string | null {
        // Inert unless caching is enabled
        if (!frozenGameData) return null;

        const liveChar: Character = liveGameData.characters.get(prefixChar.id) || prefixChar;
        const parts: string[] = [];

        try {
            const sceneText = StateDiffer.renderCurrentScene(liveGameData, liveChar);
            if (sceneText) parts.push(sceneText);
        } catch (e) {
            console.error('[PromptBuilder] Failed to render current scene block:', e);
        }

        try {
            const diffText = StateDiffer.renderDiff(frozenGameData, liveGameData);
            if (diffText) parts.push(diffText);
        } catch (e) {
            console.error('[PromptBuilder] Failed to render state diff block:', e);
        }

        return parts.length > 0 ? parts.join('\n\n') : null;
    }

        /**
     * Build context from character's past conversation summaries
     */
    static buildPastSummariesContext(char: Character, gameData: GameData): string | null {
        if (!char.conversationSummaries || char.conversationSummaries.length === 0) {
            return null;
        }
        
        const summarySettings = settingsRepository.getSummaryPromptSettings();
        const maxSummaries = summarySettings.maxPastSummaries ?? 5;
        
        let context = `Here are the date and summary of previous conversations between ${char.shortName}, ${gameData.playerName}, and other characters:\n`;
        
        // Include most recent conversation summaries (limited by setting)
        const recentSummaries = char.conversationSummaries.slice(0, maxSummaries);
        
        for (const summary of recentSummaries) {
            const timeAgo = this.getRelativeTime(summary.totalDays, gameData.totalDays);
            if (!timeAgo) {
                context += `${summary.date}: ${summary.content}\n`;
            }
            else {
                context += `${summary.date} (${timeAgo}): ${summary.content}\n`;
            }
        }
        
        return context;
    }

/**
 * Build a final, comprehensive summary using all roleplay messages.
 */
static buildFinalSummary(
    gameData: GameData,
    history: Message[],
    currentSummary?: string,
    lastSummarizedMessageIndex?: number
): any[] {
    const characters = Array.from(gameData.characters.values())
        .map(c => c.shortName)
        .join(', ');

    const baseSystem = {
        role: 'system',
        content: `You are summarizing a medieval roleplay conversation between these characters: ${characters}.`
    };

    const buildConversationText = (msgs: Message[], title: string) => ({
        role: 'system',
        content: `${title}\n\n` + msgs.map(m => `${m.name}: ${m.content}`).join('\n')
    });

    const summarySettings = settingsRepository.getSummaryPromptSettings();

    const userPrompt = {
        role: 'user',
        content: summarySettings.finalPrompt
    };

    // Determine whether to include all messages or only the new ones
    if (lastSummarizedMessageIndex == null) {
        return [
            baseSystem,
            buildConversationText(history, 'Full conversation:'),
            userPrompt
        ];
    }

    const newMessages = history.slice(lastSummarizedMessageIndex);
    return [
        baseSystem,
        { role: 'system', content: 'Previous summary of this conversation:\n' + currentSummary },
        buildConversationText(newMessages, 'Recent conversation:'),
        userPrompt
    ];
}


    /**
     * Calculate relative time between dates
     */
    private static getRelativeTime(pastDateTotalDays: number, currentDateTotalDays: number): string | null {
        // check if pastDatrTotal is undefined
        if (pastDateTotalDays === undefined) {
            return null;
        }
        const timeDifference = currentDateTotalDays - pastDateTotalDays;

        if (timeDifference < 1) {
            return 'less than a day ago';
        }

        if (timeDifference < 7) {
            return `${timeDifference} days ago`;
        }

        if (timeDifference < 30) {
            return `${Math.floor(timeDifference / 7)} weeks ago`;
        }

        if (timeDifference < 365) {
            return `${Math.floor(timeDifference / 30)} months ago`;
        }

        return `${Math.floor(timeDifference / 365)} years ago`;
    }

    private static buildMemoriesBlock(gameData: GameData, limit = 5, template?: string, context: any = {}): string | null {
        const allMemories: Memory[] = [];
        gameData.characters.forEach((value) => {
            if (value?.memories) {
                allMemories.push(...value.memories);
            }
        });
        if (allMemories.length === 0) return null;
        const sorted = allMemories.sort((a, b) => (b.relevanceWeight ?? 0) - (a.relevanceWeight ?? 0));
        const selected = sorted.slice(0, limit);
        const tpl = template || 'Relevant memories:\n{{#each memories}}- {{this.creationDate}}: {{this.desc}}\n{{/each}}';
        return this.templateEngine.renderTemplateString(tpl, { ...context, memories: selected });
    }

    private static applyBlock(
        block: PromptBlock,
        history: any[],
        baseContext: any,
        promptSettings: PromptSettings
    ): PromptBlockWithTokens | null {
        const { character, gameData, summary } = baseContext;
        const label = block.label || block.type;

        const errorResult = (message: string): PromptBlockWithTokens => ({
            block,
            content: '',
            tokens: 0,
            error: message
        });

        const renderTemplate = (template: string, context: any): string => {
            try {
                return this.templateEngine.renderTemplateString(template, context);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                throw new Error(`Template error in "${label}" block: ${errorMsg}`);
            }
        };

        const scriptErrorResult = (error: unknown): PromptBlockWithTokens => {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return errorResult(`Script error in "${label}" block: ${errorMsg}`);
        };

        try {
            switch (block.type) {
                case 'main': {
                    const template = promptSettings.mainTemplate || promptConfigManager.getDefaultMainTemplateContent();
                    const content = renderTemplate(template, baseContext);
                    if (content?.trim()) {
                        const role = block.role || 'system';
                        const messages = [{ role, content }];
                        return { block, content, tokens: TokenCounter.estimateTokens(content), messages };
                    }
                    return null;
                }
                case 'description': {
                    if (!block.scriptPath) return null;
                    const descScriptPath = promptConfigManager.resolvePath(block.scriptPath);
                    let descriptionBlock: string;
                    try {
                        descriptionBlock = this.scriptLoader.executeDescription(descScriptPath, gameData, character.id);
                    } catch (error) {
                        return scriptErrorResult(error);
                    }
                    if (descriptionBlock) {
                        const role = block.role || 'system';
                        const messages = [{ role, content: descriptionBlock }];
                        return { block, content: descriptionBlock, tokens: TokenCounter.estimateTokens(descriptionBlock), messages };
                    }
                    return null;
                }
                case 'examples': {
                    if (!block.scriptPath) return null;
                    const examplesScriptPath = promptConfigManager.resolvePath(block.scriptPath);
                    let exampleMessages: any[];
                    try {
                        exampleMessages = this.scriptLoader.executeExamples(examplesScriptPath, gameData, character.id);
                    } catch (error) {
                        return scriptErrorResult(error);
                    }
                    if (!Array.isArray(exampleMessages) || exampleMessages.length === 0) return null;

                    const defaultRole = block.role || 'system';
                    let messages: any[];
                    let content: string;

                    if (block.examplesAsText) {
                        // Flatten example messages into a single plain-text block using the
                        // configured role to avoid role-ordering issues on picky LLMs.
                        content = exampleMessages
                            .map(m => `${m.role || defaultRole}: ${m.content}`)
                            .join('\n\n');
                        messages = [{ role: defaultRole, content }];
                    } else {
                        // Push examples as individual messages. An explicit script role is
                        // preserved; block.role only acts as the fallback default.
                        messages = exampleMessages.map(m => ({
                            role: m.role || defaultRole,
                            content: m.content
                        }));
                        content = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
                    }

                    return { block, content, tokens: TokenCounter.calculateTotalTokens(messages), messages };
                }
                case 'memories': {
                    let memoriesBlock: string | null;
                    try {
                        memoriesBlock = this.buildMemoriesBlock(gameData, block.limit ?? 5, block.template, baseContext);
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        return errorResult(`Template error in "${label}" block: ${errorMsg}`);
                    }
                    if (memoriesBlock) {
                        const role = block.role || 'system';
                        const messages = [{ role, content: memoriesBlock }];
                        return { block, content: memoriesBlock, tokens: TokenCounter.estimateTokens(memoriesBlock), messages };
                    }
                    return null;
                }
                case 'past_summaries': {
                    const pastSummaries = this.buildPastSummariesContext(character, gameData);
                    if (!pastSummaries) return null;
                    const content = block.template
                        ? renderTemplate(block.template, { ...baseContext, pastSummaries })
                        : pastSummaries;
                    const role = block.role || 'system';
                    const messages = [{ role, content }];
                    return { block, content, tokens: TokenCounter.estimateTokens(content), messages };
                }
                case 'rolling_summary': {
                    if (!summary) return null;
                    const tpl = block.template || 'Summary of earlier messages in this conversation:\n{{summary}}';
                    const content = renderTemplate(tpl, { ...baseContext, summary });
                    const role = block.role || 'system';
                    const messages = [{ role, content }];
                    return { block, content, tokens: TokenCounter.estimateTokens(content), messages };
                }
                case 'history': {
                    const messages = history.map(m => ({
                        role: m.role,
                        content: m.name ? `${m.name}: ${m.content}` : m.content
                    }));
                    const content = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
                    return { block, content, tokens: TokenCounter.calculateTotalTokens(messages), messages };
                }
                case 'current_state': {
                    // Live tail for prompt caching. Renders nothing on caching off.
                    const content = this.renderCurrentState(
                        baseContext.frozenGameData,
                        baseContext.liveGameData,
                        character
                    );
                    if (content) {
                        const role = block.role || 'system';
                        const messages = [{ role, content }];
                        return { block, content, tokens: TokenCounter.estimateTokens(content), messages };
                    }
                    return null;
                }
                case 'instruction': {
                    const tpl = block.template || '[Write next reply only as {{character.fullName}}]';
                    const content = renderTemplate(tpl, baseContext);
                    const role = block.role || 'user';
                    const messages = [{ role, content }];
                    return { block, content, tokens: TokenCounter.estimateTokens(content), messages };
                }
                case 'custom': {
                    if (!block.template) return null;
                    const content = renderTemplate(block.template, baseContext);
                    const role = block.role || 'system';
                    const messages = [{ role, content }];
                    return { block, content, tokens: TokenCounter.estimateTokens(content), messages };
                }
                default:
                    return null;
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return errorResult(errorMsg);
        }
    }

    /**
     * Build messages with token counting for preview
     */
    static buildMessagesWithTokenCount(
        history: Message[],
        char: Character,
        gameData: GameData,
        currentSessionSummary?: string,
        frozenGameData?: GameData
    ): PromptPreviewResult {
        const promptSettings = settingsRepository.getPromptSettings();
        const blocks = promptSettings.blocks || [];
        const llmMessages: any[] = [];
        const blocksWithTokens: PromptBlockWithTokens[] = [];

        const prefixGameData: GameData = frozenGameData || gameData;
        const prefixChar: Character = (frozenGameData && frozenGameData.characters.get(char.id)) || char;

        const context = {
            character: prefixChar,
            gameData: prefixGameData,
            summary: currentSessionSummary,
            liveGameData: gameData,
            frozenGameData: frozenGameData,
        };

        const workingHistory: any[] = history
            .map(m => ({
                role: m.role,
                name: m.name,
                content: m.content
            }))
            .filter(m => !!m.content);

        for (const block of blocks) {
            if (!block.enabled) continue;
            const result = this.applyBlock(block, workingHistory, context, promptSettings);
            if (!result) continue;
            if (result.messages?.length) {
                llmMessages.push(...result.messages);
            }
            blocksWithTokens.push(result);
        }

        if (promptSettings.suffix?.enabled && promptSettings.suffix.template) {
            const suffixBlock: PromptBlock = {
                id: 'suffix',
                type: 'custom' as any,
                label: promptSettings.suffix.label || 'Suffix',
                enabled: true,
                role: 'system',
                template: promptSettings.suffix.template
            };
            try {
                const suffixContent = this.templateEngine.renderTemplateString(promptSettings.suffix.template, context);
                llmMessages.push({ role: 'system', content: suffixContent });
                blocksWithTokens.push({
                    block: suffixBlock,
                    content: suffixContent,
                    tokens: TokenCounter.estimateTokens(suffixContent),
                    messages: [{ role: 'system', content: suffixContent }]
                });
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                blocksWithTokens.push({ block: suffixBlock, content: '', tokens: 0, error: `Template error in Suffix block: ${errorMsg}` });
            }
        }

        const totalTokens = TokenCounter.calculateTotalTokens(llmMessages);

        return {
            messages: llmMessages,
            blocks: blocksWithTokens,
            totalTokens
        };
    }
}
