import React, { RefObject } from 'react';
import MessageItem, { ChatMessage } from './MessageItem';

interface MessageListProps {
  messages: ChatMessage[];
  scrollRef: RefObject<HTMLDivElement>;
}

const MessageList: React.FC<MessageListProps> = ({ messages, scrollRef }) => {
  return (
    <div className="messages-container">
      <div className="messages">
        {messages.map(msg => (
          <MessageItem key={msg.id} message={msg} />
        ))}
        <div ref={scrollRef} />
      </div>
    </div>
  );
};

export default MessageList;