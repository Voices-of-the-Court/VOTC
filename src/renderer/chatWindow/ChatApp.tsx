import React, { useState } from 'react';

function ChatApp() {
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false); // State for minimize/restore

  // Handler for the main chat box area
  const handleChatBoxMouseEnter = () => {
    // Make the window interactable when mouse is over the component
    window.electronAPI?.setIgnoreMouseEvents(false);
  };

  // Handler for the main chat box area
  const handleChatBoxMouseLeave = () => {
    // Make the window click-through again when mouse leaves
    window.electronAPI?.setIgnoreMouseEvents(true);
  };

  const toggleMinimize = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);
    // Ensure window is click-through when minimized, interactable when restored
    window.electronAPI?.setIgnoreMouseEvents(false);
  };

  return (
    <div style={{ pointerEvents: 'none', height: '100%', width: '100%' }}> {/* Make parent div non-interactive */}
      <button
        className="minimize-button"
        onClick={toggleMinimize}
        onMouseEnter={handleChatBoxMouseEnter}
        onMouseLeave={handleChatBoxMouseLeave}
        style={{ pointerEvents: 'auto' }} // Ensure button is always interactable
      >
        {isMinimized ? '+' : '-'} {/* Change text based on state */}
      </button>

      {!isMinimized && (
        /* This is the interactable component - only shown when not minimized */
        <div
          onMouseEnter={handleChatBoxMouseEnter}
          onMouseLeave={handleChatBoxMouseLeave}
          className="chat-box"
          style={{
            pointerEvents: 'auto', // Allow interaction with this specific div
          }}
        >
          <div className="messages-container">
            <div className="messages">
            </div>
          </div>
          <textarea
            className="chat-input"
            placeholder="Write a message..."
            rows={4}
            cols={20}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          ></textarea>
          <button className="leave-button">End conversation</button>
        </div>
      )}
    </div>
  );
}

export default ChatApp;
