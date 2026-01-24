import fs from "fs";
import path from "path";
import { llmManager } from "../LLMManager";
import { settingsRepository } from "../SettingsRepository";
import { parseLog } from "../gameData/parseLog";
import { letterPromptBuilder } from "./LetterPromptBuilder";
import { LetterData } from "./types";
import { GameData } from "../gameData/GameData";
import type { ILLMMessage } from "../llmProviders/types";

export class LetterManager {
  async processLatestLetter(): Promise<string | null> {
    const context = await this.loadLatestGameDataWithLetter();
    if (!context) return null;
    const { gameData, letter } = context;

    const messages: ILLMMessage[] = letterPromptBuilder.buildMessages(gameData, letter);

    const result = await llmManager.sendChatRequest(messages as unknown as any[], undefined, true);
    const reply = await this.extractReply(result);
    if (!reply) {
      console.warn("Letter reply generation returned empty content.");
      return null;
    }

    await this.generateSummary(gameData, letter, reply);
    await this.writeLetterEffect(reply, letter);

    return reply;
  }

  async buildPromptPreview(): Promise<string | null> {
    const context = await this.loadLatestGameDataWithLetter();
    if (!context) return null;
    const { gameData, letter } = context;
    return letterPromptBuilder.buildPreview(gameData, letter);
  }

  private async loadLatestGameDataWithLetter(): Promise<{ gameData: GameData; letter: LetterData } | null> {
    const debugLogPath = settingsRepository.getCK3DebugLogPath();
    if (!debugLogPath) {
      console.warn("CK3 debug log path is not configured; cannot process letter.");
      return null;
    }

    const gameData = await parseLog(debugLogPath);
    gameData.loadCharactersSummaries();

    const letter = gameData.letterData;
    if (!letter) {
      console.warn("No letter data found in parsed game data.");
      return null;
    }

    return { gameData, letter };
  }

  private async extractReply(result: any): Promise<string | null> {
    if (result && typeof result === "object" && "content" in result) {
      const content = (result as any).content;
      return typeof content === "string" ? content.trim() : null;
    }

    // If provider still returned a stream, collect it defensively
    if (result && typeof result[Symbol.asyncIterator] === "function") {
      let text = "";
      for await (const chunk of result as AsyncGenerator<any>) {
        if (chunk?.delta?.content) {
          text += chunk.delta.content;
        }
      }
      return text.trim() || null;
    }

    return null;
  }

  private async generateSummary(gameData: GameData, letter: LetterData, reply: string): Promise<void> {
    const ai = gameData.getAi();
    if (!ai) return;

    const summaryPrompt: ILLMMessage[] = [
      {
        role: "system",
        content: "Summarize this one-on-one letter exchange succinctly. Focus on the key topics and tone.",
      },
      {
        role: "user",
        content: `Player letter to ${ai.fullName}:\n"${letter.content}"\n\nReply from ${ai.fullName}:\n"${reply}"`,
      },
    ];

    try {
      const summaryResult = await llmManager.sendSummaryRequest(summaryPrompt);
      if (summaryResult && typeof summaryResult === "object" && "content" in summaryResult) {
        const summary = (summaryResult as any).content as string;
        if (summary?.trim()) {
          gameData.saveCharacterSummary(ai.id, {
            date: gameData.date,
            totalDays: gameData.totalDays,
            content: summary.trim(),
          });
        }
      }
    } catch (error) {
      console.error("Failed to generate letter summary:", error);
    }
  }

  private async writeLetterEffect(reply: string, letter: LetterData): Promise<void> {
    const ck3Folder = settingsRepository.getCK3UserFolderPath();
    if (!ck3Folder) {
      console.warn("CK3 user folder is not configured; skipping writing letter effect.");
      return;
    }

    const runFolder = path.join(ck3Folder, "run");
    fs.mkdirSync(runFolder, { recursive: true });
    const letterFilePath = path.join(runFolder, `${letter.letterId}.txt`);

    const escapedReply = reply.replace(/"/g, '\\"');
    const gameCommand = `send_interface_message = {
    type = votc_message_popup
    title = votc_huixin_title${letter.letterId.replace(/letter_/, "")}
    desc = "${escapedReply}"
    #left_icon = global_var:message_second_scope_${letter.letterId}
}
\tremove_global_variable ?= votc_${letter.letterId}
    create_artifact = {
\tname = votc_huixin_title${letter.letterId.replace(/letter_/, "")}
\tdescription = "${escapedReply}"
\ttype = journal
\tvisuals = scroll
\tcreator = global_var:message_second_scope_${letter.letterId}
\tmodifier = artifact_monthly_minor_prestige_1_modifier
\t}`;

    fs.writeFileSync(letterFilePath, gameCommand, "utf-8");

    // Update the localization file with the letter content
    await this.updateLocalizationFile(reply);
  }

  private async updateLocalizationFile(reply: string): Promise<void> {
    const votcModPath = settingsRepository.getModLocationPath();
    if (!votcModPath) {
      console.warn("VOTC mod path is not configured; skipping localization update.");
      return;
    }

    const localizationPath = path.join(votcModPath, "localization", "english", "talk_l_english.yml");
    
    try {
      // Read the existing file
      if (!fs.existsSync(localizationPath)) {
        console.warn("Localization file does not exist:", localizationPath);
        return;
      }
      
      let content = fs.readFileSync(localizationPath, "utf-8");
      
      // Replace the votc_message_tooltip line with the actual letter content
      // Keep \n characters for line breaks in the localization file
      const escapedReply = reply.replace(/\n/g, '\\n'); // Converts actual newline to literal "\n"
      const newTooltipLine = `letter_message:0 "${escapedReply}"`;
      
      // Use regex to find and replace the line
      const tooltipRegex = /^letter_message:0 .+$/m;
      if (tooltipRegex.test(content)) {
        content = content.replace(tooltipRegex, newTooltipLine);
        
        fs.writeFileSync(localizationPath, content, "utf-8");
        console.log("Updated letter_message in localization file with letter content");
      } else {
        console.warn("Could not find letter_message line in localization file");
      }
    } catch (error) {
      console.error("Failed to update localization file:", error);
    }
  }
  // @ts-ignore
  private _extractLetterNumber(letterId: string): string {
    const match = letterId.match(/letter_?(\\d+)/);
    if (match && match[1]) {
      return match[1];
    }
    const digits = letterId.replace(/\\D/g, "");
    return digits || "latest";
  }
}

export const letterManager = new LetterManager();
