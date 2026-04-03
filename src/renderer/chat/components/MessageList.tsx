import React, { RefObject, useMemo } from 'react';
import MessageItem from './MessageItem';
import { ChatEntry, ActionFeedbackEntry } from '../types';

interface MessageListProps {
  entries: ChatEntry[];
  scrollRef: RefObject<HTMLDivElement | null>;
  containerRef?: RefObject<HTMLDivElement | null>;
  onScroll?: () => void;
}

const MessageList: React.FC<MessageListProps> = ({ 
  entries, 
  scrollRef,
  containerRef,
  onScroll
}) => {
  // Build a map of associatedMessageId → badge feedbacks for inline rendering
  const badgeFeedbackMap = useMemo(() => {
    const map = new Map<number, ActionFeedbackEntry[]>();
    for (const entry of entries) {
      if (entry.type === 'action-feedback' && entry.associatedMessageId != null) {
        const hasBadges = entry.feedbacks.some(f => (f.messageType || 'badge') === 'badge');
        if (hasBadges) {
          const existing = map.get(entry.associatedMessageId) || [];
          existing.push(entry);
          map.set(entry.associatedMessageId, existing);
        }
      }
    }
    return map;
  }, [entries]);

  // Filter out badge-only feedback entries that are associated with a message (they'll render inline)
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (entry.type === 'action-feedback' && entry.associatedMessageId != null) {
        const hasNarrations = entry.feedbacks.some(f => f.messageType === 'narration');
        const hasBadges = entry.feedbacks.some(f => (f.messageType || 'badge') === 'badge');
        // Keep if it has narrations (those render standalone). Drop if badge-only.
        if (hasBadges && !hasNarrations) return false;
      }
      return true;
    });
  }, [entries]);

  return (
    <div 
      className="messages-container"
      ref={containerRef}
      onScroll={onScroll}
    >
      <div className="messages">
        {filteredEntries.map(entry => (
          <MessageItem key={entry.id} entry={entry} badgeFeedbacks={badgeFeedbackMap.get(entry.id)} />
        ))}
        <div ref={scrollRef} />
      </div>
    </div>
  );
};

export default MessageList;
