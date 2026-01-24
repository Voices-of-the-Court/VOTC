import type { GameData } from "../gameData/GameData";

export interface LetterData {
  content: string;
  letterId: string;
}

export interface LetterPromptContext {
  gameData: GameData;
  letter: LetterData;
}
