import { useState, useEffect } from 'react';
import type { AppSettings, ProviderType as ConfigProviderType } from '@llmTypes'; // Adjusted path
import './configPanel.scss'; // Import local styles
import ConnectionView from './ConnectionView'; // Adjusted path
import SettingsView from './SettingsView';   // Adjusted path

type CurrentTab = 'connection' | 'settings';

interface ConfigPanelProps {
  onClose: () => void; // Add close callback prop
}

function ConfigPanel({ onClose }: ConfigPanelProps) {
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [currentTab, setCurrentTab] = useState<CurrentTab>('connection');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.llmConfigAPI.getAppSettings().then(settings => {
        setAppSettings(settings);
    });
    }
    catch (error) {
      console.error('Error fetching app settings:', error);
      setError(`Error fetching app settings: ${error}`);
    }
  }, []);


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
        {currentTab === 'connection' && <ConnectionView appSettings={appSettings} setAppSettings={setAppSettings} />}
        {currentTab === 'settings' && <SettingsView appSettings={appSettings} setAppSettings={setAppSettings} />}
      </main>
    </div>
  );
}

export default ConfigPanel;