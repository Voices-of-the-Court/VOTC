import { useState, useEffect } from 'react';
import { useConfigStore } from './store/useConfigStore';
import './configPanel.scss';
import ConnectionView from './ConnectionView';
import SettingsView from './SettingsView';
import ActionsView from './ActionsView';
import PromptsView from './PromptsView';
import discordIcon from '../assets/discord-icon.svg';
import tooltipIcon from '../assets/tooltip2.png';
import logsIcon from '../assets/folder.svg';

type CurrentTab = 'connection' | 'settings' | 'actions' | 'prompts';

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

  const handleDiscordClick = async () => {
    try {
      await window.electronAPI?.openExternal('https://discord.gg/ESYt5cvrKs');
    } catch (error) {
      console.error('Failed to open Discord link:', error);
    }
  };

  const handleBugReportClick = async () => {
    try {
      const result = await window.electronAPI?.collectAndOpenLogs();
      if (result?.success) {
        console.log('Logs collected and folder opened:', result.path);
      } else {
        console.error('Failed to collect logs:', result?.error);
      }
    } catch (error) {
      console.error('Failed to collect logs:', error);
    }
  };

  return (
    <div
      className="config-panel-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ pointerEvents: 'auto' }}
    >
      <header className="config-header">
        <div className="discord-container">
          <button className="tooltip-button" title="Help section">
            <img src={tooltipIcon} alt="?" className="tooltip-icon" />
          </button>
          <button 
            className="discord-button visible" 
            onClick={handleDiscordClick} 
            title="Join our Discord"
          >
            <img src={discordIcon} alt="Discord" className="discord-icon" />
          </button>
          <button 
            className="discord-button visible" 
            onClick={handleBugReportClick} 
            title="Collect all logs for bug report"
          >
            <img src={logsIcon} alt="?" className="discord-icon" />
          </button>
        </div>
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
        <button
          onClick={() => setCurrentTab('actions')}
          className={currentTab === 'actions' ? 'active' : ''}
          title="Manage detected Actions"
        >
          Actions
        </button>
        <button
          onClick={() => setCurrentTab('prompts')}
          className={currentTab === 'prompts' ? 'active' : ''}
        >
          Prompts
        </button>
        <button className="config-close-button" onClick={onClose}>✕</button>
      </header>
      <main className="config-main-content">
        {currentTab === 'connection' && <ConnectionView />}
        {currentTab === 'settings' && <SettingsView />}
        {currentTab === 'actions' && <ActionsView />}
        {currentTab === 'prompts' && <PromptsView />}
      </main>
    </div>
  );
}

export default ConfigPanel;
