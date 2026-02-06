import fs from 'fs';
import path from 'path';
import { ConversationSummary } from '../gameData/Character';
import { VOTC_SUMMARIES_DIR } from './paths';

export interface SummaryMetadata {
  playerId: string;
  playerName?: string; // If we can derive it
  characterId: string;
  characterName: string; // From file or fallback to ID
  summaries: ConversationSummary[];
  filePath: string;
}

/**
 * Manages conversation summaries across all players and characters
 */
export class SummariesManager {
  /**
   * List all summaries across all players with metadata
   */
  static async listAllSummaries(): Promise<SummaryMetadata[]> {
    const results: SummaryMetadata[] = [];
    
    try {
      // Ensure summaries directory exists
      if (!fs.existsSync(VOTC_SUMMARIES_DIR)) {
        return results;
      }
      
      // Get all player directories
      const playerDirs = fs.readdirSync(VOTC_SUMMARIES_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      for (const playerId of playerDirs) {
        const playerPath = path.join(VOTC_SUMMARIES_DIR, playerId);
        
        // Try to get player name from the player character's summary file (file with same name as folder)
        let playerName: string | undefined;
        const playerCharacterFile = path.join(playerPath, `${playerId}.json`);
        if (fs.existsSync(playerCharacterFile)) {
          try {
            const playerFileContent = fs.readFileSync(playerCharacterFile, 'utf8');
            const playerSummaries = JSON.parse(playerFileContent) as ConversationSummary[];
            if (Array.isArray(playerSummaries) && playerSummaries.length > 0 && playerSummaries[0].characterName) {
              playerName = playerSummaries[0].characterName;
            }
          } catch (error) {
            console.warn(`Failed to read player name from ${playerCharacterFile}:`, error);
          }
        }
        
        try {
          // Get all character summary files for this player
          const characterFiles = fs.readdirSync(playerPath)
            .filter(file => file.endsWith('.json'));
          
          for (const characterFile of characterFiles) {
            const characterId = path.basename(characterFile, '.json');
            const filePath = path.join(playerPath, characterFile);
            
            try {
              // Read and parse summaries
              const fileContent = fs.readFileSync(filePath, 'utf8');
              const summaries = JSON.parse(fileContent) as ConversationSummary[];
              
              if (!Array.isArray(summaries)) {
                console.warn(`Invalid summaries format in ${filePath}`);
                continue;
              }
              
              // Skip files with empty summaries array
              if (summaries.length === 0) {
                continue;
              }
              
              // Get character name from first summary or fallback to ID
              let characterName = `Character ID: ${characterId}`;
              if (summaries[0].characterName) {
                characterName = summaries[0].characterName;
              }
              
              results.push({
                playerId,
                playerName,
                characterId,
                characterName,
                summaries,
                filePath
              });
              
            } catch (error) {
              console.error(`Failed to read summaries from ${filePath}:`, error);
            }
          }
        } catch (error) {
          console.error(`Failed to process player directory ${playerId}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to list summaries:', error);
    }
    
    return results;
  }
  
  /**
   * Get summaries for a specific character
   */
  static async getSummariesForCharacter(playerId: string, characterId: string): Promise<ConversationSummary[]> {
    const filePath = path.join(VOTC_SUMMARIES_DIR, playerId, `${characterId}.json`);
    
    try {
      if (!fs.existsSync(filePath)) {
        return [];
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const summaries = JSON.parse(fileContent) as ConversationSummary[];
      
      return Array.isArray(summaries) ? summaries : [];
    } catch (error) {
      console.error(`Failed to get summaries for character ${characterId} from player ${playerId}:`, error);
      return [];
    }
  }
  
  /**
   * Update a specific summary's content
   */
  static async updateSummary(
    playerId: string, 
    characterId: string, 
    summaryIndex: number, 
    newContent: string
  ): Promise<{ success: boolean; error?: string }> {
    const filePath = path.join(VOTC_SUMMARIES_DIR, playerId, `${characterId}.json`);
    
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Summary file not found' };
      }
      
      // Read existing summaries
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const summaries = JSON.parse(fileContent) as ConversationSummary[];
      
      if (!Array.isArray(summaries) || summaryIndex < 0 || summaryIndex >= summaries.length) {
        return { success: false, error: 'Invalid summary index' };
      }
      
      // Update the summary content
      summaries[summaryIndex].content = newContent;
      
      // Ensure directory exists
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Write back to file
      fs.writeFileSync(filePath, JSON.stringify(summaries, null, '\t'));
      
      return { success: true };
    } catch (error) {
      console.error(`Failed to update summary for character ${characterId} from player ${playerId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  /**
   * Delete a specific summary
   */
  static async deleteSummary(
    playerId: string, 
    characterId: string, 
    summaryIndex: number
  ): Promise<{ success: boolean; error?: string }> {
    const filePath = path.join(VOTC_SUMMARIES_DIR, playerId, `${characterId}.json`);
    
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Summary file not found' };
      }
      
      // Read existing summaries
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const summaries = JSON.parse(fileContent) as ConversationSummary[];
      
      if (!Array.isArray(summaries) || summaryIndex < 0 || summaryIndex >= summaries.length) {
        return { success: false, error: 'Invalid summary index' };
      }
      
      // Remove the summary
      summaries.splice(summaryIndex, 1);
      
      if (summaries.length === 0) {
        // If no summaries left, delete the file
        fs.unlinkSync(filePath);
      } else {
        // Write remaining summaries back to file
        fs.writeFileSync(filePath, JSON.stringify(summaries, null, '\t'));
      }
      
      return { success: true };
    } catch (error) {
      console.error(`Failed to delete summary for character ${characterId} from player ${playerId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  /**
   * Delete all summaries for a character
   */
  static async deleteCharacterSummaries(
    playerId: string, 
    characterId: string
  ): Promise<{ success: boolean; error?: string }> {
    const filePath = path.join(VOTC_SUMMARIES_DIR, playerId, `${characterId}.json`);
    
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      return { success: true };
    } catch (error) {
      console.error(`Failed to delete summaries for character ${characterId} from player ${playerId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  /**
   * Get character name from summary file (with fallback to ID)
   */
  static async getCharacterNameFromFile(playerId: string, characterId: string): Promise<string> {
    const filePath = path.join(VOTC_SUMMARIES_DIR, playerId, `${characterId}.json`);
    
    try {
      if (!fs.existsSync(filePath)) {
        return `Character ID: ${characterId}`;
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const summaries = JSON.parse(fileContent) as ConversationSummary[];
      
      if (Array.isArray(summaries) && summaries.length > 0 && summaries[0].characterName) {
        return summaries[0].characterName;
      }
      
      return `Character ID: ${characterId}`;
    } catch (error) {
      console.error(`Failed to get character name from file ${filePath}:`, error);
      return `Character ID: ${characterId}`;
    }
  }
}