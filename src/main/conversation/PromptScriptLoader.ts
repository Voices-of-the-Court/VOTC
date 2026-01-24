import fs from 'fs';
import path from 'path';

export class PromptScriptLoader {
  private cache = new Map<string, any>();

  private resolve(scriptPath: string): string {
    return path.resolve(scriptPath);
  }

  private loadModule(resolvedPath: string): any {
    if (this.cache.has(resolvedPath)) {
      return this.cache.get(resolvedPath);
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Prompt script not found: ${resolvedPath}`);
    }

    // Clear require cache in dev to pick up changes
    delete require.cache[resolvedPath];
    const mod = require(resolvedPath);
    this.cache.set(resolvedPath, mod);
    return mod;
  }

  executeDescription(scriptPath: string, gameData: any, currentCharacterId?: number): string {
    const resolved = this.resolve(scriptPath);
    const mod = this.loadModule(resolved);
    const fn = mod && (mod.default || mod);
    if (typeof fn !== 'function') {
      throw new Error(`Description script must export a function: ${scriptPath}`);
    }
    return fn(gameData, currentCharacterId);
  }

  executeExamples(scriptPath: string, gameData: any, currentCharacterId?: number): any[] {
    const resolved = this.resolve(scriptPath);
    const mod = this.loadModule(resolved);
    const fn = mod && (mod.default || mod);
    if (typeof fn !== 'function') {
      throw new Error(`Example script must export a function: ${scriptPath}`);
    }
    const result = fn(gameData, currentCharacterId);
    if (!Array.isArray(result)) {
      return [];
    }
    return result;
  }
}
