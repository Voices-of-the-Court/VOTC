import React from 'react';
import { ActionFeedbackEntry } from '../types';

interface ActionFeedbackItemProps {
  entry: ActionFeedbackEntry;
}

const ActionFeedbackItem: React.FC<ActionFeedbackItemProps> = ({ entry }) => {
  // Safety check for feedbacks array
  if (!entry.feedbacks || !Array.isArray(entry.feedbacks) || entry.feedbacks.length === 0) {
    return null;
  }

  const badges = entry.feedbacks.filter(f => (f.messageType || 'badge') === 'badge');
  const narrations = entry.feedbacks.filter(f => f.messageType === 'narration');

  return (
    <>
      {badges.length > 0 && (
        <div className="action-feedback-container">
          <div className="action-feedback-list">
            {badges.map((feedback, index) => {
              let itemClass = 'action-feedback-item';
              if (!feedback.success) {
                itemClass += ' error';
              } else {
                itemClass += ` ${feedback.sentiment}`;
              }
              return (
                <div key={index} className={itemClass}>
                  <span className="action-feedback-message">{feedback.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {narrations.map((feedback, index) => {
        const sentimentClass = !feedback.success ? 'error' : feedback.sentiment;
        return (
          <div key={`narration-${index}`} className={`action-narration ${sentimentClass}`}>
            {feedback.title && <div className="action-narration-title">{feedback.title}</div>}
            <p className="action-narration-text">{feedback.message}</p>
          </div>
        );
      })}
    </>
  );
};

export default ActionFeedbackItem;