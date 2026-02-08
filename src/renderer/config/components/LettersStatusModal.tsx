import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface LetterStatusInfo {
  letterId: string;
  letterContent: string;
  responseContent: string | null;
  responseStatus: string;
  responseError: string | null;
  summaryStatus: string;
  summaryContent: string | null;
  summaryError: string | null;
  createdAt: number;
  expectedDeliveryDay: number;
  currentDay: number;
  daysUntilDelivery: number;
  isLate: boolean;
  characterName?: string;
}

interface LetterStatusSnapshot {
  letters: LetterStatusInfo[];
  currentTotalDays: number;
  timestamp: number;
}

interface LettersStatusModalProps {
  onClose: () => void;
}

export function LettersStatusModal({ onClose }: LettersStatusModalProps) {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<LetterStatusSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedLetters, setExpandedLetters] = useState<Set<string>>(new Set());
  
  const loadStatuses = async () => {
    setIsLoading(true);
    try {
      const data = await window.lettersAPI.getStatuses();
      setSnapshot(data);
    } catch (error) {
      console.error('Failed to load letter statuses:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadStatuses();
  }, []);

  const toggleLetterExpanded = (letterId: string) => {
    setExpandedLetters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(letterId)) {
        newSet.delete(letterId);
      } else {
        newSet.add(letterId);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'generating': return '⏳';
      case 'generated': return '✅';
      case 'generation_failed': return '❌';
      case 'pending_delivery': return '📬';
      case 'sent': return '✉️';
      case 'send_failed': return '⚠️';
      case 'not_started': return '⭕';
      case 'saved': return '📁';
      case 'save_failed': return '⚠️';
      default: return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'generating': return '#FFA500'; // Orange
      case 'generated': return '#28a745'; // Green
      case 'generation_failed': return '#dc3545'; // Red
      case 'pending_delivery': return '#2196F3'; // Blue
      case 'sent': return '#28a745'; // Green
      case 'send_failed': return '#dc3545'; // Red
      case 'not_started': return '#6c757d'; // Gray
      case 'saved': return '#28a745'; // Green
      case 'save_failed': return '#dc3545'; // Red
      default: return '#6c757d'; // Gray
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'generating': return t('lettersModal.statusGenerating');
      case 'generated': return t('lettersModal.statusGenerated');
      case 'generation_failed': return t('lettersModal.statusGenerationFailed');
      case 'pending_delivery': return t('lettersModal.statusPendingDelivery');
      case 'sent': return t('lettersModal.statusSent');
      case 'send_failed': return t('lettersModal.statusSendFailed');
      case 'not_started': return t('lettersModal.statusNotStarted');
      case 'saved': return t('lettersModal.statusSaved');
      case 'save_failed': return t('lettersModal.statusSaveFailed');
      default: return status;
    }
  };

  const groupLettersByStatus = () => {
    if (!snapshot) {
      return {
        generating: [] as LetterStatusInfo[],
        pending_delivery: [] as LetterStatusInfo[],
        generation_failed: [] as LetterStatusInfo[],
        sent: [] as LetterStatusInfo[],
        send_failed: [] as LetterStatusInfo[]
      };
    }
    
    const groups = {
      generating: [] as LetterStatusInfo[],
      pending_delivery: [] as LetterStatusInfo[],
      generation_failed: [] as LetterStatusInfo[],
      sent: [] as LetterStatusInfo[],
      send_failed: [] as LetterStatusInfo[]
    };

    snapshot.letters.forEach(letter => {
      if (letter.responseStatus === 'generating') {
        groups.generating.push(letter);
      } else if (letter.responseStatus === 'pending_delivery') {
        groups.pending_delivery.push(letter);
      } else if (letter.responseStatus === 'generation_failed') {
        groups.generation_failed.push(letter);
      } else if (letter.responseStatus === 'sent') {
        groups.sent.push(letter);
      } else if (letter.responseStatus === 'send_failed') {
        groups.send_failed.push(letter);
      }
    });

    return groups;
  };

  const formatDeliveryTime = (letter: LetterStatusInfo) => {
    if (letter.responseStatus === 'sent') {
      return t('lettersModal.delivered');
    }
    
    if (letter.isLate) {
      return t('lettersModal.lateByDays', { days: Math.abs(letter.daysUntilDelivery) });
    }
    
    if (letter.daysUntilDelivery === 0) {
      return t('lettersModal.deliversToday');
    }
    
    return t('lettersModal.deliversInDays', { days: letter.daysUntilDelivery });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const groups = groupLettersByStatus();

  return (
    <div className="modal-overlay">
      <div className="modal-content letters-status-modal">
        <div className="modal-header">
          <h4>{t('lettersModal.lettersStatus')}</h4>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="header-actions">
            <button onClick={loadStatuses} disabled={isLoading}>
              {isLoading ? t('lettersModal.loading') : t('lettersModal.refresh')}
            </button>
            {snapshot && (
              <span style={{ marginLeft: '10px', color: '#888', fontSize: '0.9em' }}>
                {t('lettersModal.lastUpdated')}: {formatDate(snapshot.timestamp)}
              </span>
            )}
          </div>
          
          {/* Summary statistics */}
          <div className="status-summary">
            <div className="stat-card">
              <div className="stat-value">{snapshot?.letters.length || 0}</div>
              <div className="stat-label">{t('lettersModal.totalLetters')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{groups.generating.length}</div>
              <div className="stat-label">{t('lettersModal.generating')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{groups.pending_delivery.length}</div>
              <div className="stat-label">{t('lettersModal.pendingDelivery')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#dc3545' }}>
                {groups.generation_failed.length + groups.send_failed.length}
              </div>
              <div className="stat-label">{t('lettersModal.failed')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#28a745' }}>
                {groups.sent.length}
              </div>
              <div className="stat-label">{t('lettersModal.completed')}</div>
            </div>
          </div>
          
          {/* Current game day */}
          {snapshot && (
            <div className="current-day-info">
              <strong>{t('lettersModal.currentGameDay')}:</strong> {snapshot.currentTotalDays}
            </div>
          )}
          
          {/* Letters list grouped by status */}
          <div className="letters-list">
            {groups.generating.length > 0 && (
              <LetterGroup
                title={t('lettersModal.responseGenerationInProgress')}
                letters={[...groups.generating]}
                icon="⏳"
                expandedLetters={expandedLetters}
                toggleLetterExpanded={toggleLetterExpanded}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
                getStatusText={getStatusText}
                formatDeliveryTime={formatDeliveryTime}
                t={t}
              />
            )}
            
            {groups.pending_delivery.length > 0 && (
              <LetterGroup
                title={t('lettersModal.pendingDeliveryTitle')}
                letters={[...groups.pending_delivery]}
                icon="📬"
                expandedLetters={expandedLetters}
                toggleLetterExpanded={toggleLetterExpanded}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
                getStatusText={getStatusText}
                formatDeliveryTime={formatDeliveryTime}
                t={t}
              />
            )}
            
            {groups.generation_failed.length > 0 && (
              <LetterGroup
                title={t('lettersModal.responseGenerationFailed')}
                letters={[...groups.generation_failed]}
                icon="❌"
                expandedLetters={expandedLetters}
                toggleLetterExpanded={toggleLetterExpanded}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
                getStatusText={getStatusText}
                formatDeliveryTime={formatDeliveryTime}
                t={t}
              />
            )}
            
            {groups.sent.length > 0 && (
              <LetterGroup
                title={t('lettersModal.sentSuccessfully')}
                letters={[...groups.sent]}
                icon="✅"
                expandedLetters={expandedLetters}
                toggleLetterExpanded={toggleLetterExpanded}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
                getStatusText={getStatusText}
                formatDeliveryTime={formatDeliveryTime}
                t={t}
              />
            )}
            
            {groups.send_failed.length > 0 && (
              <LetterGroup
                title={t('lettersModal.deliveryFailed')}
                letters={[...groups.send_failed]}
                icon="⚠️"
                expandedLetters={expandedLetters}
                toggleLetterExpanded={toggleLetterExpanded}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
                getStatusText={getStatusText}
                formatDeliveryTime={formatDeliveryTime}
                t={t}
              />
            )}
            
            {snapshot?.letters.length === 0 && (
              <div className="empty-state">
                {t('lettersModal.noLettersFound')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface LetterGroupProps {
  title: string;
  letters: LetterStatusInfo[];
  icon: string;
  expandedLetters: Set<string>;
  toggleLetterExpanded: (letterId: string) => void;
  getStatusIcon: (status: string) => string;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
  formatDeliveryTime: (letter: LetterStatusInfo) => string;
  t: any;
}

function LetterGroup({
  title,
  letters,
  icon,
  expandedLetters,
  toggleLetterExpanded,
  getStatusIcon,
  getStatusColor,
  getStatusText,
  formatDeliveryTime,
  t
}: LetterGroupProps) {
  return (
    <div className="letter-group">
      <div className="group-header">
        <span className="group-icon">{icon}</span>
        <span className="group-title">{title}</span>
        <span className="group-count">{letters.length}</span>
      </div>
      
      <div className="group-content">
        {letters.map(letter => (
          <LetterItem
            key={letter.letterId}
            letter={letter}
            isExpanded={expandedLetters.has(letter.letterId)}
            onToggle={() => toggleLetterExpanded(letter.letterId)}
            getStatusIcon={getStatusIcon}
            getStatusColor={getStatusColor}
            getStatusText={getStatusText}
            formatDeliveryTime={formatDeliveryTime}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

interface LetterItemProps {
  letter: LetterStatusInfo;
  isExpanded: boolean;
  onToggle: () => void;
  getStatusIcon: (status: string) => string;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
  formatDeliveryTime: (letter: LetterStatusInfo) => string;
  t: any;
}

function LetterItem({
  letter,
  isExpanded,
  onToggle,
  getStatusIcon,
  getStatusColor,
  getStatusText,
  formatDeliveryTime,
  t
}: LetterItemProps) {
  return (
    <div className="letter-item">
      <div className="letter-header" onClick={onToggle}>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        <span className="letter-id">{letter.letterId}</span>
        {letter.characterName && (
          <span className="character-name">{letter.characterName}</span>
        )}
        <div className="status-badges">
          <div 
            className="status-badge"
            style={{ color: getStatusColor(letter.responseStatus) }}
          >
            {getStatusIcon(letter.responseStatus)} {getStatusText(letter.responseStatus)}
          </div>
          <div 
            className="status-badge"
            style={{ color: getStatusColor(letter.summaryStatus) }}
          >
            {getStatusIcon(letter.summaryStatus)} {getStatusText(letter.summaryStatus)}
          </div>
        </div>
        <div className="delivery-info">
          {formatDeliveryTime(letter)}
        </div>
      </div>
      
      {isExpanded && (
        <div className="letter-details">
          {/* Response Section */}
          <section>
            <h5>{t('lettersModal.responseStatus')}</h5>
            <div className="status-detail">
              <strong>{t('lettersModal.status')}:</strong> 
              <span style={{ color: getStatusColor(letter.responseStatus), marginLeft: '8px' }}>
                {getStatusIcon(letter.responseStatus)} {getStatusText(letter.responseStatus)}
              </span>
            </div>
            {letter.responseError && (
              <div className="error-message">
                <strong>{t('lettersModal.error')}:</strong> {letter.responseError}
              </div>
            )}
            {letter.responseContent && (
              <div className="content-preview">
                <h6>{t('lettersModal.responseContent')}:</h6>
                <pre>{letter.responseContent}</pre>
              </div>
            )}
          </section>
          
          {/* Summary Section */}
          <section>
            <h5>{t('lettersModal.summaryStatus')}</h5>
            <div className="status-detail">
              <strong>{t('lettersModal.status')}:</strong>
              <span style={{ color: getStatusColor(letter.summaryStatus), marginLeft: '8px' }}>
                {getStatusIcon(letter.summaryStatus)} {getStatusText(letter.summaryStatus)}
              </span>
            </div>
            {letter.summaryError && (
              <div className="error-message">
                <strong>{t('lettersModal.error')}:</strong> {letter.summaryError}
              </div>
            )}
            {letter.summaryContent && (
              <div className="content-preview">
                <h6>{t('lettersModal.summaryContent')}:</h6>
                <pre>{letter.summaryContent}</pre>
              </div>
            )}
          </section>
          
          {/* Original Letter */}
          <section>
            <h5>{t('lettersModal.originalLetter')}</h5>
            <div className="content-preview">
              <pre>{letter.letterContent}</pre>
            </div>
          </section>
          
          {/* Metadata */}
          <section>
            <h5>{t('lettersModal.information')}</h5>
            <div className="metadata-grid">
              <div><strong>{t('lettersModal.letterId')}:</strong> {letter.letterId}</div>
              <div><strong>{t('lettersModal.created')}:</strong> {new Date(letter.createdAt).toLocaleString()}</div>
              <div><strong>{t('lettersModal.expectedDeliveryDay')}:</strong> {letter.expectedDeliveryDay}</div>
              <div><strong>{t('lettersModal.currentDay')}:</strong> {letter.currentDay}</div>
              <div><strong>{t('lettersModal.daysUntilDelivery')}:</strong> {letter.daysUntilDelivery}</div>
              <div><strong>{t('lettersModal.isLate')}:</strong> {letter.isLate ? t('lettersModal.yes') : t('lettersModal.no')}</div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}