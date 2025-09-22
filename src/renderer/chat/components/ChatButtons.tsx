import React from 'react';

interface ChatButtonsProps {
  onLeave: () => void;
  onNPCInfo: () => void;
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
  onNPCInfo,
  onToggleConfig,
  onCancel,
  onPause,
  onResume,
  isStreaming = false,
  isPaused = false,
  queueLength = 0
}) => {
  const canPause = onPause && !isPaused && isStreaming && queueLength > 1;
  const canResume = onResume && isPaused && !isStreaming;

  return (
    <div className="buttons-container">
      {isStreaming && onCancel && (
        <button
          onClick={onCancel}
          className="cancel-button"
          title="Cancel Stream"
        >
          ❌ Cancel
        </button>
      )}
      {canResume && (
        <button
          onClick={onResume}
          className="resume-button"
          title="Resume Conversation"
        >
          ▶️ Resume
        </button>
      )}
      {canPause && (
        <button
          onClick={onPause}
          className="pause-button"
          title="Pause Conversation"
        >
          ⏸️ Pause
        </button>
      )}
      <button
        className="leave-button"
        onClick={onLeave}
      >
        End Conversation
      </button>
      <button
        onClick={onNPCInfo}
        className="npc-info-button"
        title="Show NPC Info"
      >
        NPC Info
      </button>
      <button
        onClick={onToggleConfig}
        className="config-button"
        title="Open Configuration"
      >
        ⚙️
      </button>
    </div>
  );
};

export default ChatButtons;