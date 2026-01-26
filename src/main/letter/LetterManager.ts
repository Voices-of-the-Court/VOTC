import fs from "fs";
import path from "path";
import TailFile from '@logdna/tail-file';
import readline from 'node:readline';
import { llmManager } from "../LLMManager";
import { settingsRepository } from "../SettingsRepository";
import { parseLog, cleanLogFile } from "../gameData/parseLog";
import { letterPromptBuilder } from "./LetterPromptBuilder";
import { LetterData, StoredLetter } from "./types";
import { GameData } from "../gameData/GameData";
import type { ILLMMessage } from "../llmProviders/types";

export class LetterManager {
  private currentTotalDays: number = 0;
  private storedLetters: Map<string, StoredLetter> = new Map();
  private tailFile: TailFile | null = null;
  private readline: readline.Interface | null = null;
  private lastCleanTime: number = 0;
  private readonly CLEAN_INTERVAL_MS: number = 300000; // 5 minutes

  constructor() {
    this.startLogTailing();
  }

  /**
   * Start tailing the debug.log file to track VOTC:DATE updates
   */
  private async startLogTailing(): Promise<void> {
    const debugLogPath = settingsRepository.getCK3DebugLogPath();
    if (!debugLogPath) {
      console.warn("CK3 debug log path is not configured; cannot start log tailing.");
      return;
    }

    if (!fs.existsSync(debugLogPath)) {
      console.warn(`Debug log file does not exist: ${debugLogPath}`);
      return;
    }

    try {
      this.tailFile = new TailFile(debugLogPath, { encoding: 'utf8' })
        .on('tail_error', (err) => {
          console.error('Tail error:', err);
        });

      await this.tailFile.start();
      console.log(`Started tailing debug log: ${debugLogPath}`);

      // Set up line-by-line parsing
      this.readline = readline.createInterface({ input: this.tailFile });
      this.readline.on('line', (line) => {
        this.processLogLine(line, debugLogPath);
      });
    } catch (error) {
      console.error('Failed to start log tailing:', error);
    }
  }

  /**
   * Process a single log line looking for VOTC:DATE
   */
  private processLogLine(line: string, debugLogPath: string): void {
    // Check for VOTC:DATE updates
    const dateRegex = /VOTC:DATE\/;\/(\d+)/;
    const match = line.match(dateRegex);
    
    if (match) {
      const newTotalDays = Number(match[1]);
      this.updateCurrentDate(newTotalDays);
    }
    
    // Throttle log cleaning to once every 5 minutes
    const now = Date.now();
    if (now - this.lastCleanTime >= this.CLEAN_INTERVAL_MS) {
      this.lastCleanTime = now;
      cleanLogFile(debugLogPath);
    }
  }

  /**
   * Update current date and handle time travel detection
   */
  private updateCurrentDate(newTotalDays: number): void {
    const oldTotalDays = this.currentTotalDays;
    

    // Detect time travel backwards
    if (oldTotalDays > 0 && newTotalDays < oldTotalDays) {
      console.log(`Time travel detected (backwards). Removing letters sent after new date. | Old date: ${oldTotalDays} | New date: ${newTotalDays}`);
      this.removeLettersAfterDate(newTotalDays);
    }
    // Detect large time jump forward (more than 40 days)
    else if (oldTotalDays > 0 && newTotalDays - oldTotalDays > 40) {
      console.log("Large time jump detected (>40 days). Removing letters sent after old date.");
      this.removeLettersAfterDate(oldTotalDays);
    }

    this.currentTotalDays = newTotalDays;

    // Check if any stored letters should now be delivered
    this.checkAndDeliverLetters();
  }

  /**
   * Remove letters that were generated after a certain date (time travel cleanup)
   */
  private removeLettersAfterDate(cutoffDate: number): void {
    const lettersToRemove: string[] = [];
    
    for (const [letterId, storedLetter] of this.storedLetters.entries()) {
      // Remove letters that were sent after the cutoff date
      if (storedLetter.letter.totalDays > cutoffDate) {
        lettersToRemove.push(letterId);
      }
    }

    for (const letterId of lettersToRemove) {
      console.log(`Removing letter ${letterId} due to time travel`);
      this.storedLetters.delete(letterId);
    }
  }

