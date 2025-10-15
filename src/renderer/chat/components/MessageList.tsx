import React, { RefObject } from 'react';
import MessageItem from './MessageItem';
import { ChatEntry } from '../types';

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
  return (
    <div 
      className="messages-container"
      ref={containerRef}
      onScroll={onScroll}
    >
      <div className="messages">
        {entries.map(entry => (
          <MessageItem key={entry.id} entry={entry} />
        ))}
        <div ref={scrollRef} />
      </div>
    </div>
  );
};

export default MessageList;
