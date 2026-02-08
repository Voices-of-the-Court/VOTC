import type { GameData } from "../gameData/GameData";

export interface LetterData {
  content: string;
  letterId: string;
  totalDays: number;
  delay: number;
}

export enum LetterResponseStatus {
  GENERATING = 'generating',
  GENERATED = 'generated',
  GENERATION_FAILED = 'generation_failed',
  PENDING_DELIVERY = 'pending_delivery',
  SENT = 'sent',
  SEND_FAILED = 'send_failed'
}

export enum LetterSummaryStatus {
  NOT_STARTED = 'not_started',
  GENERATING = 'generating',
  GENERATED = 'generated',
  GENERATION_FAILED = 'generation_failed',
  SAVED = 'saved',
  SAVE_FAILED = 'save_failed'
}

export interface LetterStatusInfo {
  letterId: string;
  letterContent: string;
  responseContent: string | null;
  responseStatus: LetterResponseStatus;
  responseError: string | null;
  summaryStatus: LetterSummaryStatus;
  summaryContent: string | null;
  summaryError: string | null;
  createdAt: number; // timestamp
  expectedDeliveryDay: number;
  currentDay: number;
  daysUntilDelivery: number;
  isLate: boolean;
  characterName?: string;
}

export interface LetterStatusSnapshot {
  letters: LetterStatusInfo[];
  currentTotalDays: number;
  timestamp: number;
}

export interface StoredLetter {
  letter: LetterData;
  reply: string;
  expectedDeliveryDay: number;
}

export interface LetterPromptContext {
  gameData: GameData;
  letter: LetterData;
}
