import type { PromptSettings } from '@llmTypes';
import { buildGroups, resolveLocalizedPath } from './promptFileGroups';

export type PromptMode = 'conversation' | 'letter';

export interface PromptLocaleSwitch {
  /** Stable id: `<mode>:<blockId>`. */
  id: string;
  mode: PromptMode;
  blockId: string;
  blockLabel: string;
  fromPath: string;
  toPath: string;
  fromLocale: string;
  toLocale: string;
  reason: 'match' | 'fallback_en';
}

export interface ReconcileResult {
  settings: PromptSettings;
  changed: boolean;
  switches: PromptLocaleSwitch[];
}

export function reconcileSettingsLocales(
  settings: PromptSettings,
  descriptions: string[],
  examples: string[],
  targetLang: string,
  mode: PromptMode,
): ReconcileResult {
  const descGroups = buildGroups(descriptions);
  const exGroups = buildGroups(examples);
  const lang = targetLang.toLowerCase();

  const switches: PromptLocaleSwitch[] = [];
  let changed = false;

  const nextBlocks = settings.blocks.map((block) => {
    if (block.type !== 'description' && block.type !== 'examples') return block;
    if (!block.scriptPath) return block;
    // Respect explicit user choices (manual pick or revert).
    if (block.localePinned) return block;

    const groups = block.type === 'description' ? descGroups : exGroups;
    const res = resolveLocalizedPath(groups, block.scriptPath, lang);
    // resolveLocalizedPath only sets changed=true when the group actually has
    // a viable target (match or English base); single-locale/ambiguous stay put.
    if (!res.changed) return block;

    changed = true;
    switches.push({
      id: `${mode}:${block.id}`,
      mode,
      blockId: block.id,
      blockLabel: block.label || block.type,
      fromPath: block.scriptPath.replace(/\\/g, '/'),
      toPath: res.newPath.replace(/\\/g, '/'),
      fromLocale: res.currentLocale,
      toLocale: res.isFallbackToEn ? 'en' : lang,
      reason: res.isFallbackToEn ? 'fallback_en' : 'match',
    });
    return { ...block, scriptPath: res.newPath };
  });

  return {
    settings: changed ? { ...settings, blocks: nextBlocks } : settings,
    changed,
    switches,
  };
}
