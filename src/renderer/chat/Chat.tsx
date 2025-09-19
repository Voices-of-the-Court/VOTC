import React, { useState, useEffect } from 'react';
import { MessageList, ChatInput, ChatButtons } from './components';
import { useWindowEvents, useAutoScroll, useConversationEntries } from './hooks';

interface ChatProps {
  onToggleConfig: () => void;
}

function Chat({ onToggleConfig }: ChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  const { entries, sendMessage } = useConversationEntries();
  const { handleChatBoxMouseEnter, handleChatBoxMouseLeave, handleLeave } = useWindowEvents();
  const { messagesEndRef, scrollToBottom } = useAutoScroll();

  const isStreaming = entries.some(entry => entry.type === 'message' && entry.isStreaming);

  useEffect(() => {
    scrollToBottom();
  }, [entries, scrollToBottom]);


  const resetChat = () => {
    setInputValue('');
  };

  const toggleMinimize = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);
    window.electronAPI?.setIgnoreMouseEvents(false);
  };

  const handleSend = () => {
    const message = inputValue;
    setInputValue('');
    sendMessage(message)
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isStreaming) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNPCInfo = async () => {
    const npcInfo = await window.conversationAPI.getPlayerInfo();
    if (npcInfo) {
      alert(`Current NPC: ${npcInfo.fullName}\n${npcInfo.personality}\nOpinion: ${npcInfo.opinion}/100`);
    } else {
      alert('No active conversation');
    }
  };

  // Listen for reset event from main process
  useEffect(() => {
    const cleanupReset = window.electronAPI.onChatReset(resetChat);
    return () => {
      cleanupReset();
    };
  }, []);

  // Listen for toggle-minimize event from main process (global shortcut)
  useEffect(() => {
    const cleanupToggleMinimize = window.electronAPI.onToggleMinimize(toggleMinimize);
    return () => {
      cleanupToggleMinimize();
    };
  }, [toggleMinimize]);

  return (
    <div style={{ pointerEvents: 'none', height: '100%', width: '100%' }}>
      <button
        className="minimize-button"
        onClick={toggleMinimize}
        onMouseEnter={handleChatBoxMouseEnter}
        onMouseLeave={handleChatBoxMouseLeave}
        style={{ pointerEvents: 'auto' }}
      >
        {isMinimized ? '+' : '-'}
      </button>
      {!isMinimized && (
        <div
          onMouseEnter={handleChatBoxMouseEnter}
          onMouseLeave={handleChatBoxMouseLeave}
          className="chat-box"
          style={{ pointerEvents: 'auto' }}
        >
          <MessageList entries={entries} scrollRef={messagesEndRef} />
          <div className="chat-controls-container">
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onKeyPress={handleKeyPress}
              placeholder="Write a message..."
              disabled={isStreaming}
            />
            <ChatButtons
              onLeave={() => handleLeave(resetChat)}
              onNPCInfo={handleNPCInfo}
              onToggleConfig={onToggleConfig}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
