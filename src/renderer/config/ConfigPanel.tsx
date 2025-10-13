import { useState, useEffect } from 'react';
import { useConfigStore } from './store/useConfigStore';
import './configPanel.scss';
import ConnectionView from './ConnectionView';
import SettingsView from './SettingsView';

type CurrentTab = 'connection' | 'settings';

interface ConfigPanelProps {
  onClose: () => void;
}

function ConfigPanel({ onClose }: ConfigPanelProps) {
  const loadSettings = useConfigStore((state) => state.loadSettings);
  const appSettings = useConfigStore((state) => state.appSettings);
  const [currentTab, setCurrentTab] = useState<CurrentTab>('connection');

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (!appSettings) {
    return <div>Loading settings...</div>;
  }

  const handleMouseEnter = () => {
    window.electronAPI?.setIgnoreMouseEvents(false);
  };

  const handleMouseLeave = () => {
    window.electronAPI?.setIgnoreMouseEvents(true);
  };

  return (
    <div
      className="config-panel-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ pointerEvents: 'auto' }}
    >
      <header className="config-header">
        <button className="config-close-button" onClick={onClose}>✕</button>
        <button
          onClick={() => setCurrentTab('connection')}
          className={currentTab === 'connection' ? 'active' : ''}
        >
          Connection
        </button>
        <button
          onClick={() => setCurrentTab('settings')}
          className={currentTab === 'settings' ? 'active' : ''}
        >
          Settings
        </button>
      </header>
      <main className="config-main-content">
        {currentTab === 'connection' && <ConnectionView />}
        {currentTab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}

export default ConfigPanel;