  /**
   * Check stored letters and deliver any that are ready
   */
  private checkAndDeliverLetters(): void {
    for (const [letterId, storedLetter] of this.storedLetters.entries()) {
      if (this.currentTotalDays >= storedLetter.expectedDeliveryDay) {
        console.log(`Delivering letter ${letterId} (current: ${this.currentTotalDays}, expected: ${storedLetter.expectedDeliveryDay})`);
        this.deliverLetter(storedLetter);
        this.storedLetters.delete(letterId);
      }
    }
  }

  /**
   * Deliver a letter by writing the effect file and updating localization
   */
  private async deliverLetter(storedLetter: StoredLetter): Promise<void> {
    await this.writeLetterEffect(storedLetter.reply, storedLetter.letter);
  }

  /**
   * Process a new letter: generate response immediately but store it for delayed delivery
   */
  async processLatestLetter(): Promise<string | null> {
    const context = await this.loadLatestGameDataWithLetter();
    if (!context) return null;
    const { gameData, letter } = context;

    // Generate the reply immediately
    const messages: ILLMMessage[] = letterPromptBuilder.buildMessages(gameData, letter);
    const result = await llmManager.sendChatRequest(messages as unknown as any[], undefined, true);
    const reply = await this.extractReply(result);
    
    if (!reply) {
      console.warn("Letter reply generation returned empty content.");
      return null;
    }

    // Generate summary
    await this.generateSummary(gameData, letter, reply);

    // Store the letter for delayed delivery
    const expectedDeliveryDay = letter.totalDays + letter.delay;
    const storedLetter: StoredLetter = {
      letter,
      reply,
      expectedDeliveryDay
    };

    this.storedLetters.set(letter.letterId, storedLetter);
    console.log(`Letter ${letter.letterId} generated and stored. Will deliver on day ${expectedDeliveryDay} (current: ${this.currentTotalDays})`);

    // Check if it should be delivered immediately
    if (this.currentTotalDays >= expectedDeliveryDay) {
      console.log(`Letter ${letter.letterId} is ready for immediate delivery`);
      await this.deliverLetter(storedLetter);
      this.storedLetters.delete(letter.letterId);
    }

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

    // Update the localization file with the letter content
    // this.updateLocalizationFile(reply);

    const runFolder = path.join(ck3Folder, "run");
    fs.mkdirSync(runFolder, { recursive: true });
    const letterFilePath = path.join(runFolder, `letters.txt`);

    const escapedReply = reply.replace(/"/g, '\\"');
    const gameCommand = `debug_log = "[Localize('talk_event.9999.desc')]"
remove_global_variable ?= votc_${letter.letterId}
create_artifact = {
\tname = votc_huixin_title${letter.letterId.replace(/letter_/, "")}
\tdescription = "${escapedReply}"
\ttype = journal
\tvisuals = scroll
\tcreator = global_var:message_second_scope_${letter.letterId}
\tmodifier = artifact_monthly_minor_prestige_1_modifier
\tsave_scope_as = votc_latest_letter
}
set_global_variable = {
\tname = votc_latest_letter
\tvalue = scope:votc_latest_letter
}
trigger_event = message_event.362`;

    fs.writeFileSync(letterFilePath, gameCommand, "utf-8");
  }


  /**
   * Clear the letters.txt file
   */
  public clearLettersFile(): void {
    const ck3Folder = settingsRepository.getCK3UserFolderPath();
    if (!ck3Folder) {
      console.warn("CK3 user folder is not configured; cannot clear letters file.");
      return;
    }

    const runFolder = path.join(ck3Folder, "run");
    const letterFilePath = path.join(runFolder, "letters.txt");

    if (fs.existsSync(letterFilePath)) {
      fs.writeFileSync(letterFilePath, "debug_log = \"[Localize('talk_event.9999.desc')]\"", "utf-8");
      console.log("Cleared letters.txt file");
    } else {
      console.log("letters.txt file does not exist, nothing to clear");
    }
  }

  /**
   * Stop log tailing (cleanup)
   */
  public async stopLogTailing(): Promise<void> {
    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }
    
    if (this.tailFile) {
      await this.tailFile.quit();
      this.tailFile = null;
      console.log("Stopped log tailing");
    }
  }

  /**
   * Get current tracked date
   */
  public getCurrentTotalDays(): number {
    return this.currentTotalDays;
  }
}

export const letterManager = new LetterManager();
