import React from 'react';

interface ChatButtonsProps {
  onLeave: () => void;
  onNPCInfo: () => void;
  onToggleConfig: () => void;
}

const ChatButtons: React.FC<ChatButtonsProps> = ({
  onLeave,
  onNPCInfo,
  onToggleConfig
}) => {
  return (
    <div className="buttons-container">
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