import React, { RefObject } from 'react';
import MessageItem from './MessageItem';
import { ChatEntry } from '../types';

interface MessageListProps {
  entries: ChatEntry[];
  scrollRef: RefObject<HTMLDivElement>;
}

const MessageList: React.FC<MessageListProps> = ({ entries, scrollRef }) => {
  return (
    <div className="messages-container">
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