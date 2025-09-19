import React from 'react';

interface ChatButtonsProps {
  onLeave: () => void;
  onNPCInfo: () => void;
  onToggleConfig: () => void;
  onCancel?: () => void;
  isStreaming?: boolean;
}

const ChatButtons: React.FC<ChatButtonsProps> = ({
  onLeave,
  onNPCInfo,
  onToggleConfig,
  onCancel,
  isStreaming = false
}) => {
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