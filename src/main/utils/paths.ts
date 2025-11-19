import { app } from 'electron';
import path from 'path';

export const VOTC_DATA_DIR = path.join(app.getPath('userData'), 'votc_data');
export const VOTC_LOGS_DIR = path.join(VOTC_DATA_DIR, 'logs');
export const VOTC_SUMMARIES_DIR = path.join(VOTC_DATA_DIR, 'conversation_summaries');
export const VOTC_ACTIONS_DIR = path.join(VOTC_DATA_DIR, 'actions');
export const VOTC_PROMPTS_DIR = path.join(VOTC_DATA_DIR, 'prompts');
  
