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

  return (
    <div className="action-feedback-container">
      <div className="action-feedback-list">
        {entry.feedbacks.map((feedback, index) => {
          // Determine class based on success and sentiment
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
  );
};

export default ActionFeedbackItem;