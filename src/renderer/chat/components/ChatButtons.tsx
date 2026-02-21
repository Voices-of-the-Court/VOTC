import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CommandState } from './ActionCommandInput';

interface ChatButtonsProps {
  onLeave: () => void;
  onToggleConfig: () => void;
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onExecuteAction?: () => void;
  isStreaming?: boolean;
  isPaused?: boolean;
  queueLength?: number;
  commandState?: CommandState;
}

const ChatButtons: React.FC<ChatButtonsProps> = ({
  onLeave,
  onToggleConfig,
  onCancel,
  onPause,
  onResume,
  onExecuteAction,
  isStreaming = false,
  isPaused = false,
  queueLength = 0,
  commandState
}) => {
  const { t } = useTranslation();
  const canPause = onPause && !isPaused && isStreaming && queueLength > 1;
  const canResume = onResume && isPaused && !isStreaming;

  // Build tooltip for execute button
  const getExecuteTooltip = () => {
    if (!commandState?.isActive) return null;
    if (commandState.readyToExecute) {
      return `Execute: ${commandState.actionTitle}`;
    }
    return `Missing: ${commandState.missingFields.join(', ')}`;
  };

  return (
    <div className="buttons-container">
      {isStreaming && onCancel && (
        <button
          onClick={onCancel}
          className="cancel-button"
          title={t('chat.cancelStream')}
        >
          ❌ {t('common.cancel')}
        </button>
      )}
      {canResume && (
        <button
          onClick={onResume}
          className="resume-button"
          title={t('chat.resumeConversation')}
        >
          ▶️ {t('common.yes')}
        </button>
      )}
      {canPause && (
        <button
          onClick={onPause}
          className="pause-button"
          title={t('chat.pauseConversation')}
        >
          ⏸️ {t('common.pause')}
        </button>
      )}
      <button
        className="leave-button"
        onClick={onLeave}
      >
        {t('chat.endConversation')}
      </button>
      <button
        onClick={onToggleConfig}
        className="config-button"
        title={t('config.settings')}
      >
        ⚙️
      </button>
      {commandState?.isActive && onExecuteAction && (
        <button
          onClick={onExecuteAction}
          className={`execute-button ${commandState.readyToExecute ? 'ready' : 'incomplete'}`}
          disabled={!commandState.readyToExecute}
          title={getExecuteTooltip() || ''}
        >
          ▶️
        </button>
      )}
    </div>
  );
};

export default ChatButtons;