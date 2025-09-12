import React from 'react';
import { AnimatedMarkdown } from 'flowtoken';
// import 'flowtoken/dist/styles.css';
import { ChatEntry } from '../types';

interface MessageItemProps {
  entry: ChatEntry;
}

const MessageItem: React.FC<MessageItemProps> = ({ entry }) => {
  if (entry.type === 'error') {
    return (
      <div className="message">
        <div className="error-message">
          <div className="error-header">
            <span className="error-icon">⚠️</span>
            <span className="error-title">Error</span>
          </div>
          <div className="error-content">
            <p>{entry.content}</p>
            {entry.details && (
              <details className="error-details">
                <summary>Details</summary>
                <pre>{entry.details}</pre>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Handle message entries
  const message = entry;
  return (
    <div className={`message`}>
      <div className={`${
        message.role === 'user' ? 'player-message' : message.role === 'assistant' ? 'ai-message' : 'system-message'
      }`}>
        <div className="message-header">
          <span className="message-role">{message.role === 'user' ? 'You' : message.role === 'assistant' ? message.name : 'System'}</span>
          {/* <span className="message-timestamp">{message.datetime.toLocaleString()}</span> */}
          {/* <p className="message-content">{message.content}</p> */}
        </div>
        <AnimatedMarkdown
          content={message.content}
          animation={message.isStreaming ? 'fadeIn' : null}
          animationDuration="0.6s"
          animationTimingFunction="ease-in-out"
          sep="diff"
        />
        {message.isStreaming && <span className="loading-dots"><span>.</span><span>.</span><span>.</span></span>}
      </div>
    </div>
  );
};

export default MessageItem;