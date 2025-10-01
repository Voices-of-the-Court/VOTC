import { GameData } from "../gameData/GameData";
import { Character } from "../gameData/Character";
import { Message } from "./types";

export class PromptBuilder {
    /**
     * Generate a system prompt based on the characters in the conversation
     */
    static generateSystemPrompt(char: Character, gameData: GameData): string {
        if (gameData.characters.size === 0) {
            console.log('No characters in conversation for system prompt');
            return "You are characters in a medieval strategy game. Engage in conversation naturally.";
        }

        if (!char) {
            console.log('Primary character not found for ID:', gameData.aiID);
            return "You are characters in a medieval strategy game. Engage in conversation naturally.";
        }

        console.log('Generating system prompt for character:', char.shortName);

        let prompt = `You are ${char.fullName}, ${char.primaryTitle} in a medieval strategy game.

## Character Background:
- Name: ${char.shortName}
- Age: ${char.age} years old
- Personality: ${char.personality}
- Culture: ${char.culture}, Faith: ${char.faith}
- Sexuality: ${char.sexuality}
${char.liege ? `- Liege: ${char.liege}` : ''}
${char.consort ? `- Consort: ${char.consort}` : ''}

## Traits and Personality:
${char.traits.map(trait => `- ${trait.category}: ${trait.name} - ${trait.desc}`).join('\n') || 'None specific'}

## Current Situation:
- Gold: ${char.gold} gold coins
- Opinion of Player: ${char.opinionOfPlayer}/100
${char.isRuler ? '- Ruler status' : '- Not a ruler'}
${char.isIndependentRuler ? '- Independent ruler' : ''}
${char.capitalLocation ? `- Rules from: ${char.capitalLocation}` : ''}

## Key Relationships:
${char.relationsToPlayer.map(rel => `- ${rel}`).join('\n') || 'None noted'}

You should respond as this character would, taking into account their personality, traits, and opinions. Be politically minded, strategic, and true to medieval courtly behavior and feudal relationships.`;

        console.log('Generated system prompt:', prompt.substring(0, 200) + '...');
        return prompt;
    }

    /**
     * Build the full LLM messages array for a character response
     */
    static buildMessages(history: Message[], char: Character, gameData: GameData): any[] {
        const systemPrompt = this.generateSystemPrompt(char, gameData);
        const llmMessages: any[] = [
            { role: 'system', content: systemPrompt },
            ...history.map(m => ({ role: m.role, content: `${m.name}: ${m.content}` })),
            { role: 'user', content: `[Write next reply only as ${char.shortName}]`}
        ];
        return llmMessages;
    }
}