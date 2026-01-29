import React from 'react';
import { ActionApprovalEntry } from '../types';
import './ActionApprovalItem.scss';

interface ActionApprovalItemProps {
  entry: ActionApprovalEntry;
}

const ActionApprovalItem: React.FC<ActionApprovalItemProps> = ({ entry }) => {
  const [isProcessing, setIsProcessing] = React.useState(false);
  
  // Debug logging
  React.useEffect(() => {
    console.log('[ActionApprovalItem] Received entry:', entry);
    console.log('[ActionApprovalItem] Actions:', entry.actions);
  }, [entry]);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await window.conversationAPI.approveActions(entry.id);
    } catch (error) {
      console.error('Failed to approve actions:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    setIsProcessing(true);
    try {
      await window.conversationAPI.declineActions(entry.id);
    } catch (error) {
      console.error('Failed to decline actions:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const isPending = entry.status === 'pending';
  const hasDestructive = entry.actions && entry.actions.some(a => a.isDestructive);

  return (
    <div className={`action-approval-container ${hasDestructive ? 'destructive' : ''}`}>
      <div className="action-approval-header">
        <span className="action-approval-title">
          {hasDestructive && <span className="warning-icon">⚠️</span>}
          Action Approval Required
        </span>
        {entry.status !== 'pending' && (
          <span className={`approval-status ${entry.status}`}>
            {entry.status === 'approved' ? '✓ Approved' : '✗ Declined'}
          </span>
        )}
      </div>
      
      <div className="action-approval-list">
        {entry.actions && entry.actions.map((action, index) => (
          <div key={index} className={`action-approval-item ${action.isDestructive ? 'destructive' : ''}`}>
            <div className="action-info">
              <strong>{action.actionTitle || action.actionId}</strong>
              {action.isDestructive && <span className="destructive-badge">Destructive</span>}
            </div>
            <div className="action-details">
              <div>Source: {action.sourceCharacterName}</div>
              {action.targetCharacterName && (
                <div>Target: {action.targetCharacterName}</div>
              )}
              {Object.keys(action.args).length > 0 && (
                <div className="action-args">
                  Args: {JSON.stringify(action.args, null, 2)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isPending && (
        <div className="action-approval-buttons">
          <button
            onClick={handleApprove}
            disabled={isProcessing}
            className="approve-button"
          >
            {isProcessing ? 'Processing...' : 'Approve'}
          </button>
          <button
            onClick={handleDecline}
            disabled={isProcessing}
            className="decline-button"
          >
            {isProcessing ? 'Processing...' : 'Decline'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ActionApprovalItem;