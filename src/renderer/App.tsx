import { useState, useCallback, useEffect } from 'react';
import Chat from './chat/Chat';
import ConfigPanel from './config/ConfigPanel';

function App() {
  const [showChat, setShowChat] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    // Listen for VOTC:IN event to show chat
    const cleanupChatEvent = window.electronAPI.onChatReset(() => {
      console.log('Chat reset - showing chat interface');
      setShowChat(true);
    });

    return () => {
      cleanupChatEvent();
    };
  }, []);

  useEffect(() => {
    // Listen for toggle settings event from tray
    const cleanupToggleSettings = window.electronAPI.onToggleSettings(() => {
      console.log('Toggle settings event received');
      setShowConfig(prev => !prev);
    });

    return () => {
      cleanupToggleSettings();
    };
  }, []);

  useEffect(() => {
    // Listen for hide chat event (triggered by End Conversation)
    const cleanupHideChat = window.electronAPI.onHideChat(() => {
      console.log('Hide chat event received - hiding both chat and config');
      setShowChat(false);
      setShowConfig(false);
    });

    return () => {
      cleanupHideChat();
    };
  }, []);

  const toggleConfig = useCallback(() => {
    setShowConfig(prev => !prev);
  }, []);

  return (
    <div className="App">
      {showChat && <Chat onToggleConfig={toggleConfig} />}
      {showConfig && (
        <ConfigPanel
          onClose={() => {
            setShowConfig(false);
            window.electronAPI?.setIgnoreMouseEvents(true);
          }}
        />
      )}
    </div>
  );
};

export default App;
