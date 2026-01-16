import { useState, useEffect, useCallback } from 'react';
import { ChatEntry, MessageEntry, ErrorEntry, ActionFeedbackEntry } from '../types';

interface UseConversationEntriesReturn {
  entries: ChatEntry[];
  sendMessage: (content: string) => Promise<void>;
}

const useConversationEntries = (): UseConversationEntriesReturn => {
  const [entries, setEntries] = useState<ChatEntry[]>([]);

  // Load initial conversation entries on mount
  useEffect(() => {
    const loadInitialEntries = async () => {
      try {
        const backendEntries = await window.conversationAPI.getConversationEntries();

        // Convert backend entries to frontend format (number id -> string id)
        const convertedEntries: ChatEntry[] = backendEntries.map(entry => {
          if (entry.type === 'message') {
            return {
              id: entry.id.toString(),
              type: entry.type,
              role: entry.role,
              name: entry.name,
              content: entry.content,
              datetime: new Date(entry.datetime), // Ensure Date object
              isStreaming: entry.isStreaming
            } as MessageEntry;
          } else if (entry.type === 'action-feedback') {
            return {
              id: entry.id.toString(),
              type: entry.type,
              associatedMessageId: entry.associatedMessageId.toString(),
              feedbacks: entry.feedbacks,
              datetime: new Date(entry.datetime)
            } as ActionFeedbackEntry;
          } else {
            return {
              id: entry.id.toString(),
              type: entry.type,
              content: entry.content,
              datetime: new Date(entry.datetime), // Ensure Date object
              details: entry.details
            } as ErrorEntry;
          }
        });

        setEntries(convertedEntries);
      } catch (error) {
        console.error('Failed to load conversation entries:', error);
      }
    };

    loadInitialEntries();
  }, []);

  // Subscribe to conversation updates
  useEffect(() => {
    const cleanup = window.conversationAPI.onConversationUpdate((backendEntries: any[]) => {
      // Convert backend entries to frontend format
      const convertedEntries: ChatEntry[] = backendEntries.map(entry => {
        if (entry.type === 'message') {
          return {
            id: entry.id.toString(),
            type: entry.type,
            role: entry.role,
            name: entry.name,
            content: entry.content,
            datetime: new Date(entry.datetime), // Ensure Date object
            isStreaming: entry.isStreaming
          } as MessageEntry;
        } else if (entry.type === 'action-feedback') {
          return {
            id: entry.id.toString(),
            type: entry.type,
            associatedMessageId: entry.associatedMessageId.toString(),
            feedbacks: entry.feedbacks,
            datetime: new Date(entry.datetime)
          } as ActionFeedbackEntry;
        } else {
          return {
            id: entry.id.toString(),
            type: entry.type,
            content: entry.content,
            datetime: new Date(entry.datetime), // Ensure Date object
            details: entry.details
          } as ErrorEntry;
        }
      });

      setEntries(convertedEntries);
    });

    return cleanup;
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (content.trim() === '') return;

    try {
      // Send message through IPC - backend will handle everything
      await window.conversationAPI.sendMessage(content.trim());
      // No need to handle response - backend will emit updates via onConversationUpdate
    } catch (error) {
      console.error('Failed to send message:', error);
      // Error will be handled by backend and emitted through onConversationUpdate
    }
  }, []);

  return {
    entries,
    sendMessage
  };
};

export default useConversationEntries;