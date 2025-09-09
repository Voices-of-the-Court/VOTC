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

  useEffect(() => {
    window.llmConfigAPI.getAppSettings().then(settings => {
      let currentLLMSettings = settings.llmSettings;
      let appSettingsToStore = { ...settings };
      let settingsChangedInInit = false;

      // Ensure base provider configurations exist
      const providerTypes: ConfigProviderType[] = ['openrouter', 'ollama', 'openai-compatible'];
      let baseProviders = [...(currentLLMSettings.providers || [])];
      providerTypes.forEach(type => {
        if (!baseProviders.some(p => p.instanceId === type)) {
          baseProviders.push({
            instanceId: type,
            providerType: type,
            // customName: type.charAt(0).toUpperCase() + type.slice(1), // No customName for base
            apiKey: '',
            baseUrl: type === 'ollama' ? 'http://localhost:11434' : '',
            defaultModel: '',
            defaultParameters: { temperature: 0.7, max_tokens: 2048 },
          });
          settingsChangedInInit = true;
        }
      });

      currentLLMSettings.providers = baseProviders;
      if (!currentLLMSettings.presets) {
        currentLLMSettings.presets = [];
        settingsChangedInInit = true;
      }
      appSettingsToStore.llmSettings = currentLLMSettings;

      if (appSettingsToStore.globalStreamEnabled === undefined) {
        appSettingsToStore.globalStreamEnabled = true;
        settingsChangedInInit = true;
      }
      if (appSettingsToStore.ck3UserFolderPath === undefined) {
        appSettingsToStore.ck3UserFolderPath = null;
          settingsChangedInInit = true;
      }

      setAppSettings(appSettingsToStore);

      // If settings were modified during init, save them back
      // This requires LLMManager to be able to save the whole AppSettings or LLMSettings
      if (settingsChangedInInit) {
        // For now, save each base provider config if it was newly added.
        // A more robust saveAppSettings IPC call would be better.
        providerTypes.forEach(type => {
            const newBaseConfig = appSettingsToStore.llmSettings.providers.find(p => p.instanceId === type);
            if (newBaseConfig && !settings.llmSettings.providers.some(op => op.instanceId === type)) {
                  window.llmConfigAPI.saveProviderConfig(newBaseConfig);
            }
        });
        // Also persist globalStreamEnabled and ck3UserFolderPath if they were initialized
        // This needs dedicated IPC calls or a saveAppSettings call.
        // window.llmConfigAPI.saveGlobalStreamSetting(appSettingsToStore.globalStreamEnabled);
        // window.llmConfigAPI.setCK3Folder(appSettingsToStore.ck3UserFolderPath);
      }
    });
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