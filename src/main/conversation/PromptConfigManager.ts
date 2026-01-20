import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import {
  VOTC_PROMPTS_DIR,
  VOTC_PROMPTS_SYSTEM_DIR,
  VOTC_PROMPTS_CHARACTER_DIR,
  VOTC_PROMPTS_EXAMPLES_DIR,
  VOTC_PROMPTS_HELPERS_DIR
} from '../utils/paths';
import { PromptSettings } from '../llmProviders/types';

const DEFAULT_USERDATA_DIR = path.join(app.getAppPath(), 'default_userdata', 'prompts');

export class PromptConfigManager {
  ensurePromptDirs(): void {
    [VOTC_PROMPTS_DIR, VOTC_PROMPTS_SYSTEM_DIR, VOTC_PROMPTS_CHARACTER_DIR, VOTC_PROMPTS_EXAMPLES_DIR, VOTC_PROMPTS_HELPERS_DIR]
      .forEach(dir => fs.mkdirSync(dir, { recursive: true }));
  }

  /**
   * Copy default prompt assets into user data if they do not exist.
   */
  seedDefaults(): void {
    this.ensurePromptDirs();
    if (!fs.existsSync(DEFAULT_USERDATA_DIR)) {
      return;
    }

    const copyRecursive = (src: string, dest: string) => {
      if (!fs.existsSync(src)) return;
      const stat = fs.statSync(src);
      if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src)) {
          copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
      } else {
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
      }
    };

    copyRecursive(DEFAULT_USERDATA_DIR, VOTC_PROMPTS_DIR);
  }

  listFiles(category: 'system' | 'character_description' | 'example_messages' | 'helpers'): string[] {
    let base = VOTC_PROMPTS_DIR;
    if (category === 'system') base = VOTC_PROMPTS_SYSTEM_DIR;
    if (category === 'character_description') base = VOTC_PROMPTS_CHARACTER_DIR;
    if (category === 'example_messages') base = VOTC_PROMPTS_EXAMPLES_DIR;
    if (category === 'helpers') base = VOTC_PROMPTS_HELPERS_DIR;

    const files: string[] = [];
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir)) {
        if (entry === '.gitkeep') continue;
        const full = path.join(dir, entry);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          walk(full);
        } else {
          files.push(path.relative(VOTC_PROMPTS_DIR, full).replace(/\\/g, '/'));
        }
      }
    };
    walk(base);
    return files;
  }

  readPromptFile(relativePath: string): string {
    const full = path.join(VOTC_PROMPTS_DIR, relativePath);
    return fs.readFileSync(full, 'utf-8');
  }

  savePromptFile(relativePath: string, content: string): void {
    const full = path.join(VOTC_PROMPTS_DIR, relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
  }

  resolvePath(relativeOrAbsolute: string): string {
    if (path.isAbsolute(relativeOrAbsolute)) return relativeOrAbsolute;
    return path.join(VOTC_PROMPTS_DIR, relativeOrAbsolute);
  }

  normalizeSettings(settings: PromptSettings): PromptSettings {
    return {
      ...settings,
      systemPromptTemplate: settings.systemPromptTemplate || 'system/default.hbs',
      characterDescriptionScript: settings.characterDescriptionScript || 'character_description/standard/pListMcc.js',
      exampleMessagesScript: settings.exampleMessagesScript || 'example_messages/standard/mccAliChat.js',
      memoriesInsertDepth: settings.memoriesInsertDepth ?? 3,
      summariesInsertDepth: settings.summariesInsertDepth ?? 2,
      descInsertDepth: settings.descInsertDepth ?? 1,
      enableSuffixPrompt: settings.enableSuffixPrompt ?? false,
      suffixPrompt: settings.suffixPrompt ?? ''
    };
  }
}

export const promptConfigManager = new PromptConfigManager();
