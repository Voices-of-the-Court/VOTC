import fs from 'fs';
import path from 'path';
import { PromptScriptSandbox } from './PromptScriptSandbox';

/**
 * PromptScriptLoader - Loads and executes user-defined prompt scripts securely
 * 
 * Uses PromptScriptSandbox to run scripts in an isolated VM context,
 * preventing access to dangerous Node.js APIs like require, process, eval, etc.
 */
export class PromptScriptLoader {
  private resolve(scriptPath: string): string {
    return path.resolve(scriptPath);
  }

  executeDescription(scriptPath: string, gameData: any, currentCharacterId?: number): string {
    const resolved = this.resolve(scriptPath);
    
    if (!fs.existsSync(resolved)) {
      throw new Error(`Prompt script not found: ${resolved}`);
    }

    // Execute in sandbox for security
    return PromptScriptSandbox.executeDescription(resolved, { gameData, currentCharacterId });
  }

  executeExamples(scriptPath: string, gameData: any, currentCharacterId?: number): any[] {
    const resolved = this.resolve(scriptPath);
    
    if (!fs.existsSync(resolved)) {
      throw new Error(`Prompt script not found: ${resolved}`);
    }

    // Execute in sandbox for security
    return PromptScriptSandbox.executeExamples(resolved, { gameData, currentCharacterId });
  }
}