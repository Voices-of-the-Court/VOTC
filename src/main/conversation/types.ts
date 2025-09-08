export interface BaseEntry {
    id: number;
    datetime: Date;
}

export interface Message extends BaseEntry {
    role: 'system' | 'user' | 'assistant';
    name?: string;
    content: string;
}

export interface ErrorEntry extends BaseEntry {
    code?: number;
    content: string;
    details?: string;
}

export type ConversationEntry = Message | ErrorEntry;