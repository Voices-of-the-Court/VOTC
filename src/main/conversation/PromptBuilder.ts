import { GameData, Memory } from "../gameData/GameData";
import { Character } from "../gameData/Character";
import { Message } from "./types";
import { TemplateEngine } from "./TemplateEngine";
import { PromptScriptLoader } from "./PromptScriptLoader";
import { settingsRepository } from "../SettingsRepository";
import { promptConfigManager } from "./PromptConfigManager";
import { PromptBlock, PromptSettings } from "../llmProviders/types";
import { TokenCounter } from "../utils/TokenCounter";

export interface PromptBlockWithTokens {
    block: PromptBlock;
    content: string;
    tokens: number;
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
        
        prompt.push({
            role: 'user',
            content: existingSummary 
                ? 'Update the previous summary by incorporating the new messages. Create a cohesive summary that includes both the previous events and the new information. Keep it concise but preserve important details like character names, key events, decisions, and emotional moments. Please summarize the conversation into a single paragraph.'
                : 'Create a concise summary of these messages. Preserve important details like character names, key events, decisions, relationship developments, and emotional moments. Keep it brief but informative. Please summarize the conversation into a single paragraph.'
        });
        
        return prompt;
    }

    /**
     * Generate a system prompt based on the characters in the conversation
     */
    static generateSystemPrompt(char: Character, gameData: GameData): string {
        const promptSettings = settingsRepository.getPromptSettings();
        const templatePath = promptConfigManager.resolvePath(promptSettings.defaultMainTemplatePath);

        if (gameData.characters.size === 0 || !char) {
            console.log('No characters or main character missing for system prompt');
            return "You are characters in a medieval strategy game. Engage in conversation naturally.";
        }

        try {
            const rendered = this.templateEngine.renderTemplate(templatePath, {
                character: char,
                gameData
            });
            return rendered;
        } catch (error) {
            console.error('Failed to render system template, using fallback:', error);
        }

        return "You are characters in a medieval strategy game. Engage in conversation naturally.";
    }

    /**
     * Build the full LLM messages array for a character response
     */
    // static buildMessages(history: Message[], char: Character, gameData: GameData): any[] {
    //     const systemPrompt = this.generateSystemPrompt(char, gameData);
    //     const llmMessages: any[] = [
    //         { role: 'system', content: systemPrompt },
    //         ...history.map(m => ({ role: m.role, content: `${m.name}: ${m.content}` })),
    //         { role: 'user', content: `[Write next reply only as ${char.shortName}]`}
    //     ];
    //     return llmMessages;
    // }


    static buildMessages(
        history: Message[], 
        char: Character, 
        gameData: GameData,
        currentSessionSummary?: string
    ): any[] {
        const promptSettings = settingsRepository.getPromptSettings();
        const blocks = promptSettings.blocks || [];
        const llmMessages: any[] = [];

        const context = {
            character: char,
            gameData,
            summary: currentSessionSummary,
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
            this.applyBlock(block, llmMessages, workingHistory, context, promptSettings);
        }

        if (promptSettings.suffix?.enabled && promptSettings.suffix.template) {
            const suffixContent = this.templateEngine.renderTemplateString(promptSettings.suffix.template, context);
            llmMessages.push({ role: 'system', content: suffixContent });
        }

        return llmMessages;
    }

        /**
     * Build context from character's past conversation summaries
     */
    static buildPastSummariesContext(char: Character, gameData: GameData): string | null {
        if (!char.conversationSummaries || char.conversationSummaries.length === 0) {
            return null;
        }
        
        let context = `Here are the date and summary of previous conversations between ${char.shortName}, ${gameData.playerName}, and other characters:\n`;
        
        // Include most recent 3-5 conversation summaries
        const recentSummaries = char.conversationSummaries.slice(0, 5);
        
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
        content: `${title}\n` + msgs.map(m => `${m.name}: ${m.content}`).join('\n')
    });

    const userPrompt = {
        role: 'user',
        content: `Create a detailed summary of this conversation. Include:
- Key events and decisions made
- Important character interactions and relationship developments
- Plot developments and revelations
- Emotional moments and conflicts
- Any agreements, promises, or plans made
Please summarize the conversation into only a single paragraph.`
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

    private static applyBlock(block: PromptBlock, messages: any[], history: any[], baseContext: any, promptSettings: PromptSettings): void {
        const { character, gameData, summary } = baseContext;
        switch (block.type) {
            case 'main': {
                const template = promptSettings.mainTemplate || promptConfigManager.getDefaultMainTemplateContent();
                const content = this.templateEngine.renderTemplateString(template, baseContext);
                if (content?.trim()) {
                    messages.push({ role: block.role || 'system', content });
                }
                break;
            }
            case 'description': {
                if (!block.scriptPath) break;
                const descScriptPath = promptConfigManager.resolvePath(block.scriptPath);
                try {
                    const descriptionBlock = this.scriptLoader.executeDescription(descScriptPath, gameData, character.id);
                    if (descriptionBlock) {
                        messages.push({ role: 'system', content: descriptionBlock });
                    }
                } catch (error) {
                    console.error('Failed to run description script:', error);
                }
                break;
            }
            case 'examples': {
                if (!block.scriptPath) break;
                const examplesScriptPath = promptConfigManager.resolvePath(block.scriptPath);
                try {
                    const exampleMessages = this.scriptLoader.executeExamples(examplesScriptPath, gameData, character.id);
                    if (Array.isArray(exampleMessages) && exampleMessages.length > 0) {
                        messages.push(...exampleMessages);
                    }
                } catch (error) {
                    console.error('Failed to run example script:', error);
                }
                break;
            }
            case 'memories': {
                const memoriesBlock = this.buildMemoriesBlock(gameData, block.limit ?? 5, block.template, baseContext);
                if (memoriesBlock) {
                    messages.push({ role: block.role || 'system', content: memoriesBlock });
                }
                break;
            }
            case 'past_summaries': {
                const pastSummaries = this.buildPastSummariesContext(character, gameData);
                if (pastSummaries) {
                    const content = block.template
                        ? this.templateEngine.renderTemplateString(block.template, { ...baseContext, pastSummaries })
                        : pastSummaries;
                    messages.push({ role: block.role || 'system', content });
                }
                break;
            }
            case 'rolling_summary': {
                if (summary) {
                    const tpl = block.template || 'Summary of earlier messages in this conversation:\n{{summary}}';
                    const content = this.templateEngine.renderTemplateString(tpl, { ...baseContext, summary });
                    messages.push({ role: block.role || 'system', content });
                }
                break;
            }
            case 'history': {
                messages.push(
                    ...history.map(m => ({
                        role: m.role,
                        content: m.name ? `${m.name}: ${m.content}` : m.content
                    }))
                );
                break;
            }
            case 'instruction': {
                const tpl = block.template || '[Write next reply only as {{character.fullName}}]';
                const content = this.templateEngine.renderTemplateString(tpl, baseContext);
                messages.push({
                    role: block.role || 'user',
                    content
                });
                break;
            }
            case 'custom': {
                if (!block.template) break;
                const content = this.templateEngine.renderTemplateString(block.template, baseContext);
                messages.push({ role: block.role || 'system', content });
                break;
            }
            default:
                break;
        }
    }

    /**
     * Build messages with token counting for preview
     */
    static buildMessagesWithTokenCount(
        history: Message[],
        char: Character,
        gameData: GameData,
        currentSessionSummary?: string
    ): PromptPreviewResult {
        const promptSettings = settingsRepository.getPromptSettings();
        const blocks = promptSettings.blocks || [];
        const llmMessages: any[] = [];
        const blocksWithTokens: PromptBlockWithTokens[] = [];

        const context = {
            character: char,
            gameData,
            summary: currentSessionSummary,
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
            
            const result = this.applyBlockWithTokenCount(block, llmMessages, workingHistory, context, promptSettings);
            if (result) {
                blocksWithTokens.push(result);
            }
        }

        if (promptSettings.suffix?.enabled && promptSettings.suffix.template) {
            const suffixContent = this.templateEngine.renderTemplateString(promptSettings.suffix.template, context);
            const suffixTokens = TokenCounter.estimateTokens(suffixContent);
            llmMessages.push({ role: 'system', content: suffixContent });
            
            blocksWithTokens.push({
                block: {
                    id: 'suffix',
                    type: 'custom' as any,
                    label: promptSettings.suffix.label || 'Suffix',
                    enabled: true,
                    role: 'system',
                    template: promptSettings.suffix.template
                },
                content: suffixContent,
                tokens: suffixTokens
            });
        }

        const totalTokens = TokenCounter.calculateTotalTokens(llmMessages);

        return {
            messages: llmMessages,
            blocks: blocksWithTokens,
            totalTokens
        };
    }

    /**
     * Apply a single block with token counting
     */
    private static applyBlockWithTokenCount(
        block: PromptBlock,
        messages: any[],
        history: any[],
        baseContext: any,
        promptSettings: PromptSettings
    ): PromptBlockWithTokens | null {
        const { character, gameData, summary } = baseContext;
        const startLength = messages.length;
        
        switch (block.type) {
            case 'main': {
                const template = promptSettings.mainTemplate || promptConfigManager.getDefaultMainTemplateContent();
                const content = this.templateEngine.renderTemplateString(template, baseContext);
                if (content?.trim()) {
                    messages.push({ role: block.role || 'system', content });
                    return {
                        block,
                        content,
                        tokens: TokenCounter.estimateTokens(content)
                    };
                }
                break;
            }
            case 'description': {
                if (!block.scriptPath) break;
                const descScriptPath = promptConfigManager.resolvePath(block.scriptPath);
                try {
                    const descriptionBlock = this.scriptLoader.executeDescription(descScriptPath, gameData, character.id);
                    if (descriptionBlock) {
                        messages.push({ role: 'system', content: descriptionBlock });
                        return {
                            block,
                            content: descriptionBlock,
                            tokens: TokenCounter.estimateTokens(descriptionBlock)
                        };
                    }
                } catch (error) {
                    console.error('Failed to run description script:', error);
                }
                break;
            }
            case 'examples': {
                if (!block.scriptPath) break;
                const examplesScriptPath = promptConfigManager.resolvePath(block.scriptPath);
                try {
                    const exampleMessages = this.scriptLoader.executeExamples(examplesScriptPath, gameData, character.id);
                    if (Array.isArray(exampleMessages) && exampleMessages.length > 0) {
                        messages.push(...exampleMessages);
                        const content = exampleMessages.map(m => `${m.role}: ${m.content}`).join('\n\n');
                        return {
                            block,
                            content,
                            tokens: TokenCounter.calculateTotalTokens(exampleMessages)
                        };
                    }
                } catch (error) {
                    console.error('Failed to run example script:', error);
                }
                break;
            }
            case 'memories': {
                const memoriesBlock = this.buildMemoriesBlock(gameData, block.limit ?? 5, block.template, baseContext);
                if (memoriesBlock) {
                    messages.push({ role: block.role || 'system', content: memoriesBlock });
                    return {
                        block,
                        content: memoriesBlock,
                        tokens: TokenCounter.estimateTokens(memoriesBlock)
                    };
                }
                break;
            }
            case 'past_summaries': {
                const pastSummaries = this.buildPastSummariesContext(character, gameData);
                if (pastSummaries) {
                    const content = block.template
                        ? this.templateEngine.renderTemplateString(block.template, { ...baseContext, pastSummaries })
                        : pastSummaries;
                    messages.push({ role: block.role || 'system', content });
                    return {
                        block,
                        content,
                        tokens: TokenCounter.estimateTokens(content)
                    };
                }
                break;
            }
            case 'rolling_summary': {
                if (summary) {
                    const tpl = block.template || 'Summary of earlier messages in this conversation:\n{{summary}}';
                    const content = this.templateEngine.renderTemplateString(tpl, { ...baseContext, summary });
                    messages.push({ role: block.role || 'system', content });
                    return {
                        block,
                        content,
                        tokens: TokenCounter.estimateTokens(content)
                    };
                }
                break;
            }
            case 'history': {
                const historyMessages = history.map(m => ({
                    role: m.role,
                    content: m.name ? `${m.name}: ${m.content}` : m.content
                }));
                messages.push(...historyMessages);
                const content = historyMessages.map(m => `${m.role}: ${m.content}`).join('\n\n');
                return {
                    block,
                    content,
                    tokens: TokenCounter.calculateTotalTokens(historyMessages)
                };
            }
            case 'instruction': {
                const tpl = block.template || '[Write next reply only as {{character.fullName}}]';
                const content = this.templateEngine.renderTemplateString(tpl, baseContext);
                messages.push({
                    role: block.role || 'user',
                    content
                });
                return {
                    block,
                    content,
                    tokens: TokenCounter.estimateTokens(content)
                };
            }
            case 'custom': {
                if (!block.template) break;
                const content = this.templateEngine.renderTemplateString(block.template, baseContext);
                messages.push({ role: block.role || 'system', content });
                return {
                    block,
                    content,
                    tokens: TokenCounter.estimateTokens(content)
                };
            }
            default:
                break;
        }
        
        return null;
    }
}
