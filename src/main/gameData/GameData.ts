import path from "path";
import fs from "fs";
import { Character } from "./Character";
import { VOTC_SUMMARIES_DIR } from "../utils/paths";

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

            this.characters = new Map<number, Character>()
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
}