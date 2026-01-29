import React from 'react';
import { ActionApprovalEntry } from '../types';
import './ActionApprovalItem.scss';

interface ActionApprovalItemProps {
  entry: ActionApprovalEntry;
}

const ActionApprovalItem: React.FC<ActionApprovalItemProps> = ({ entry }) => {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const action = entry.action;

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await window.conversationAPI.approveActions(entry.id);
    } catch (error) {
      console.error('Failed to approve action:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    setIsProcessing(true);
    try {
      await window.conversationAPI.declineActions(entry.id);
    } catch (error) {
      console.error('Failed to decline action:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const isPending = entry.status === 'pending';
  const hasTarget = !!action.targetCharacterName;
  const sentiment = entry.resultSentiment || entry.previewSentiment || 'neutral';
  const message =
    entry.resultFeedback ||
    entry.previewFeedback ||
    action.actionTitle ||
    action.actionId;
  const argsDisplay =
    action.args && Object.keys(action.args).length > 0
      ? JSON.stringify(action.args)
      : 'No parameters';

  return (
    <div className={`action-feedback-container approval ${isPending ? 'pending' : 'resolved'}`}>
      <div className="action-feedback-list">
        <div
          className={`action-feedback-item ${sentiment} ${isPending ? 'pending' : 'resolved'} ${action.isDestructive ? 'destructive' : ''}`}
          title={action.actionTitle || action.actionId}
        >
          <span className="action-feedback-message">
            {isPending ? 'Pending approval · ' : ''}
            {message}
          </span>
          {isPending && (
            <div className="approval-actions">
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="approve-button"
              >
                {isProcessing ? '...' : 'Approve'}
              </button>
              <button
                onClick={handleDecline}
                disabled={isProcessing}
                className="decline-button"
              >
                {isProcessing ? '...' : 'Decline'}
              </button>
            </div>
          )}
        </div>
      </div>

      {isPending && (
        <div className="approval-hover">
          <div className="hover-row">
            <span className="label">From</span>
            <span>{action.sourceCharacterName}</span>
          </div>
          {hasTarget && (
            <div className="hover-row">
              <span className="label">To</span>
              <span>{action.targetCharacterName}</span>
            </div>
          )}
          <div className="hover-row">
            <span className="label">Args</span>
            <span className="args">{argsDisplay}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionApprovalItem;
