import React from 'react';
import { AnimatedMarkdown } from 'flowtoken';
import 'flowtoken/dist/styles.css';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
}

interface MessageItemProps {
  message: ChatMessage;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  return (
    <div className={`message`}>
      <div className={`${
        message.role === 'user' ? 'player-message' : message.role === 'assistant' ? 'ai-message' : 'system-message'
      }`}>
        <AnimatedMarkdown
          content={message.content}
          animation="fadeIn"
          animationDuration="0.5s"
          animationTimingFunction="ease-out"
          sep="char"
        />
        {message.isLoading && <span className="loading-dots"><span>.</span><span>.</span><span>.</span></span>}
      </div>
    </div>
  );
};

export default MessageItem;