import fs from 'fs';
import archiver from 'archiver';
import { VOTC_PROMPTS_DIR } from './paths';
import { PromptPreset, PromptSettings } from '@llmTypes';


export const exportPromptsZip = (destination: string, settings: PromptSettings, presets: PromptPreset[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const output = fs.createWriteStream(destination);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      output.on('error', reject);
      archive.on('error', reject);

      archive.pipe(output);

      // Include prompts directory (pList, aliChat, helpers, etc.)
      archive.directory(VOTC_PROMPTS_DIR, 'prompts');

      // Include current prompt settings and presets
      archive.append(JSON.stringify(settings, null, 2), { name: 'prompt-settings.json' });
      archive.append(JSON.stringify(presets, null, 2), { name: 'prompt-presets.json' });

      archive.finalize();
    } catch (error) {
      reject(error);
    }
  });
};
