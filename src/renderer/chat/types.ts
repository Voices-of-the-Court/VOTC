export interface BaseEntry {
  id: number;
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
  associatedMessageId: number;
  feedbacks: Array<{
    actionId: string;
    success: boolean;
    message: string;
    sentiment: 'positive' | 'negative' | 'neutral';
  }>;
}

export interface SummaryImportEntry extends BaseEntry {
  type: 'summary-import';
  sourcePlayerId: string;
  characterId: number;
  characterName: string;
  summaryCount: number;
  sourceFilePath: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface ActionApprovalEntry extends BaseEntry {
  type: 'action-approval';
  associatedMessageId: number;
  action: {
    actionId: string;
    actionTitle?: string;
    sourceCharacterId: number;
    sourceCharacterName: string;
    targetCharacterId?: number;
    targetCharacterName?: string;
    args: Record<string, any>;
    isDestructive: boolean;
  };
  status: 'pending' | 'approved';
  previewFeedback?: string;
  previewSentiment?: 'positive' | 'negative' | 'neutral';
  resultFeedback?: string;
  resultSentiment?: 'positive' | 'negative' | 'neutral';
}

export type ChatEntry = MessageEntry | ErrorEntry | ActionFeedbackEntry | SummaryImportEntry | ActionApprovalEntry;
