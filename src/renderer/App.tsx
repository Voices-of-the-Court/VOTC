import { useState, useCallback, useEffect } from 'react';
import Chat from './chat/Chat';
import ConfigPanel from './config/ConfigPanel';
import { useConfigStore, useAppSettings } from './config/store/useConfigStore';

function App() {
  const [showChat, setShowChat] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true); 
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
    // Show settings panel on frontend initialization if the setting is enabled
    // Only run this once when appSettings are first loaded
    if (appSettings && appSettings.showSettingsOnStartup !== false && !showConfig) {
      setShowConfig(true);
    }
  }, [appSettings]); // Only depend on appSettings, not showConfig

  useEffect(() => {
    // Listen for VOTC:IN event to show chat
    const cleanupChatEvent = window.electronAPI.onChatReset(() => {
      console.log('Chat reset - showing chat interface');
      setShowChat(true);
      // When showing chat, reset mouse events to be ignored initially
      // They will be unignored when mouse enters the chat panel
      window.electronAPI?.setIgnoreMouseEvents(true);
    });

    return () => {
      cleanupChatEvent();
    };
  }, []);

  useEffect(() => {
    // Listen for toggle settings event from tray
    const cleanupToggleSettings = window.electronAPI.onToggleSettings(() => {
      console.log('Toggle settings event received');
      setShowConfig(prev => {
        const newState = !prev;
        // When closing the config panel, reset mouse events to be ignored
        if (!newState) {
          window.electronAPI?.setIgnoreMouseEvents(true);
        }
        return newState;
      });
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
      // Reset mouse events when hiding panels
      window.electronAPI?.setIgnoreMouseEvents(true);
    });

    return () => {
      cleanupHideChat();
    };
  }, []);

    useEffect(() => {
    const cleanup = window.electronAPI?.onOverlayVisibilityChange((isVisible: boolean) => {
      console.log('Overlay visibility changed:', isVisible);
      setIsOverlayVisible(isVisible);
      
      // Safety: If hidden, force "ignore mouse" to ensure click-through
      // (The display:none below stops mouse events, but this is a good backup)
      if (!isVisible) {
        window.electronAPI?.setIgnoreMouseEvents(true);
      }
    });
    return cleanup;
  }, []);

  const toggleConfig = useCallback(() => {
    setShowConfig(prev => {
      const newState = !prev;
      // When closing the config panel, only reset mouse events if chat is also hidden
      if (!newState && !showChat) {
        window.electronAPI?.setIgnoreMouseEvents(true);
      }
      return newState;
    });
  }, [showChat]);

  return (
    <div className="App" style={{ display: isOverlayVisible ? 'block' : 'none' }}>
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
