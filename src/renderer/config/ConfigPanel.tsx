import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from './store/useConfigStore';
import './configPanel.scss';
import ConnectionView from './ConnectionView';
import SettingsView from './SettingsView';
import ActionsView from './ActionsView';
import PromptsView from './PromptsView';
import SummariesView from './SummariesView';
import discordIcon from '../assets/discord-icon.svg';
import tooltipIcon from '../assets/tooltip2.png';
import logsIcon from '../assets/folder.svg';
import { useDraggableResizable } from '../hooks/useDraggableResizable';
import LanguageSelector from '../components/LanguageSelector';

type CurrentTab = 'connection' | 'settings' | 'actions' | 'prompts' | 'summaries';

interface ConfigPanelProps {
  onClose: () => void;
}

function ConfigPanel({ onClose }: ConfigPanelProps) {
  const { t } = useTranslation();
  const loadSettings = useConfigStore((state) => state.loadSettings);
  const appSettings = useConfigStore((state) => state.appSettings);
  const [currentTab, setCurrentTab] = useState<CurrentTab>('connection');
  const [appVersion, setAppVersion] = useState<string>('');

  const {
    position,
    size,
    isDragging,
    isResizing,
    handleDragStart,
    handleResizeStart,
  } = useDraggableResizable({
    initialPosition: { x: window.innerWidth - 30 - Math.min(window.innerWidth * 0.4, 700), y: 30 },
    initialSize: { width: Math.min(window.innerWidth * 0.4, 700), height: window.innerHeight - 60 },
    minWidth: 400,
    minHeight: 400,
    storageKey: 'config-panel-state',
  });

  useEffect(() => {
    loadSettings();
    
    // Load app version
    const loadAppVersion = async () => {
      try {
        const version = await window.electronAPI.getAppVersion();
        setAppVersion(version);
      } catch (error) {
        console.error('Failed to get app version:', error);
      }
    };
    
    loadAppVersion();
  }, [loadSettings]);

  if (!appSettings) {
    return <div>{t('settings.loadingSettings')}</div>;
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
          height: '40px',
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
      
      <header className="config-header">
        <div className="discord-container" style={{ zIndex: 12 }}>
          <button className="tooltip-button" title={t('config.help')}>
            <img src={tooltipIcon} alt="?" className="tooltip-icon" />
          </button>
          <LanguageSelector />
          <button 
            className="discord-button visible" 
            onClick={handleDiscordClick} 
            title={t('config.joinDiscord')}
          >
            <img src={discordIcon} alt="Discord" className="discord-icon" />
          </button>
          <button 
            className="discord-button visible" 
            onClick={handleBugReportClick} 
            title={t('config.collectLogs')}
          >
            <img src={logsIcon} alt="?" className="discord-icon" />
          </button>
        </div>
        <button
          onClick={() => setCurrentTab('connection')}
          className={currentTab === 'connection' ? 'active' : ''}
          style={{ zIndex: 12 }}
        >
          {t('config.connection')}
        </button>
        <button
          onClick={() => setCurrentTab('settings')}
          className={currentTab === 'settings' ? 'active' : ''}
          style={{ zIndex: 12 }}
        >
          {t('config.settings')}
        </button>
        <button
          onClick={() => setCurrentTab('actions')}
          className={currentTab === 'actions' ? 'active' : ''}
          title={t('config.manageActions')}
          style={{ zIndex: 12 }}
        >
          {t('config.actions')}
        </button>
        <button
          onClick={() => setCurrentTab('prompts')}
          className={currentTab === 'prompts' ? 'active' : ''}
          style={{ zIndex: 12 }}
        >
          {t('config.prompts')}
        </button>
        <button
          onClick={() => setCurrentTab('summaries')}
          className={currentTab === 'summaries' ? 'active' : ''}
          style={{ zIndex: 12 }}
        >
          {t('config.summaries')}
        </button>
        <button className="config-close-button" onClick={onClose}>✕</button>
      </header>
      <main className="config-main-content">
        {currentTab === 'connection' && <ConnectionView />}
        {currentTab === 'settings' && <SettingsView />}
        {currentTab === 'actions' && <ActionsView />}
        {currentTab === 'prompts' && <PromptsView />}
        {currentTab === 'summaries' && <SummariesView />}
      </main>
      
      <div className="app-version">
        v{appVersion}
      </div>
    </div>
  );
}

export default ConfigPanel;
