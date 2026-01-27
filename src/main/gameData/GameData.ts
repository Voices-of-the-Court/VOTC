import path from "path";
import fs from "fs";
import { Character } from "./Character";
import { VOTC_SUMMARIES_DIR } from "../utils/paths";
import type { LetterData } from "../letter/types";

export interface SummaryImportResult {
  sourcePlayerId: string;
  characterId: number;
  characterName: string;
  summaryCount: number;
  sourceFilePath: string;
  targetFilePath: string;
}

// Simple replacement for removeTooltip since parseLog.ts doesn't exist
function removeTooltip(text: string): string {
    return text.replace(/<.*?>.*?<\/.*?>/gi, '').trim();
}

/**@typedef {import('./Character').Character} Character */

export type Trait = {
    category: string,
    name: string,
    desc: string
}

export type Memory = {
    type: string,
    creationDate: string,
    creationDateTotalDays: number,
    desc: string,
    /**@property {number} relevanceWeight - how relevant the memory to the current conversation. The higher, the more relevant. */
    relevanceWeight: number
}

export type OpinionModifier = {
    reason: string,
    value: number,
}

export type SecretTarget = {
    id: number,
    name: string
}

export type SecretKnower = {
    id: number,
    name: string,
    isSpent: boolean,
    canBeExposed: boolean
}

export type Secret = {
    name: string,
    desc: string,
    category: string,
    type: string,
    isCriminal: boolean,
    isShunned: boolean,
    target?: SecretTarget,
    knowers: SecretKnower[]
}

export type KnownSecret = {
    name: string,
    desc: string,
    category: string,
    type: string,
    ownerId: number,
    ownerName: string,
    isCriminal: boolean,
    isShunned: boolean,
    target?: SecretTarget,
    isSpent: boolean,
    canBeExposed: boolean,
    knowers: SecretKnower[]
}

export type Modifier = {
    id: string,
    name: string,
    description: string
}

export type Stress = {
    value: number,
    level: number,
    progress: number
}

export type Legitimacy = {
    value: number,
    level: number,
    type: string,
    avgPowerfulVassalExpectation: number,
    avgVassalExpectation: number,
    liegeExpectation: number
}

export type MAARegiment = {
    name: string,
    isPersonal: boolean,
    menAlive: number
}

export type Troops = {
    leviesVassals: number,
    leviesDomain: number[],
    leviesDomainSum: number,
    leviesTheocratic: number,
    maaRegiments: MAARegiment[],
    totalOwnedTroops: number
}

export type Law = {
    name: string
}

export type Income = {
    gold: number,
    balance: number,
    balanceBreakdown: string
}

export type Treasury = {
    amount: number,
    tooltip: string
}

export type Influence = {
    amount: number,
    tooltip: string
}

export type Herd = {
    amount: number,
    breakdown: string
}

export type Parent = {
    id: number,
    name: string,
    birthDateTotalDays: number,
    birthDate: string,
    deathDateTotalDays?: number,
    deathDate?: string,
    deathReason?: string
}

export type Child = {
    id: number,
    name: string,
    sheHe: string,
    birthDateTotalDays: number,
    birthDate: string,
    deathDateTotalDays?: number,
    deathDate?: string,
    deathReason?: string,
    otherParent?: {
        id: number,
        name: string
    },
    traits: Trait[],
    maritalStatus: 'unmarried' | 'concubine' | 'has_concubines' | 'has_spouses' | 'betrothed',
    concubineOf?: {
        id: number,
        name: string
    },
    concubines: Array<{
        id: number,
        name: string
    }>,
    spouses: Array<{
        id: number,
        name: string
    }>,
    betrothed?: {
        id: number,
        name: string
    }
}

/** 
 * @class
*/
export class GameData {
    date: string;
    totalDays: number;
    scene: string;
    location: string;
    locationController: string;

    playerID: number;
    playerName: string;
    aiID: number;
    aiName: string;

    characters: Map<number,Character>
    letterData: LetterData | null;

    constructor(data: string[]){
            this.playerID = Number(data[0]),
            this.playerName = removeTooltip(data[1]),
            this.aiID = Number(data[2]),
            this.aiName = removeTooltip(data[3]),
            this.date = data[4],
            this.scene = data[5].substring(11),
            this.location = data[6],
            this.locationController = data[7],
            this.totalDays = Number(data[8]),

            this.characters = new Map<number, Character>(),
            this.letterData = null
    }

    getPlayer(): Character{
        return this.characters.get(this.playerID)!;
    }

    /**
     * 
     * @return {Character} ai
     */
    getAi(): Character{
        return this.characters.get(this.aiID)!;
    }

    loadCharactersSummaries(){
        const summariesPath = path.join(VOTC_SUMMARIES_DIR, this.playerID.toString());
        for (const character of this.characters.values()) {
            character.loadSummaries(path.join(summariesPath, character.id.toString() + '.json'));
        }
    }

    saveCharacterSummary(characterId: number, summary: { date: string; totalDays: number; content: string }): void {
        const summariesPath = path.join(VOTC_SUMMARIES_DIR, this.playerID.toString());
        fs.mkdirSync(summariesPath, { recursive: true });
        const target = this.characters.get(characterId);
        if (!target) return;
        target.conversationSummaries.unshift(summary);
        target.saveSummaries(path.join(summariesPath, `${characterId}.json`));
    }

    saveCharactersSummaries(finalSummary: string){
        const summariesPath = path.join(VOTC_SUMMARIES_DIR, this.playerID.toString());
        fs.mkdirSync(summariesPath, { recursive: true });
        for (const character of this.characters.values()) {
            character.conversationSummaries.unshift(
                {
                    date: this.date,
                    totalDays: this.totalDays,
                    content: finalSummary
                }
            )
            character.saveSummaries(path.join(summariesPath, character.id.toString() + '.json'));
        }
    }

