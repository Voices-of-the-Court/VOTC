import { useState, useCallback, useEffect } from 'react';
import Chat from './chat/Chat';
import ConfigPanel from './config/ConfigPanel';
import { useConfigStore, useAppSettings } from './config/store/useConfigStore';

function App() {
  const [showChat, setShowChat] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const loadSettings = useConfigStore((state) => state.loadSettings);
  const appSettings = useAppSettings();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const fontSize = appSettings?.messageFontSize ?? 1.1;
    document.documentElement.style.setProperty('--message-font-size', `${fontSize}rem`);
  }, [appSettings?.messageFontSize]);

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
