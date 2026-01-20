import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { GameData } from '../gameData/GameData';
import { Character } from '../gameData/Character';

type TemplateContext = {
  character: Character;
  gameData: GameData;
  description?: string;
  examples?: any[];
};

export class TemplateEngine {
  private helpersRegistered = false;

  private ensureHelpers(): void {
    if (this.helpersRegistered) return;

    // Comparison helpers
    Handlebars.registerHelper('gt', (a: any, b: any) => a > b);
    Handlebars.registerHelper('lt', (a: any, b: any) => a < b);
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);

    Handlebars.registerHelper('ageDescription', (age: number) => {
      if (age < 3) return 'infant';
      if (age < 6) return 'small child';
      if (age < 10) return 'child';
      if (age < 13) return 'preteen';
      if (age < 16) return 'adolescent';
      if (age < 20) return 'young adult';
      if (age < 30) return 'adult';
      if (age < 40) return 'experienced adult';
      if (age < 60) return 'seasoned adult';
      return 'elder';
    });

    Handlebars.registerHelper('opinionLevel', (opinion: number) => {
      if (opinion > 60) return 'very favorable';
      if (opinion > 20) return 'positive';
      if (opinion > -20) return 'neutral';
      if (opinion > -60) return 'negative';
      return 'hostile';
    });

    Handlebars.registerHelper('prowessDescription', (prowess: number) => {
      if (prowess >= 15) return 'formidable warrior';
      if (prowess >= 10) return 'skilled combatant';
      if (prowess >= 5) return 'trained fighter';
      if (prowess > 0) return 'inexperienced fighter';
      return 'non-combatant';
    });

    Handlebars.registerHelper('goldStatus', (gold: number) => {
      if (gold >= 500) return 'wealthy';
      if (gold > 100) return 'comfortable';
      if (gold > 50) return 'poor';
      if (gold > 0) return 'struggling';
      if (gold === 0) return 'broke';
      return 'in debt';
    });

    Handlebars.registerHelper('filterTraits', (traits: any[], category: string) => {
      if (!Array.isArray(traits)) return [];
      return traits.filter(t => t.category === category);
    });

    Handlebars.registerHelper('otherCharacters', (characters: Map<number, Character>, currentId: number) => {
      if (!characters || typeof characters.values !== 'function') return [];
      return Array.from(characters.values()).filter(c => c.id !== currentId);
    });

    Handlebars.registerHelper('formatRelations', (relations: string[]) => {
      if (!relations || relations.length === 0) return '';
      return relations.join(', ');
    });

    this.helpersRegistered = true;
  }

  renderTemplate(templatePath: string, context: TemplateContext): string {
    this.ensureHelpers();
    const resolved = path.resolve(templatePath);
    const content = fs.readFileSync(resolved, 'utf-8');
    const template = Handlebars.compile(content);

    // current character should be the main scope, while keeping nested access via `character`
    const rootContext = {
      ...context.character,
      character: context.character,
      gameData: context.gameData,
      description: context.description,
      examples: context.examples,
    };

    return template(rootContext, {
      allowProtoPropertiesByDefault: true,
      allowProtoMethodsByDefault: true,
    });
  }
}
