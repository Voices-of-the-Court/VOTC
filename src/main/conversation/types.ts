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

export type ConversationEntry = Message | ErrorEntry;