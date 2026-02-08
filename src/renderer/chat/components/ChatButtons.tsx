import React from 'react';
import { useTranslation } from 'react-i18next';

interface ChatButtonsProps {
  onLeave: () => void;
  onToggleConfig: () => void;
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  isStreaming?: boolean;
  isPaused?: boolean;
  queueLength?: number;
}

const ChatButtons: React.FC<ChatButtonsProps> = ({
  onLeave,
  onToggleConfig,
  onCancel,
  onPause,
  onResume,
  isStreaming = false,
  isPaused = false,
  queueLength = 0
}) => {
  const { t } = useTranslation();
  const canPause = onPause && !isPaused && isStreaming && queueLength > 1;
  const canResume = onResume && isPaused && !isStreaming;

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
    </div>
  );
};

export default ChatButtons;