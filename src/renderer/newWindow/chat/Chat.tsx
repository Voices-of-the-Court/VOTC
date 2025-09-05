import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatedMarkdown } from 'flowtoken'; // Import AnimatedMarkdown
import { v4 as uuidv4 } from 'uuid'; // For unique IDs
import 'flowtoken/dist/styles.css'; // Import FlowToken styles

interface ChatProps {
  onToggleConfig: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean; // For assistant messages being streamed
}

function Chat({ onToggleConfig }: ChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null); // For auto-scrolling

  const resetChat = () => {
    setMessages([]);
    setInputValue('');
  };
    // Handler for the main chat box area
  const handleChatBoxMouseEnter = () => {
    window.electronAPI?.setIgnoreMouseEvents(false);
  };

  const handleChatBoxMouseLeave = () => {
    window.electronAPI?.setIgnoreMouseEvents(true);
  };

  const toggleMinimize = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);
    window.electronAPI?.setIgnoreMouseEvents(false); // Ensure interactable when changing state
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Listen for reset event from main process
  useEffect(() => {
    const cleanupReset = window.electronAPI.onChatReset(resetChat);
    return () => {
      cleanupReset();
    };
  }, []);

  const handleSend = async () => {
    if (inputValue.trim() === '') return;

    const newUserMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: inputValue.trim(),
    };
    setMessages(prevMessages => [...prevMessages, newUserMessage]);
    setInputValue('');

    const assistantMessageId = uuidv4();
    const requestId = uuidv4(); // Unique ID for this request
    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isLoading: true,
    };
    setMessages(prevMessages => [...prevMessages, assistantPlaceholder]);

    // Set up streaming listeners
    const cleanupChatChunk = window.conversationAPI.onChatChunk(({ requestId: resRequestId, chunk }) => {
      if (resRequestId === requestId) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId ? { ...msg, content: msg.content + (chunk?.delta?.content || ''), isLoading: true } : msg
          )
        );
      }
    });

    const cleanupChatStreamComplete = window.conversationAPI.onChatStreamComplete(({ requestId: resRequestId, finalResponse }) => {
      if (resRequestId === requestId) {
        setMessages(prev =>
          prev.map(msg => {
            if (msg.id === assistantMessageId) {
              return { ...msg, content: msg.content, isLoading: false };
            }
            return msg;
          })
        );
        cleanupChatChunk();
        cleanupChatStreamComplete();
        cleanupChatError();
      }
    });

    const cleanupChatError = window.conversationAPI.onChatError(({ requestId: resRequestId, error }) => {
      if (resRequestId === requestId) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId ? { ...msg, content: `Error: ${error}`, isLoading: false } : msg
          )
        );
        cleanupChatChunk();
        cleanupChatStreamComplete();
        cleanupChatError();
      }
    });

    try {
      // Send message with streaming enabled
      const response = await window.conversationAPI.sendMessage(inputValue.trim(), true, requestId);

      if (!response.streamStarted) {
        // Fallback to non-streaming response
        if (response.message) {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: response.message.content || '', isLoading: false }
                : msg
            )
          );
        } else if (response.error) {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: `Error: ${response.error}`, isLoading: false }
                : msg
            )
          );
        }
        // Clean up listeners since streaming didn't start
        cleanupChatChunk();
        cleanupChatStreamComplete();
        cleanupChatError();
      }
      // If streaming started, the listeners will handle the updates and cleanup

    } catch (error: any) {
      console.error('Failed to send message:', error);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: `Error: ${error.message || 'Unknown error'}`, isLoading: false }
            : msg
        )
      );
      // Clean up all listeners on error
      cleanupChatChunk();
      cleanupChatStreamComplete();
      cleanupChatError();
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
          <div className="messages-container">
            <div className="messages">
              {messages.map(msg => (
                <div key={msg.id} className={`message`}>
                  <div className={`${
                    msg.role === 'user' ? 'player-message' : msg.role === 'assistant' ? 'ai-message' : 'system-message'
                  }`}>
                    <AnimatedMarkdown
                      content={msg.content}
                      animation={msg.isLoading ? "fadeIn" : null}
                      animationDuration="0.5s"
                      animationTimingFunction="ease-in-out"
                      sep="char"
                    />
                    {msg.isLoading && <span className="loading-dots"><span>.</span><span>.</span><span>.</span></span>}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <div className="chat-controls-container">
            <textarea
              className="chat-input"
              placeholder="Write a message..."
              rows={3} // Adjusted rows
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            {/* Consider adding a send button if Enter to send is not always desired */}
            {/* <button onClick={handleSend} className="send-button">Send</button> */}
            <div className="buttons-container">
              <button
                className="leave-button"
                onClick={() => {
                  window.electronAPI.hideWindow();
                  window.electronAPI?.setIgnoreMouseEvents(true);
                  resetChat();
                }}
              >
                End Conversation
              </button>
              <button
                onClick={async () => {
                  const npcInfo = await window.conversationAPI.getNPCInfo();
                  if (npcInfo) {
                    alert(`Current NPC: ${npcInfo.fullName}\n${npcInfo.personality}\nOpinion: ${npcInfo.opinion}/100`);
                  } else {
                    alert('No active conversation');
                  }
                }}
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
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
