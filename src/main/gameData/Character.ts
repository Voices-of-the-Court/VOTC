import {Memory, Trait, OpinionModifier, Secret, KnownSecret, Modifier, Stress, Legitimacy, Troops, Law, Income, Treasury, Influence, Herd} from "./GameData"
import fs from 'fs';

// Simple replacement for removeTooltip since parseLog.ts doesn't exist
function removeTooltip(text: string): string {
    return text.replace(/<.*?>.*?<\/.*?>/gi, '').trim();
}

/** @class */
export class Character {
    /**@property {number} id - the ID of the character */
    id: number; 
    /**@property {string} shortName - example: Count Janos*/
    shortName: string; 
    fullName: string;
    primaryTitle: string;
    sheHe: string;
    age: number;
    gold: number;
    opinionOfPlayer: number;
    sexuality: string;
    personality: string;
    greed: number;
    isIndependentRuler: boolean;
    liege: string;
    consort: string;
    culture: string;
    faith: string;
    house: string;
    isRuler: boolean;
    firstName: string;
    capitalLocation: string;
    topLiege: string;
    prowess: number; 
    isKnight: boolean;
    liegeRealmLaw: string //used for knowing landless camp purpose
    isLandedRuler: boolean;
    heldCourtAndCouncilPositions: string
    titleRankConcept: string;

    secrets: Secret[];
    knownSecrets: KnownSecret[];
    modifiers: Modifier[];
    stress?: Stress;
    legitimacy?: Legitimacy;
    troops?: Troops;
    laws: Law[];
    income?: Income;
    treasury?: Treasury;
    influence?: Influence;
    herd?: Herd;
    memories: Memory[];
    traits: Trait[];
    relationsToPlayer: string[];
    relationsToCharacters: { id: number, relations: string[]}[];
    opinionBreakdowns: { id: number, breakdown: OpinionModifier[]}[];
    opinions: { id: number, opinon: number}[];

    // Conversation summaries
    conversationSummaries: ConversationSummary[] = [];


    constructor(data: string[]){
        this.id = Number(data[0]),
            this.shortName = data[1],
            this.fullName = data[2],
            this.primaryTitle = data[3],
            this.sheHe = data[4],
            this.age = Number(data[5]),
            this.gold = Math.floor(Number(data[6])),
            this.opinionOfPlayer = Number(data[7]),
            this.sexuality = removeTooltip(data[8]),
            this.personality = data[9],
            this.greed = Number(data[10]),
            this.isIndependentRuler = !!Number(data[11]),
            this.liege = data[12],
            this.consort = data[13],
            this.culture = data[14],
            this.faith = data[15],
            this.house = data[16],
            this.isRuler = !!Number(data[17]),
            this.firstName = data[18],
            this.capitalLocation = data[19],
            this.topLiege = data[20],
            this.prowess = Number(data[21]),
            this.isKnight = !!Number(data[22]),
            this.liegeRealmLaw = data[23],
            this.isLandedRuler = !!Number(data[24]),
            this.heldCourtAndCouncilPositions = data[25],
            this.titleRankConcept = data[26],
            this.secrets = [],
            this.knownSecrets = [],
            this.modifiers = [],
            this.laws = [],
            this.memories = [],
            this.traits = [],
            this.relationsToPlayer = [],
            this.relationsToCharacters = [],
            this.opinionBreakdowns = [],
            this.opinions = [];
    }

    /**
     * Check if the character has a trait with a given name.
     * @param name - the name of the trait
     * @return {boolean} 
     */
    hasTrait(name: string): boolean{
        return this.traits.some(trait => trait.name.toLowerCase() == name.toLowerCase())
    }

    /**
     * Append a new trait to the character.
     * @param {Trait }trait
     * @returns {void} 
     */
    addTrait(trait: Trait): void{
        this.traits.push(trait);
    }

    removeTrait(name: string): void{
        this.traits.filter( (trait) => {
            return trait.name.toLowerCase() !== name.toLowerCase();
        });
    }

    /**
     * Get the opinion breakdown to a specific character
     * @param {number} targetId - the ID of the target character
     * @returns {OpinionModifier[]} - array of opinion modifiers, or empty array if not found
     */
    getOpinionBreakdownTo(targetId: number): OpinionModifier[]{
        const breakdown = this.opinionBreakdowns.find(ob => ob.id === targetId);
        return breakdown ? breakdown.breakdown : [];
    }

    /**
     * Get the value of the opinion modifier with the given reason text towards a specific character
     * @param {number} targetId - the ID of the target character
     * @param {string} reason - the opinion modifier's reason text
     * @returns {number} - opinion modifier's value. returns 0 if doesn't exist.
     */
    getOpinionModifierValue(targetId: number, reason: string): number{
        const breakdown = this.getOpinionBreakdownTo(targetId);
        let target = breakdown.find(modifier => modifier.reason === reason);

        if(target !== undefined){
            return target.value;
        }
        else{
            return 0;
        }
    }

    /**
     * Sets the opinion modifier's value towards a specific character. Creates a new opinion modifier if it doesn't exist.
     * @param {number} targetId - the ID of the target character
     * @param {string} reason - The opinion modifier's reason text.
     * @param {number} value - The value to set the opinion modifier.
     * @returns {void}
     */
    setOpinionModifierValue(targetId: number, reason: string, value: number): void{
        let breakdownEntry = this.opinionBreakdowns.find(ob => ob.id === targetId);
        
        if(!breakdownEntry){
            breakdownEntry = { id: targetId, breakdown: [] };
            this.opinionBreakdowns.push(breakdownEntry);
        }

        let targetIndex = breakdownEntry.breakdown.findIndex((om: OpinionModifier) =>{
            return om.reason.toLowerCase() == reason.toLowerCase();
        })

        if(targetIndex != -1){
            breakdownEntry.breakdown[targetIndex].value = value;
        }
        else{
            breakdownEntry.breakdown.push({
                reason: reason,
                value: value
            })
        }
    }


    saveSummaries(summariesPath: string): void {
        fs.writeFileSync(summariesPath, JSON.stringify(this.conversationSummaries, null, '\t'));
    }
    
    loadSummaries(summariesPath: string): void {
        if (fs.existsSync(summariesPath)) {
            this.conversationSummaries = JSON.parse(fs.readFileSync(summariesPath, 'utf8'));
        }
    }
}

export interface ConversationSummary {
    date: string;
    totalDays: number;
    content: string;
}

