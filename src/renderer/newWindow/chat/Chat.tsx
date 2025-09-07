import React, { useState, useEffect } from 'react';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import ChatButtons from './components/ChatButtons';
import useChatStreaming from './hooks/useChatStreaming';
import useWindowEvents from './hooks/useWindowEvents';
import useAutoScroll from './hooks/useAutoScroll';
import { ChatMessage } from './components/MessageItem';

interface ChatProps {
  onToggleConfig: () => void;
}

function Chat({ onToggleConfig }: ChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const { sendMessage } = useChatStreaming();
  const { handleChatBoxMouseEnter, handleChatBoxMouseLeave, handleLeave } = useWindowEvents();
  const { messagesEndRef } = useAutoScroll();

  const resetChat = () => {
    setMessages([]);
    setInputValue('');
  };

  const toggleMinimize = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);
    window.electronAPI?.setIgnoreMouseEvents(false);
  };

  const handleSend = async () => {
    await sendMessage(inputValue, setMessages);
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNPCInfo = async () => {
    const npcInfo = await window.conversationAPI.getNPCInfo();
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
          <MessageList messages={messages} scrollRef={messagesEndRef} />
          <div className="chat-controls-container">
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onKeyPress={handleKeyPress}
              placeholder="Write a message..."
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
