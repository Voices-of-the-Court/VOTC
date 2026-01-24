import { TemplateEngine } from "../conversation/TemplateEngine";
import { PromptScriptLoader } from "../conversation/PromptScriptLoader";
import { promptConfigManager } from "../conversation/PromptConfigManager";
import { settingsRepository } from "../SettingsRepository";
import { GameData } from "../gameData/GameData";
import { Character } from "../gameData/Character";
import { PromptBlock, PromptSettings, ILLMMessage } from "../llmProviders/types";
import { LetterData } from "./types";

export class LetterPromptBuilder {
  private templateEngine = new TemplateEngine();
  private scriptLoader = new PromptScriptLoader();

  buildMessages(gameData: GameData, letter: LetterData): ILLMMessage[] {
    const ai = gameData.getAi();
    const player = gameData.getPlayer();
    if (!ai || !player) {
      throw new Error("Missing player or AI character data for letter prompt");
    }

    const settings = settingsRepository.getLetterPromptSettings();
    const messages: ILLMMessage[] = [];
    const context = {
      character: ai,
      player,
      ai,
      gameData,
      letter,
    };

    for (const block of settings.blocks || []) {
      if (!block.enabled) continue;
      this.applyBlock(block, messages, context, settings);
    }

    if (settings.suffix?.enabled && settings.suffix.template) {
      const suffixContent = this.templateEngine.renderTemplateString(settings.suffix.template, context);
      messages.push({ role: "system", content: suffixContent });
    }
    console.log(messages)
    return messages;
  }

  buildPreview(gameData: GameData, letter: LetterData): string {
    const messages = this.buildMessages(gameData, letter);
    return messages.map((m: any) => `${m.role?.toUpperCase() || "SYSTEM"}: ${m.content}`).join("\n\n");
  }

  private applyBlock(block: PromptBlock, messages: any[], context: any, settings: PromptSettings): void {
    const { character, gameData } = context;
    switch (block.type) {
      case "main": {
        const template = settings.mainTemplate || promptConfigManager.getDefaultLetterMainTemplateContent();
        const content = this.templateEngine.renderTemplateString(template, context);
        if (content?.trim()) {
          const role = (block.role || "system") as ILLMMessage["role"];
          messages.push({ role, content });
        }
        break;
      }
      case "description": {
        if (!block.scriptPath) break;
        try {
          const descScriptPath = promptConfigManager.resolvePath(block.scriptPath);
          const description = this.scriptLoader.executeDescription(descScriptPath, gameData, character.id);
          if (description) {
            messages.push({ role: "system", content: description });
          }
        } catch (error) {
          console.error("Failed to render letter description script:", error);
        }
        break;
      }
      case "past_summaries": {
        const summaries = this.buildPastSummariesContext(character, gameData);
        if (summaries) {
          const content = block.template
            ? this.templateEngine.renderTemplateString(block.template, { ...context, pastSummaries: summaries })
            : summaries;
          const role = (block.role || "system") as ILLMMessage["role"];
          messages.push({ role, content });
        }
        break;
      }
      case "memories": {
        const memoriesBlock = this.buildAllMemoriesBlock(context.player as Character, character, block.template, context);
        if (memoriesBlock) {
          const role = (block.role || "system") as ILLMMessage["role"];
          messages.push({ role, content: memoriesBlock });
        }
        break;
      }
      case "instruction": {
        const tpl = block.template || `You received a letter from {{player.fullName}}:\n"{{letter.content}}"\nReply as {{character.fullName}}.`;
        const content = this.templateEngine.renderTemplateString(tpl, context);
        const role = (block.role || "user") as ILLMMessage["role"];
        messages.push({ role, content });
        break;
      }
      case "custom": {
        if (!block.template) break;
        const content = this.templateEngine.renderTemplateString(block.template, context);
        const role = (block.role || "system") as ILLMMessage["role"];
        messages.push({ role, content });
        break;
      }
      default:
        break;
    }
  }

  private buildPastSummariesContext(char: Character, gameData: GameData): string | null {
    if (!char.conversationSummaries || char.conversationSummaries.length === 0) {
      return null;
    }
    const lines = char.conversationSummaries.map((s) => `${s.date}: ${s.content}`);
    return `Past conversations between ${char.shortName} and ${gameData.playerName}:\n${lines.join("\n")}`;
  }

  private buildAllMemoriesBlock(player: Character, ai: Character, template?: string, context: any = {}): string | null {
    const memories = [
      ...(player.memories || []).map((m) => ({ ...m, character: player.shortName })),
      ...(ai.memories || []).map((m) => ({ ...m, character: ai.shortName })),
    ];
    if (memories.length === 0) return null;
    const tpl =
      template ||
      `All memories for the involved characters:\n{{#each memories}}- {{this.character}} | {{this.creationDate}} ({{this.creationDateTotalDays}}): {{this.desc}} [relevance: {{this.relevanceWeight}}]\n{{/each}}`;
    return this.templateEngine.renderTemplateString(tpl, { ...context, memories });
  }
}

export const letterPromptBuilder = new LetterPromptBuilder();
