import { ActionArgumentValues } from "../actions/types";

export interface BaseEntry {
    id: number;
    datetime: Date;
}

export interface Message extends BaseEntry {
    type: 'message';
    role: 'system' | 'user' | 'assistant';
    name?: string;
    content: string;
    isStreaming?: boolean;
}

export interface ErrorEntry extends BaseEntry {
    type: 'error';
    code?: number;
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

export function createMessage(input: Omit<Message, 'type' |'datetime'>): Message {
    return {
        ...input,
        type: 'message',
        datetime: new Date()
    };
}

export function createError(input: Omit<ErrorEntry, 'type' | 'datetime'>): ErrorEntry {
    return {
        ...input,
        type: 'error',
        datetime: new Date()
    };
}

export function createActionFeedback(input: Omit<ActionFeedbackEntry, 'type' | 'datetime'>): ActionFeedbackEntry {
    return {
        ...input,
        type: 'action-feedback',
        datetime: new Date()
    };
}

export interface ActionApprovalEntry extends BaseEntry {
    type: 'action-approval';
    associatedMessageId: number;
    actions: Array<{
        actionId: string;
        actionTitle?: string;
        sourceCharacterId: number;
        sourceCharacterName: string;
        targetCharacterId?: number;
        targetCharacterName?: string;
        args: ActionArgumentValues;
        isDestructive: boolean;
    }>;
    status: 'pending' | 'approved' | 'declined';
}

export function createActionApproval(params: {
  id: number;
  associatedMessageId: number;
  actions: Array<{
    actionId: string;
    actionTitle?: string;
    sourceCharacterId: number;
    sourceCharacterName: string;
    targetCharacterId?: number;
    targetCharacterName?: string;
    args: ActionArgumentValues;
    isDestructive: boolean;
  }>;
}): ActionApprovalEntry {
  return {
    type: 'action-approval',
    id: params.id,
    associatedMessageId: params.associatedMessageId,
    actions: params.actions,
    status: 'pending',
    datetime: new Date()
  };
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

export function createSummaryImport(input: Omit<SummaryImportEntry, 'type' | 'datetime'>): SummaryImportEntry {
    return {
        ...input,
        type: 'summary-import',
        datetime: new Date()
    };
}

export type ConversationEntry = Message | ErrorEntry | ActionFeedbackEntry | SummaryImportEntry | ActionApprovalEntry;