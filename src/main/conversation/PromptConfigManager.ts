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
import { PromptBlock, PromptPreset, PromptSettings } from '../llmProviders/types';

const DEFAULT_USERDATA_DIR = path.join(app.getAppPath(), 'default_userdata', 'prompts');
const DEFAULT_MAIN_TEMPLATE_PATH = 'system/default.hbs';
const DEFAULT_LETTER_TEMPLATE_PATH = 'system/letter.hbs';

export class PromptConfigManager {
  ensurePromptDirs(): void {
    [VOTC_PROMPTS_DIR, VOTC_PROMPTS_SYSTEM_DIR, VOTC_PROMPTS_CHARACTER_DIR, VOTC_PROMPTS_EXAMPLES_DIR, VOTC_PROMPTS_HELPERS_DIR]
      .forEach(dir => fs.mkdirSync(dir, { recursive: true }));
  }

  /**
   * Copy default prompt assets into user data, always updating existing files.
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
        fs.copyFileSync(src, dest);
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

  getDefaultMainTemplateContent(): string {
    const fallback = 'You are a character in a medieval strategy game.';
    try {
      this.ensurePromptDirs();
      const fullPath = path.join(VOTC_PROMPTS_DIR, DEFAULT_MAIN_TEMPLATE_PATH);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf-8');
      }
      const bundledDefault = path.join(DEFAULT_USERDATA_DIR, 'system', 'default.hbs');
      if (fs.existsSync(bundledDefault)) {
        return fs.readFileSync(bundledDefault, 'utf-8');
      }
    } catch (error) {
      console.error('Failed to read default main template:', error);
    }
    return fallback;
  }

  private generateBlockId(type: string): string {
    return `${type}-${Math.random().toString(36).slice(2, 8)}`;
  }

  getDefaultBlocks(): PromptBlock[] {
    return [
      {
        id: 'main-system',
        type: 'main',
        label: 'Main System Prompt',
        enabled: true,
        role: 'system',
        template: '',
      },
      {
        id: 'character-description',
        type: 'description',
        label: 'Character Description (pList)',
        enabled: true,
        scriptPath: 'character_description/standard/pListMcc.js',
      },
      {
        id: 'example-messages',
        type: 'examples',
        label: 'Example Messages (AliChat)',
        enabled: true,
        scriptPath: 'example_messages/standard/mccAliChat.js',
      },
      {
        id: 'past-summaries',
        type: 'past_summaries',
        label: 'Past Conversation Summaries',
        enabled: true,
        template: '',
      },
      {
        id: 'memories',
        type: 'memories',
        label: 'Memories',
        enabled: true,
        template: 'Relevant memories:\\n{{#each memories}}- {{this.creationDate}}: {{this.desc}}\\n{{/each}}',
        limit: 5,
      },
      {
        id: 'rolling-summary',
        type: 'rolling_summary',
        label: 'Rolling Summary',
        enabled: true,
        template: 'Summary of earlier messages in this conversation:\\n{{summary}}',
      },
      {
        id: 'history',
        type: 'history',
        label: 'Conversation History',
        enabled: true,
        pinned: true,
      },
      {
        id: 'instruction',
        type: 'instruction',
        label: 'Main Instruction',
        enabled: true,
        role: 'user',
        template: '[Write next reply only as {{character.fullName}}]',
      },
    ];
  }

  getDefaultLetterBlocks(): PromptBlock[] {
    return [
      {
        id: 'letter-main-system',
        type: 'main',
        label: 'Letter System Prompt',
        enabled: true,
        role: 'system',
        template: '',
      },
      {
        id: 'letter-description',
        type: 'description',
        label: 'Letter Character Description (pList)',
        enabled: true,
        scriptPath: 'character_description/letter/pListLetter.js',
      },
      {
        id: 'letter-past-summaries',
        type: 'past_summaries',
        label: 'Past Conversation Summaries',
        enabled: true,
        template: '',
      },
      {
        id: 'letter-memories',
        type: 'memories',
        label: 'All Memories',
        enabled: true,
        template: 'All memories:\n{{#each memories}}- {{this.creationDate}}: {{this.desc}}\n{{/each}}',
      },
      {
        id: 'letter-instruction',
        type: 'instruction',
        label: 'Letter Instruction',
        enabled: true,
        role: 'user',
        template:
          'You received a letter from {{player.fullName}}:\n"{{letter.content}}"\nWrite only the reply as {{character.fullName}}.',
      },
    ];
  }

  private mergeBlocks(defaults: PromptBlock[], incoming?: PromptBlock[]): PromptBlock[] {
    const cleanedIncoming = Array.isArray(incoming) ? incoming : [];
    const normalize = (block: PromptBlock): PromptBlock => {
      const base =
        defaults.find((d) => d.id === block.id) ||
        defaults.find((d) => d.type === block.type) ||
        undefined;

      return {
        ...base,
        ...block,
        id: block.id || base?.id || this.generateBlockId(block.type),
        label: block.label || base?.label || block.type,
        enabled: block.enabled ?? base?.enabled ?? true,
        role: block.role || base?.role,
        template: block.template ?? base?.template,
        scriptPath: block.scriptPath ?? base?.scriptPath,
        limit: block.limit ?? base?.limit,
        pinned: block.pinned ?? base?.pinned ?? false,
      };
    };

    const merged = cleanedIncoming.map(normalize);

    defaults.forEach((d) => {
      const exists = merged.some((b) => b.id === d.id || b.type === d.type);
      if (!exists) {
        merged.push(d);
      }
    });

    return merged;
  }

  normalizeSettings(
    settings: any,
    options?: { defaultBlocks?: PromptBlock[]; defaultMainTemplatePath?: string; fallbackMainTemplate?: string }
  ): PromptSettings {
    const defaults = options?.defaultBlocks || this.getDefaultBlocks();
    const defaultMainTemplate = options?.fallbackMainTemplate || this.getDefaultMainTemplateContent();
    const defaultPath = settings?.defaultMainTemplatePath || options?.defaultMainTemplatePath || DEFAULT_MAIN_TEMPLATE_PATH;

    let mainTemplate = settings?.mainTemplate;
    if (!mainTemplate) {
      const legacyPath = settings?.systemPromptTemplate || defaultPath;
      try {
        mainTemplate = this.readPromptFile(legacyPath);
      } catch {
        mainTemplate = defaultMainTemplate;
      }
    }

    // Legacy migration for script selections
    const legacyDescScript = settings?.characterDescriptionScript;
    const legacyExamples = settings?.exampleMessagesScript;
    const legacySuffixEnabled = settings?.enableSuffixPrompt;
    const legacySuffixContent = settings?.suffixPrompt;

    let blocks: PromptBlock[] = [];
    if (Array.isArray(settings?.blocks) && settings.blocks.length > 0) {
      blocks = this.mergeBlocks(defaults, settings.blocks);
    } else {
      blocks = this.getDefaultBlocks().map((b) => {
        if (b.type === 'description' && legacyDescScript) {
          return { ...b, scriptPath: legacyDescScript };
        }
        if (b.type === 'examples' && legacyExamples) {
          return { ...b, scriptPath: legacyExamples };
        }
        return b;
      });
    }

    const suffix = {
      enabled: legacySuffixEnabled ?? settings?.suffix?.enabled ?? false,
      template: legacySuffixContent ?? settings?.suffix?.template ?? '',
      label: settings?.suffix?.label || 'Suffix',
    };

    return {
      mainTemplate,
      defaultMainTemplatePath: defaultPath,
      blocks,
      suffix,
    };
  }

  getPresetsPath(): string {
    return path.join(VOTC_PROMPTS_DIR, 'prompt-presets.json');
  }

  getPresets(): PromptPreset[] {
    const presetsPath = this.getPresetsPath();
    if (!fs.existsSync(presetsPath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(presetsPath, 'utf-8');
      const parsed = JSON.parse(raw) as PromptPreset[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to read prompt presets:', error);
      return [];
    }
  }

  savePreset(preset: PromptPreset): PromptPreset {
    const presets = this.getPresets();
    const index = presets.findIndex((p) => p.id === preset.id);
    if (index >= 0) {
      presets[index] = preset;
    } else {
      presets.push(preset);
    }
    fs.mkdirSync(VOTC_PROMPTS_DIR, { recursive: true });
    fs.writeFileSync(this.getPresetsPath(), JSON.stringify(presets, null, 2), 'utf-8');
    return preset;
  }

  deletePreset(id: string): void {
    const presets = this.getPresets().filter((p) => p.id !== id);
    fs.mkdirSync(VOTC_PROMPTS_DIR, { recursive: true });
    fs.writeFileSync(this.getPresetsPath(), JSON.stringify(presets, null, 2), 'utf-8');
  }

  getDefaultLetterMainTemplateContent(): string {
    const fallback = 'Respond with a letter in-character. Do not perform actions.';
    try {
      this.ensurePromptDirs();
      const fullPath = path.join(VOTC_PROMPTS_DIR, DEFAULT_LETTER_TEMPLATE_PATH);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf-8');
      }
      const bundledDefault = path.join(DEFAULT_USERDATA_DIR, 'system', 'letter.hbs');
      if (fs.existsSync(bundledDefault)) {
        return fs.readFileSync(bundledDefault, 'utf-8');
      }
    } catch (error) {
      console.error('Failed to read default letter template:', error);
    }
    return fallback;
  }
}

export const promptConfigManager = new PromptConfigManager();
