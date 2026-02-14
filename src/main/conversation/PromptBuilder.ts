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
            try {
                const suffixContent = this.templateEngine.renderTemplateString(promptSettings.suffix.template, context);
                llmMessages.push({ role: 'system', content: suffixContent });
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                throw new Error(`Template error in Suffix block: ${errorMsg}`);
            }
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

    private static applyBlock(block: PromptBlock, messages: any[], history: any[], baseContext: any, promptSettings: PromptSettings): void {
        const { character, gameData, summary } = baseContext;

        const renderTemplate = (template: string, context: any): string => {
            try {
                return this.templateEngine.renderTemplateString(template, context);
            } catch (error) {
                const blockLabel = block.label || block.type;
                const errorMsg = error instanceof Error ? error.message : String(error);
                throw new Error(`Template error in block "${blockLabel}" (${block.type}): ${errorMsg}`);
            }
        };

        switch (block.type) {
            case 'main': {
                const template = promptSettings.mainTemplate || promptConfigManager.getDefaultMainTemplateContent();
                const content = renderTemplate(template, baseContext);
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
                        ? renderTemplate(block.template, { ...baseContext, pastSummaries })
                        : pastSummaries;
                    messages.push({ role: block.role || 'system', content });
                }
                break;
            }
            case 'rolling_summary': {
                if (summary) {
                    const tpl = block.template || 'Summary of earlier messages in this conversation:\n{{summary}}';
                    const content = renderTemplate(tpl, { ...baseContext, summary });
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
                const content = renderTemplate(tpl, baseContext);
                messages.push({
                    role: block.role || 'user',
                    content
                });
                break;
            }
            case 'custom': {
                if (!block.template) break;
                const content = renderTemplate(block.template, baseContext);
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
                const suffixTokens = TokenCounter.estimateTokens(suffixContent);
                llmMessages.push({ role: 'system', content: suffixContent });
                blocksWithTokens.push({ block: suffixBlock, content: suffixContent, tokens: suffixTokens });
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error('Template error in Suffix block:', errorMsg);
                blocksWithTokens.push({ block: suffixBlock, content: '', tokens: 0, error: `Template error in Suffix block. Check Handlebars syntax.` });
            }
        }

        const totalTokens = TokenCounter.calculateTotalTokens(llmMessages);

        return {
            messages: llmMessages,
            blocks: blocksWithTokens,
            totalTokens
        };
    }

    /**
     * Apply a single block with token counting.
     * Template errors are caught and returned as error info in the result rather than thrown.
     */
    private static applyBlockWithTokenCount(
        block: PromptBlock,
        messages: any[],
        history: any[],
        baseContext: any,
        promptSettings: PromptSettings
    ): PromptBlockWithTokens | null {
        const { character, gameData, summary } = baseContext;

        const renderTemplate = (template: string, context: any): string | null => {
            try {
                return this.templateEngine.renderTemplateString(template, context);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`Template error in block "${block.label || block.type}":`, errorMsg);
                return null;
            }
        };
        
        switch (block.type) {
            case 'main': {
                const template = promptSettings.mainTemplate || promptConfigManager.getDefaultMainTemplateContent();
                const content = renderTemplate(template, baseContext);
                if (content === null) {
                    return { block, content: '', tokens: 0, error: `Template error in "${block.label || 'Main Prompt'}" block. Check Handlebars syntax.` };
                }
                if (content?.trim()) {
                    messages.push({ role: block.role || 'system', content });
                    return { block, content, tokens: TokenCounter.estimateTokens(content) };
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
                        return { block, content: descriptionBlock, tokens: TokenCounter.estimateTokens(descriptionBlock) };
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error('Failed to run description script:', error);
                    return { block, content: '', tokens: 0, error: `Script error: ${errorMsg}` };
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
                        return { block, content, tokens: TokenCounter.calculateTotalTokens(exampleMessages) };
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error('Failed to run example script:', error);
                    return { block, content: '', tokens: 0, error: `Script error: ${errorMsg}` };
                }
                break;
            }
            case 'memories': {
                try {
                    const memoriesBlock = this.buildMemoriesBlock(gameData, block.limit ?? 5, block.template, baseContext);
                    if (memoriesBlock) {
                        messages.push({ role: block.role || 'system', content: memoriesBlock });
                        return { block, content: memoriesBlock, tokens: TokenCounter.estimateTokens(memoriesBlock) };
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    return { block, content: '', tokens: 0, error: `Template error in "${block.label || 'Memories'}" block: ${errorMsg}` };
                }
                break;
            }
            case 'past_summaries': {
                const pastSummaries = this.buildPastSummariesContext(character, gameData);
                if (pastSummaries) {
                    const content = block.template
                        ? renderTemplate(block.template, { ...baseContext, pastSummaries })
                        : pastSummaries;
                    if (content === null) {
                        return { block, content: '', tokens: 0, error: `Template error in "${block.label || 'Past Summaries'}" block. Check Handlebars syntax.` };
                    }
                    messages.push({ role: block.role || 'system', content });
                    return { block, content, tokens: TokenCounter.estimateTokens(content) };
                }
                break;
            }
            case 'rolling_summary': {
                if (summary) {
                    const tpl = block.template || 'Summary of earlier messages in this conversation:\n{{summary}}';
                    const content = renderTemplate(tpl, { ...baseContext, summary });
                    if (content === null) {
                        return { block, content: '', tokens: 0, error: `Template error in "${block.label || 'Rolling Summary'}" block. Check Handlebars syntax.` };
                    }
                    messages.push({ role: block.role || 'system', content });
                    return { block, content, tokens: TokenCounter.estimateTokens(content) };
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
                return { block, content, tokens: TokenCounter.calculateTotalTokens(historyMessages) };
            }
            case 'instruction': {
                const tpl = block.template || '[Write next reply only as {{character.fullName}}]';
                const content = renderTemplate(tpl, baseContext);
                if (content === null) {
                    return { block, content: '', tokens: 0, error: `Template error in "${block.label || 'Instruction'}" block. Check Handlebars syntax.` };
                }
                messages.push({ role: block.role || 'user', content });
                return { block, content, tokens: TokenCounter.estimateTokens(content) };
            }
            case 'custom': {
                if (!block.template) break;
                const content = renderTemplate(block.template, baseContext);
                if (content === null) {
                    return { block, content: '', tokens: 0, error: `Template error in "${block.label || 'Custom'}" block. Check Handlebars syntax.` };
                }
                messages.push({ role: block.role || 'system', content });
                return { block, content, tokens: TokenCounter.estimateTokens(content) };
            }
            default:
                break;
        }
        
        return null;
    }
}
