import fs from "fs";
import path from "path";
import TailFile from '@logdna/tail-file';
import readline from 'node:readline';
import { llmManager } from "../LLMManager";
import { settingsRepository } from "../SettingsRepository";
import { parseLog, cleanLogFile } from "../gameData/parseLog";
import { letterPromptBuilder } from "./LetterPromptBuilder";
import { LetterData, StoredLetter, LetterStatusInfo, LetterResponseStatus, LetterSummaryStatus, LetterStatusSnapshot } from "./types";
import { GameData } from "../gameData/GameData";
import type { ILLMMessage } from "../llmProviders/types";
import { TokenCounter } from "../utils/TokenCounter";

export class LetterManager {
  private currentTotalDays: number = 0;
  private storedLetters: Map<string, StoredLetter> = new Map();
  private letterStatuses: Map<string, LetterStatusInfo> = new Map();
  private tailFile: TailFile | null = null;
  private readline: readline.Interface | null = null;
  private lastCleanTime: number = 0;
  private readonly CLEAN_INTERVAL_MS: number = 300000; // 5 minutes

  constructor() {
    // Only start tailing if CK3 path is already configured
    const ck3UserPath = settingsRepository.getCK3UserFolderPath();
    if (ck3UserPath) {
      this.startLogTailing();
    } else {
      console.log("LetterManager: CK3 user path not configured yet, will start tailing when path is set");
    }
  }

