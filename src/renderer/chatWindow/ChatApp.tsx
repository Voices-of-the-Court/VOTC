import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid'; // For unique IDs
import MarkdownRenderer from './MarkdownRenderer'; // Import Markdown renderer

// Define message structure (can be moved to a types file later)
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean; // For assistant messages being streamed
}

function ChatApp() {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null); // For auto-scrolling

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
    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isLoading: true,
    };
    setMessages(prevMessages => [...prevMessages, assistantPlaceholder]);

    const requestId = uuidv4();
    
    // Prepare messages for the API (usually the whole history)
    const apiMessages = [...messages, newUserMessage].map(msg => ({ role: msg.role, content: msg.content }));

    try {
      // Setup listeners before sending the request
      const cleanupChatChunk = window.llmConfigAPI.onChatChunk(({ requestId: resRequestId, chunk }) => {
        console.log('[ChatApp] Received onChatChunk:', { resRequestId, chunk }); // Log entire chunk
        if (chunk?.delta?.content) {
          console.log('[ChatApp] Chunk delta content:', chunk.delta.content);
        } else {
          console.log('[ChatApp] Chunk delta content is null or undefined. Full delta:', chunk?.delta);
        }
        if (resRequestId === requestId) {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId ? { ...msg, content: msg.content + (chunk?.delta?.content || ''), isLoading: true } : msg
            )
          );
        }
      });

      const cleanupChatStreamComplete = window.llmConfigAPI.onChatStreamComplete(({ requestId: resRequestId, finalResponse }) => {
        console.log('[ChatApp] Received onChatStreamComplete:', { resRequestId, finalResponse });
        if (resRequestId === requestId) {
          setMessages(prev =>
            prev.map(msg => {
              if (msg.id === assistantMessageId) {
                // Use finalResponse.content if available and different from current, otherwise keep current content
                const newContent = finalResponse?.content && finalResponse.content !== msg.content 
                                   ? finalResponse.content 
                                   : msg.content;
                return { ...msg, content: newContent, isLoading: false };
              }
              return msg;
            })
          );
          cleanupChatChunk(); // Clean up this listener
          cleanupChatStreamComplete(); // Clean up this listener
          cleanupChatError(); // Clean up error listener
        }
      });

      const cleanupChatError = window.llmConfigAPI.onChatError(({ requestId: resRequestId, error }) => {
        console.error('[ChatApp] Received onChatError:', { resRequestId, error });
        if (resRequestId === requestId) {
          console.error('Chat error:', error);
          setMessages(prev =>
            prev.map(msg => (msg.id === assistantMessageId ? { ...msg, content: `Error: ${error}`, isLoading: false } : msg))
          );
          cleanupChatChunk();
          cleanupChatStreamComplete();
          cleanupChatError();
        }
      });
      
      const response = await window.llmConfigAPI.sendChat({
        messages: apiMessages,
        requestId,
        // params: {}, // Optional: add specific params like temperature if needed
        // forceStream: true, // Optional: override global stream setting
      });

      if (!response.streamStarted && response.data) {
        setMessages(prev =>
          prev.map(msg => (msg.id === assistantMessageId ? { ...msg, content: response.data.content || '', isLoading: false } : msg))
        );
        cleanupChatChunk();
        cleanupChatStreamComplete();
        cleanupChatError();
      } else if (!response.streamStarted && response.error) {
        console.error('Chat send error:', response.error);
        setMessages(prev =>
          prev.map(msg => (msg.id === assistantMessageId ? { ...msg, content: `Error: ${response.error}`, isLoading: false } : msg))
        );
        cleanupChatChunk();
        cleanupChatStreamComplete();
        cleanupChatError();
      }
      // If streamStarted is true, the listeners will handle updates and cleanup.

    } catch (error: any) {
      console.error('Failed to send message:', error);
      setMessages(prev =>
        prev.map(msg => (msg.id === assistantMessageId ? { ...msg, content: `Error: ${error.message || 'Unknown error'}`, isLoading: false } : msg))
      );
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
                    <MarkdownRenderer content={msg.content} />
                    {msg.isLoading && <span className="loading-dots"><span>.</span><span>.</span><span>.</span></span>}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
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
          <button className="leave-button">End Conversation</button>
          <button 
            onClick={() => window.electronAPI.openConfigWindow()} 
            className="config-button"
            title="Open Configuration"
          >
            ⚙️
          </button>
        </div>
      )}
    </div>
  );
}

export default ChatApp;
