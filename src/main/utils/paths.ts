import { app } from 'electron';
import path from 'path';

export const VOTC_DATA_DIR = path.join(app.getPath('userData'), 'votc_data');
export const VOTC_LOGS_DIR = path.join(VOTC_DATA_DIR, 'logs');
export const VOTC_SUMMARIES_DIR = path.join(VOTC_DATA_DIR, 'conversation_summaries');
export const VOTC_ACTIONS_DIR = path.join(VOTC_DATA_DIR, 'actions');
export const VOTC_PROMPTS_DIR = path.join(VOTC_DATA_DIR, 'prompts');
export const VOTC_PROMPTS_SYSTEM_DIR = path.join(VOTC_PROMPTS_DIR, 'system');
export const VOTC_PROMPTS_CHARACTER_DIR = path.join(VOTC_PROMPTS_DIR, 'character_description');
export const VOTC_PROMPTS_EXAMPLES_DIR = path.join(VOTC_PROMPTS_DIR, 'example_messages');
export const VOTC_PROMPTS_HELPERS_DIR = path.join(VOTC_PROMPTS_DIR, 'helpers');
  