    /**
     * Check for conversation summaries for current AI characters in other player directories
     */
    async checkForSummariesFromOtherPlayers(): Promise<SummaryImportResult[]> {
        const results: SummaryImportResult[] = [];
        
        try {
            // Ensure summaries directory exists
            if (!fs.existsSync(VOTC_SUMMARIES_DIR)) {
                return results;
            }
            
            // Get all player directories
            const playerDirs = fs.readdirSync(VOTC_SUMMARIES_DIR, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .filter(playerId => playerId !== this.playerID.toString()); // Skip current player
            
            // For each AI character in current conversation, check other player directories
            for (const character of this.characters.values()) {
                if (character.id === this.playerID) continue; // Skip player character
                
                // Skip if character already has summaries with current player
                if (character.conversationSummaries && character.conversationSummaries.length > 0) {
                    continue;
                }
                
                for (const otherPlayerId of playerDirs) {
                    const sourceFilePath = path.join(VOTC_SUMMARIES_DIR, otherPlayerId, `${character.id}.json`);
                    
                    if (fs.existsSync(sourceFilePath)) {
                        try {
                            // Read the summaries to get count
                            const summariesData = fs.readFileSync(sourceFilePath, 'utf8');
                            const summaries = JSON.parse(summariesData);
                            const summaryCount = Array.isArray(summaries) ? summaries.length : 0;
                            
                            if (summaryCount > 0) {
                                const targetFilePath = path.join(VOTC_SUMMARIES_DIR, this.playerID.toString(), `${character.id}.json`);
                                
                                results.push({
                                    sourcePlayerId: otherPlayerId,
                                    characterId: character.id,
                                    characterName: character.fullName,
                                    summaryCount,
                                    sourceFilePath,
                                    targetFilePath
                                });
                                
                                // Don't break - continue checking other player directories to find all available imports
                            }
                        } catch (error) {
                            console.warn(`Failed to read summaries for character ${character.id} from player ${otherPlayerId}:`, error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error checking for summaries from other players:', error);
        }
        
        return results;
    }

    /**
     * Import summaries from another player character
     */
    async importSummariesFromOtherPlayer(
        characterId: number,
        sourcePlayerId: string,
        mergeWithExisting: boolean = false
    ): Promise<void> {
        const character = this.characters.get(characterId);
        if (!character) {
            throw new Error(`Character with ID ${characterId} not found`);
        }
        
        const sourceFilePath = path.join(VOTC_SUMMARIES_DIR, sourcePlayerId, `${characterId}.json`);
        const targetFilePath = path.join(VOTC_SUMMARIES_DIR, this.playerID.toString(), `${characterId}.json`);
        
        try {
            // Ensure target directory exists
            const targetDir = path.dirname(targetFilePath);
            fs.mkdirSync(targetDir, { recursive: true });
            
            // Read source summaries
            const sourceData = fs.readFileSync(sourceFilePath, 'utf8');
            const sourceSummaries = JSON.parse(sourceData);
            
            if (!Array.isArray(sourceSummaries)) {
                throw new Error('Source summaries file is not in expected format');
            }
            
            let finalSummaries: any[];
            
            if (mergeWithExisting && fs.existsSync(targetFilePath)) {
                // Read existing summaries
                const existingData = fs.readFileSync(targetFilePath, 'utf8');
                const existingSummaries = JSON.parse(existingData);
                
                if (Array.isArray(existingSummaries)) {
                    // Create a Set of existing summary identifiers to avoid duplicates
                    const existingSummaryKeys = new Set();
                    existingSummaries.forEach(summary => {
                        // Create a unique key based on date and content (first 100 chars)
                        const key = `${summary.date}_${summary.content?.substring(0, 100) || ''}`;
                        existingSummaryKeys.add(key);
                    });
                    
                    // Filter out duplicates from source summaries
                    const filteredSourceSummaries = sourceSummaries.filter(sourceSummary => {
                        const sourceKey = `${sourceSummary.date}_${sourceSummary.content?.substring(0, 100) || ''}`;
                        return !existingSummaryKeys.has(sourceKey);
                    });
                    
                    // Merge filtered source summaries with existing ones
                    finalSummaries = [...filteredSourceSummaries, ...existingSummaries].sort((a, b) => {
                        // Sort by totalDays (newest first), then by date string as fallback
                        if (a.totalDays !== undefined && b.totalDays !== undefined) {
                            return b.totalDays - a.totalDays;
                        }
                        return b.date.localeCompare(a.date);
                    });
                    
                    console.log(`Merged ${filteredSourceSummaries.length} new summaries with ${existingSummaries.length} existing summaries (filtered out ${sourceSummaries.length - filteredSourceSummaries.length} duplicates)`);
                } else {
                    finalSummaries = sourceSummaries;
                }
            } else {
                // Just use source summaries
                finalSummaries = sourceSummaries;
            }
            
            // Write merged summaries to target
            fs.writeFileSync(targetFilePath, JSON.stringify(finalSummaries, null, '\t'));
            
            // Load the summaries into the character
            character.loadSummaries(targetFilePath);
            
            console.log(`Successfully imported ${finalSummaries.length} total summaries for ${character.fullName} from player ${sourcePlayerId}${mergeWithExisting ? ' (merged with existing)' : ''}`);
        } catch (error) {
            console.error(`Failed to import summaries for character ${characterId} from player ${sourcePlayerId}:`, error);
            throw error;
        }
    }
}
