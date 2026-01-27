import React, { useState } from 'react';
import { SummaryImportEntry } from '../types';
import './SummaryImportNotification.scss';

interface SummaryImportNotificationProps {
  entry: SummaryImportEntry;
}

const SummaryImportNotification: React.FC<SummaryImportNotificationProps> = ({ entry }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      await window.conversationAPI.acceptSummaryImport(entry.characterId, entry.sourcePlayerId);
    } catch (error) {
      console.error('Failed to accept summary import:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      await window.conversationAPI.declineSummaryImport(entry.characterId, entry.sourcePlayerId);
    } catch (error) {
      console.error('Failed to decline summary import:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewFile = async () => {
    try {
      await window.conversationAPI.openSummaryFile(entry.sourceFilePath);
    } catch (error) {
      console.error('Failed to open summary file:', error);
    }
  };

  return (
    <div className="summary-import-notification">
      <div className="summary-import-icon">📋</div>
      <div className="summary-import-content">
        <div className="summary-import-title">
          Found {entry.summaryCount} conversation summaries for {entry.characterName}
        </div>
        <div className="summary-import-description">
          These summaries are from another playthrough (Player ID: {entry.sourcePlayerId}).
          Would you like to import them to maintain continuity?
        </div>
        <div className="summary-import-actions">
          <button 
            className="summary-import-btn accept"
            onClick={handleAccept}
            disabled={isProcessing}
          >
            {isProcessing ? 'Importing...' : 'Accept'}
          </button>
          <button 
            className="summary-import-btn decline"
            onClick={handleDecline}
            disabled={isProcessing}
          >
            Decline
          </button>
          <button 
            className="summary-import-btn view-file"
            onClick={handleViewFile}
            disabled={isProcessing}
          >
            View File
          </button>
        </div>
      </div>
    </div>
  );
};

export default SummaryImportNotification;