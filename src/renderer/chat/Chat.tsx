import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageList, ActionCommandInput, ChatButtons } from './components';
import type { CommandState } from './components/ActionCommandInput';
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
  const [commandState, setCommandState] = useState<CommandState>({
    isActive: false,
    actionId: null,
    actionTitle: '',
    sourceCharacterId: null,
    targetCharacterId: null,
    args: {},
    actionDetails: null,
    readyToExecute: false,
    missingFields: [],
  });

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

  const handleSend = useCallback(() => {
    const message = inputValue;
    setInputValue('');
    // Only send if not a command (commands are handled by ActionCommandInput)
    if (!message.startsWith('/')) {
      sendMessage(message);
    }
  }, [inputValue, sendMessage]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Skip if it's a command - ActionCommandInput handles that
    if (inputValue.startsWith('/')) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !isStreaming) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle command state changes from ActionCommandInput
  const handleCommandStateChange = useCallback((state: CommandState) => {
    setCommandState(state);
  }, []);

  // Handle slash command execution
  const handleExecuteAction = useCallback(async () => {
    if (!commandState.actionId || !commandState.sourceCharacterId) return;
    
    try {
      const result = await window.actionsAPI.execute({
        actionId: commandState.actionId,
        sourceCharacterId: commandState.sourceCharacterId,
        targetCharacterId: commandState.targetCharacterId,
        args: commandState.args,
      });
      
      if (result.success) {
        console.log(`Action ${commandState.actionId} executed successfully:`, result.feedback);
      } else {
        console.error(`Action ${commandState.actionId} failed:`, result.error);
      }
      
      // Clear input after execution
      setInputValue('');
      setCommandState({
        isActive: false,
        actionId: null,
        actionTitle: '',
        sourceCharacterId: null,
        targetCharacterId: null,
        args: {},
        actionDetails: null,
        readyToExecute: false,
        missingFields: [],
      });
    } catch (error) {
      console.error('Failed to execute action:', error);
    }
  }, [commandState]);

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
            <ActionCommandInput
              value={inputValue}
              onChange={setInputValue}
              onKeyPress={handleKeyPress}
              onCommandStateChange={handleCommandStateChange}
              placeholder={t('chat.writeMessage')}
              disabled={isStreaming}
            />
            <ChatButtons
              onLeave={() => handleLeave(resetChat)}
              onToggleConfig={onToggleConfig}
              onCancel={handleCancelStream}
              onPause={handlePauseConversation}
              onResume={handleResumeConversation}
              onExecuteAction={handleExecuteAction}
              isStreaming={isStreaming}
              isPaused={conversationState.isPaused}
              queueLength={conversationState.queueLength}
              commandState={commandState}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
