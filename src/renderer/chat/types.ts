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

export interface ActionFeedbackEntry extends BaseEntry {
  type: 'action-feedback';
  associatedMessageId: string;
  feedbacks: Array<{
    actionId: string;
    success: boolean;
    message: string;
    sentiment: 'positive' | 'negative' | 'neutral';
  }>;
}

export type ChatEntry = MessageEntry | ErrorEntry | ActionFeedbackEntry;