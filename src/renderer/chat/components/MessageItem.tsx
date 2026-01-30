import React, { useState } from 'react';
import StreamingMarkdown from './StreamingMarkdown';
import ActionFeedbackItem from './ActionFeedbackItem';
import SummaryImportNotification from './SummaryImportNotification';
import ActionApprovalItem from './ActionApprovalItem';
import { ChatEntry } from '../types';
import AlertIcon from '../../assets/Alert.png';


interface MessageItemProps {
  entry: ChatEntry;
}

const MessageItem: React.FC<MessageItemProps> = ({ entry }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const handleRegenerate = async () => {
    if (entry.type === 'message' && entry.role === 'assistant') {
      try {
        await window.conversationAPI.regenerateMessage(entry.id);
      } catch (error) {
        console.error('Failed to regenerate message:', error);
      }
    }
  };

  const handleRegenerateError = async () => {
    if (entry.type === 'error') {
      try {
        await window.conversationAPI.regenerateError(entry.id);
      } catch (error) {
        console.error('Failed to regenerate error:', error);
      }
    }
  };

  const handleEdit = () => {
    if (entry.type === 'message' && entry.role === 'user') {
      setIsEditing(true);
      setEditContent(entry.content);
    }
  };

  const handleSaveEdit = async () => {
    if (entry.type === 'message' && entry.role === 'user') {
      try {
        await window.conversationAPI.editUserMessage(entry.id, editContent);
        setIsEditing(false);
      } catch (error) {
        console.error('Failed to edit message:', error);
      }
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  if (entry.type === 'error') {
    return (
      <div className="message">
        <div className="error-message">
          <div className="error-header">
            <span className="error-icon"><img src={AlertIcon} alt="Error" /></span>
            <span className="error-title">Error</span>
            <div className="message-actions">
              <button className="message-action-btn" onClick={handleRegenerateError} title="Regenerate">
                🔄
              </button>
            </div>
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

  if (entry.type === 'action-feedback') {
    return <ActionFeedbackItem entry={entry} />;
  }

  if (entry.type === 'summary-import') {
    return <SummaryImportNotification entry={entry} />;
  }

  if (entry.type === 'action-approval') {
    return <ActionApprovalItem entry={entry} />;
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
          <div className="message-actions">
            {message.role === 'assistant' && !message.isStreaming && (
              <button className="message-action-btn" onClick={handleRegenerate} title="Regenerate">
                🔄
              </button>
            )}
            {message.role === 'user' && !isEditing && (
              <button className="message-action-btn" onClick={handleEdit} title="Edit">
                ✏️
              </button>
            )}
          </div>
        </div>
        {isEditing && message.role === 'user' ? (
          <div className="message-edit">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="message-edit-textarea"
              rows={Math.max(3, editContent.split('\n').length)}
            />
            <div className="message-edit-actions">
              <button onClick={handleSaveEdit} className="message-edit-save">Save</button>
              <button onClick={handleCancelEdit} className="message-edit-cancel">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <StreamingMarkdown 
              content={message.content}
              isAnimating={message.isStreaming? true : false}
            />
            {message.isStreaming && (
              <span className="loading-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MessageItem;