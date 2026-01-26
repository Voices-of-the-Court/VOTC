import type { GameData } from "../gameData/GameData";

export interface LetterData {
  content: string;
  letterId: string;
  totalDays: number;
  delay: number;
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
