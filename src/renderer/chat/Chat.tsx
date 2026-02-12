import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageList, ChatInput, ChatButtons } from './components';
import { useWindowEvents, useAutoScroll, useConversationEntries } from './hooks';
import { useDraggableResizable } from '../hooks/useDraggableResizable';

interface ChatProps {
  onToggleConfig: () => void;
}

function Chat({ onToggleConfig }: ChatProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [conversationState, setConversationState] = useState({ isPaused: false, queueLength: 0 });

  const { entries, sendMessage } = useConversationEntries();
  const { handleChatBoxMouseEnter, handleChatBoxMouseLeave, handleLeave } = useWindowEvents();
  const { messagesEndRef, containerRef, scrollToBottom, handleScroll } = useAutoScroll();
  
  const {
    position,
    size,
    isDragging,
    isResizing,
    handleDragStart,
    handleResizeStart,
  } = useDraggableResizable({
    initialPosition: { x: 30, y: 30 },
    initialSize: { width: Math.min(window.innerWidth * 0.5, 800), height: window.innerHeight - 60 },
    minWidth: 400,
    minHeight: 300,
    storageKey: 'chat-panel-state',
  });

  const isStreaming = entries.some(entry => entry.type === 'message' && entry.isStreaming);

  useEffect(() => {
    scrollToBottom();
  }, [entries, scrollToBottom]);

  // Fetch conversation state on mount and when entries change
  useEffect(() => {
    const fetchState = async () => {
      try {
        const state = await window.conversationAPI.getConversationState();
        setConversationState(state);
      } catch (error) {
        console.error('Failed to fetch conversation state:', error);
      }
    };
    fetchState();
  }, [entries]);


  const resetChat = () => {
    setInputValue('');
  };

  const toggleMinimize = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);
    if (newState) {
      window.electronAPI?.setIgnoreMouseEvents(true);
    }
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

  const handleCancelStream = async () => {
    try {
      await window.conversationAPI.cancelStream();
    } catch (error) {
      console.error('Failed to cancel stream:', error);
    }
  };

  const handlePauseConversation = async () => {
    try {
      await window.conversationAPI.pauseConversation();
      // State will be updated via onConversationUpdate
    } catch (error) {
      console.error('Failed to pause conversation:', error);
    }
  };

  const handleResumeConversation = async () => {
    try {
      await window.conversationAPI.resumeConversation();
      // State will be updated via onConversationUpdate
    } catch (error) {
      console.error('Failed to resume conversation:', error);
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
        style={{
          pointerEvents: 'auto',
        }}
      >
        {isMinimized ? '+' : '-'}
      </button>
      {!isMinimized && (
        <div
          onMouseEnter={handleChatBoxMouseEnter}
          onMouseLeave={handleChatBoxMouseLeave}
          className="chat-box"
          style={{
            pointerEvents: 'auto',
            position: 'absolute',
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
            cursor: isDragging ? 'grabbing' : isResizing ? 'nwse-resize' : 'default',
          }}
        >
          {/* Drag handle */}
          <div
            className="panel-drag-handle"
            onMouseDown={handleDragStart}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '30px',
              cursor: 'grab',
              zIndex: 10,
            }}
          />
          
          {/* Resize handles */}
          <div
            className="resize-handle resize-e"
            onMouseDown={(e) => handleResizeStart(e, 'e')}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '8px',
              cursor: 'ew-resize',
              zIndex: 10,
            }}
          />
          <div
            className="resize-handle resize-s"
            onMouseDown={(e) => handleResizeStart(e, 's')}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '8px',
              cursor: 'ns-resize',
              zIndex: 10,
            }}
          />
          <div
            className="resize-handle resize-se"
            onMouseDown={(e) => handleResizeStart(e, 'se')}
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: '16px',
              height: '16px',
              cursor: 'nwse-resize',
              zIndex: 11,
            }}
          />
          <div
            className="resize-handle resize-w"
            onMouseDown={(e) => handleResizeStart(e, 'w')}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '8px',
              cursor: 'ew-resize',
              zIndex: 10,
            }}
          />
          <div
            className="resize-handle resize-n"
            onMouseDown={(e) => handleResizeStart(e, 'n')}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '8px',
              cursor: 'ns-resize',
              zIndex: 10,
            }}
          />
          <div
            className="resize-handle resize-nw"
            onMouseDown={(e) => handleResizeStart(e, 'nw')}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '16px',
              height: '16px',
              cursor: 'nwse-resize',
              zIndex: 11,
            }}
          />
          <div
            className="resize-handle resize-ne"
            onMouseDown={(e) => handleResizeStart(e, 'ne')}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: '16px',
              height: '16px',
              cursor: 'nesw-resize',
              zIndex: 11,
            }}
          />
          <div
            className="resize-handle resize-sw"
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              width: '16px',
              height: '16px',
              cursor: 'nesw-resize',
              zIndex: 11,
            }}
          />
        <MessageList 
          entries={entries} 
          scrollRef={messagesEndRef}
          containerRef={containerRef}
          onScroll={handleScroll}
        />
          <div className="chat-controls-container">
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onKeyPress={handleKeyPress}
              placeholder={t('chat.writeMessage')}
              disabled={isStreaming}
            />
            <ChatButtons
              onLeave={() => handleLeave(resetChat)}
              onToggleConfig={onToggleConfig}
              onCancel={handleCancelStream}
              onPause={handlePauseConversation}
              onResume={handleResumeConversation}
              isStreaming={isStreaming}
              isPaused={conversationState.isPaused}
              queueLength={conversationState.queueLength}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