  /**
   * Start tailing the debug.log file to track VOTC:DATE updates
   */
  private async startLogTailing(): Promise<void> {
    const ck3UserPath = settingsRepository.getCK3UserFolderPath();
    console.log(`LetterManager: CK3 user path from settings: ${ck3UserPath}`);
    
    const debugLogPath = settingsRepository.getCK3DebugLogPath();
    console.log(`LetterManager: Resolved debug log path: ${debugLogPath}`);
    
    if (!debugLogPath) {
      console.warn("LetterManager: CK3 debug log path is not configured; cannot start log tailing.");
      return;
    }

    if (!fs.existsSync(debugLogPath)) {
      console.warn(`LetterManager: Debug log file does not exist: ${debugLogPath}`);
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
    const ck3UserPath = settingsRepository.getCK3UserFolderPath();

    if (ck3UserPath) {
        const runFolder = path.join(ck3UserPath, "run");
        const letterFilePath = path.join(runFolder, "letters.txt");
        console.log(`LetterManager: Resolved letters.txt path: ${letterFilePath}`);
        fs.writeFileSync(letterFilePath, "debug_log = \"[Localize('talk_event.9999.desc')]\"", "utf-8");
        console.log("Created letters.txt file");
    }

    const context = await this.loadLatestGameDataWithLetter();
    if (!context) return null;
    const { gameData, letter } = context;

    // Initialize status tracking
    const characterName = gameData.getAi()?.fullName || 'Unknown';
    this.createLetterStatus(letter, characterName);

    // Generate the reply immediately
    this.updateLetterStatus(letter.letterId, { responseStatus: LetterResponseStatus.GENERATING });
    
    const messages: ILLMMessage[] = letterPromptBuilder.buildMessages(gameData, letter);
    let reply: string | null = null;
    let responseError: string | null = null;

    try {
      const result = await llmManager.sendChatRequest(messages as unknown as any[], undefined, true);
      reply = await this.extractReply(result);
      
      if (!reply) {
        throw new Error("Letter reply generation returned empty content.");
      }

      this.updateLetterStatus(letter.letterId, {
        responseStatus: LetterResponseStatus.GENERATED,
        responseContent: reply,
        responseError: null
      });
    } catch (error) {
      responseError = error instanceof Error ? error.message : 'Unknown error';
      console.error("Letter reply generation failed:", error);
      this.updateLetterStatus(letter.letterId, {
        responseStatus: LetterResponseStatus.GENERATION_FAILED,
        responseError
      });
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
    
    // Update status to pending delivery
    this.updateLetterStatus(letter.letterId, {
      responseStatus: LetterResponseStatus.PENDING_DELIVERY,
      expectedDeliveryDay,
      daysUntilDelivery: expectedDeliveryDay - this.currentTotalDays,
      isLate: this.currentTotalDays > expectedDeliveryDay
    });

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

    this.updateLetterStatus(letter.letterId, {
      summaryStatus: LetterSummaryStatus.GENERATING
    });
    
    const summarySettings = settingsRepository.getSummaryPromptSettings();
    const summaryPrompt: ILLMMessage[] = [
      {
        role: "system",
        content: summarySettings.letterSummaryPrompt,
      },
      {
        role: "user",
        content: `${gameData.playerName} letter to ${ai.fullName}:\n"${letter.content}"\n\nReply from ${ai.fullName}:\n"${reply}"`,
      },
    ];

    try {
      console.log(`[TOKEN_COUNT] Letter summary prompt tokens: ${TokenCounter.estimateMessageTokens(summaryPrompt[0])}`);
      console.log(`[TOKEN_COUNT] Letter summary letters letters content tokens: ${TokenCounter.estimateMessageTokens(summaryPrompt[1])}`);
      const summaryResult = await llmManager.sendSummaryRequest(summaryPrompt);
      if (summaryResult && typeof summaryResult === "object" && "content" in summaryResult) {
        const summary = (summaryResult as any).content as string;
        if (summary?.trim()) {
          this.updateLetterStatus(letter.letterId, {
            summaryStatus: LetterSummaryStatus.GENERATED,
            summaryContent: summary.trim(),
            summaryError: null
          });

          // Save to file
          gameData.saveCharacterSummary(ai.id, {
            date: gameData.date,
            totalDays: gameData.totalDays,
            content: summary.trim(),
          });

          this.updateLetterStatus(letter.letterId, {
            summaryStatus: LetterSummaryStatus.SAVED
          });
        }
      }
    } catch (error) {
      const summaryError = error instanceof Error ? error.message : 'Unknown error';
      console.error("Failed to generate letter summary:", error);
      this.updateLetterStatus(letter.letterId, {
        summaryStatus: LetterSummaryStatus.GENERATION_FAILED,
        summaryError
      });
    }
  }

  private async writeLetterEffect(reply: string, letter: LetterData): Promise<void> {
    const ck3Folder = settingsRepository.getCK3UserFolderPath();
    console.log(`LetterManager.writeLetterEffect: CK3 user path: ${ck3Folder}`);
    
    if (!ck3Folder) {
      console.warn("LetterManager.writeLetterEffect: CK3 user folder is not configured; skipping writing letter effect.");
      this.updateLetterStatus(letter.letterId, {
        responseStatus: LetterResponseStatus.SEND_FAILED,
        responseError: "CK3 user folder not configured"
      });
      return;
    }

    // Update the localization file with the letter content
    // this.updateLocalizationFile(reply);

    const runFolder = path.join(ck3Folder, "run");
    console.log(`LetterManager.writeLetterEffect: Run folder path: ${runFolder}`);
    
    try {
      fs.mkdirSync(runFolder, { recursive: true });
      console.log(`LetterManager.writeLetterEffect: Run folder created/verified`);
    } catch (error) {
      const errorMessage = `Failed to create run folder: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`LetterManager.writeLetterEffect: ${errorMessage}`);
      this.updateLetterStatus(letter.letterId, {
        responseStatus: LetterResponseStatus.SEND_FAILED,
        responseError: errorMessage
      });
      return;
    }
    
    const letterFilePath = path.join(runFolder, `letters.txt`);
    console.log(`LetterManager.writeLetterEffect: Letter file path: ${letterFilePath}`);

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
\twealth = scope:wealth
\tsave_scope_as = votc_latest_letter
}
scope:votc_latest_letter = {
set_variable = { name = votc_letter_artifact value = yes}
}
set_global_variable = {
\tname = votc_latest_letter
\tvalue = scope:votc_latest_letter
}
trigger_event = message_event.362`;

    try {
      fs.writeFileSync(letterFilePath, gameCommand, "utf-8");
      this.updateLetterStatus(letter.letterId, {
        responseStatus: LetterResponseStatus.SENT,
        responseError: null
      });
    } catch (error) {
      const errorMessage = `Failed to write letter effect: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`LetterManager.writeLetterEffect: ${errorMessage}`);
      this.updateLetterStatus(letter.letterId, {
        responseStatus: LetterResponseStatus.SEND_FAILED,
        responseError: errorMessage
      });
    }
  }


  /**
   * Clear the letters.txt file
   */
  public clearLettersFile(): void {
    const ck3Folder = settingsRepository.getCK3UserFolderPath();
    console.log(`LetterManager.clearLettersFile: CK3 user path: ${ck3Folder}`);
    
    if (!ck3Folder) {
      console.warn("LetterManager.clearLettersFile: CK3 user folder is not configured; cannot clear letters file.");
      return;
    }

    const runFolder = path.join(ck3Folder, "run");
    const letterFilePath = path.join(runFolder, "letters.txt");
    console.log(`LetterManager.clearLettersFile: Letter file path: ${letterFilePath}`);

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
   * Restart log tailing (useful when CK3 path is updated)
   */
  public async restartLogTailing(): Promise<void> {
    console.log("Restarting log tailing...");
    await this.stopLogTailing();
    this.currentTotalDays = 0; // Reset current date
    await this.startLogTailing();
  }

  /**
   * Get current tracked date
   */
  public getCurrentTotalDays(): number {
    return this.currentTotalDays;
  }

  /**
   * Create initial letter status entry
   */
  private createLetterStatus(letter: LetterData, characterName: string): void {
    const statusInfo: LetterStatusInfo = {
      letterId: letter.letterId,
      letterContent: letter.content,
      responseContent: null,
      responseStatus: LetterResponseStatus.GENERATING,
      responseError: null,
      summaryStatus: LetterSummaryStatus.NOT_STARTED,
      summaryContent: null,
      summaryError: null,
      createdAt: Date.now(),
      expectedDeliveryDay: letter.totalDays + letter.delay,
      currentDay: this.currentTotalDays,
      daysUntilDelivery: (letter.totalDays + letter.delay) - this.currentTotalDays,
      isLate: this.currentTotalDays > (letter.totalDays + letter.delay),
      characterName
    };

    this.letterStatuses.set(letter.letterId, statusInfo);
  }

  /**
   * Update letter status information
   */
  private updateLetterStatus(letterId: string, updates: Partial<LetterStatusInfo>): void {
    const existing = this.letterStatuses.get(letterId);
    if (existing) {
      const updated = { ...existing, ...updates };
      this.letterStatuses.set(letterId, updated);
    }
  }

  /**
   * Get letter status by ID
   */
  public getLetterStatus(letterId: string): LetterStatusInfo | null {
    return this.letterStatuses.get(letterId) || null;
  }

  /**
   * Get all letter statuses
   */
  public getAllLetterStatuses(): LetterStatusSnapshot {
    // Update current day and calculate delivery times for all letters
    for (const status of this.letterStatuses.values()) {
      status.currentDay = this.currentTotalDays;
      status.daysUntilDelivery = status.expectedDeliveryDay - this.currentTotalDays;
      status.isLate = this.currentTotalDays > status.expectedDeliveryDay;
    }

    return {
      letters: Array.from(this.letterStatuses.values()),
      currentTotalDays: this.currentTotalDays,
      timestamp: Date.now()
    };
  }

  /**
   * Clear old completed statuses to manage memory
   */
  public clearOldStatuses(daysThreshold: number = 30): void {
    const cutoffTime = Date.now() - (daysThreshold * 24 * 60 * 60 * 1000);
    const statusesToRemove: string[] = [];

    for (const [letterId, status] of this.letterStatuses.entries()) {
      // Only remove old completed letters that were successfully sent
      if (
        status.responseStatus === LetterResponseStatus.SENT &&
        status.summaryStatus === LetterSummaryStatus.SAVED &&
        status.createdAt < cutoffTime
      ) {
        statusesToRemove.push(letterId);
      }
    }

    for (const letterId of statusesToRemove) {
      this.letterStatuses.delete(letterId);
      console.log(`Cleared old letter status: ${letterId}`);
    }

    if (statusesToRemove.length > 0) {
      console.log(`Cleared ${statusesToRemove.length} old letter statuses`);
    }
  }
}

export const letterManager = new LetterManager();
