export interface BaseEntry {
  id: string;
  datetime: Date;
}

export interface MessageEntry extends BaseEntry {
  type: 'message';
  role: 'system' | 'user' | 'assistant';
  name?: string;
  content: string;
  isStreaming?: boolean;
}

export interface ErrorEntry extends BaseEntry {
  type: 'error';
  content: string;
  details?: string;
}

export type ChatEntry = MessageEntry | ErrorEntry;