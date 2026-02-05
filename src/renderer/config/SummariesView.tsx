import React, { useState, useEffect, useRef } from 'react';
import { useConfigStore } from './store/useConfigStore';

const SummariesView: React.FC = () => {
  const appSettings = useConfigStore((state) => state.appSettings);
  const summaryProviderInstanceId = useConfigStore((state) => state.summaryProviderInstanceId);
  const setSummaryProvider = useConfigStore((state) => state.setSummaryProvider);
  const updateSummaryPromptSettings = useConfigStore((state) => state.updateSummaryPromptSettings);
  const getSummaryPromptSettings = useConfigStore((state) => state.getSummaryPromptSettings);
  
  const [localSettings, setLocalSettings] = useState({
    rollingPrompt: '',
    finalPrompt: '',
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  // Load summary prompt settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getSummaryPromptSettings();
        // Backend returns either custom or default prompts
        setLocalSettings({
          rollingPrompt: settings.rollingPrompt,
          finalPrompt: settings.finalPrompt,
        });
      } catch (error) {
        console.error('Failed to load summary prompt settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, [getSummaryPromptSettings]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, []);

  const persist = (next: typeof localSettings, immediate = false) => {
    setLocalSettings(next);
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    
    if (immediate) {
      updateSummaryPromptSettings(next);
      return;
    }
    saveTimer.current = setTimeout(() => {
      updateSummaryPromptSettings(next);
      saveTimer.current = null;
    }, 400);
  };

  const handleProviderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    await setSummaryProvider(value === '' ? null : value);
  };

  const handleResetRolling = async () => {
    const confirm = window.confirm('Reset rolling summary prompt to default? This will replace current text.');
    if (!confirm) return;
    
    // Save empty string to trigger backend to return default
    const resetSettings = { ...localSettings, rollingPrompt: '' };
    await updateSummaryPromptSettings(resetSettings);
    
    // Reload to get the default from backend
    const settings = await getSummaryPromptSettings();
    setLocalSettings({
      rollingPrompt: settings.rollingPrompt,
      finalPrompt: settings.finalPrompt,
    });
  };

  const handleResetFinal = async () => {
    const confirm = window.confirm('Reset final summary prompt to default? This will replace current text.');
    if (!confirm) return;
    
    // Save empty string to trigger backend to return default
    const resetSettings = { ...localSettings, finalPrompt: '' };
    await updateSummaryPromptSettings(resetSettings);
    
    // Reload to get the default from backend
    const settings = await getSummaryPromptSettings();
    setLocalSettings({
      rollingPrompt: settings.rollingPrompt,
      finalPrompt: settings.finalPrompt,
    });
  };

  const handleResetAll = async () => {
    const confirm = window.confirm('Reset all summary prompts to defaults? This will replace all current text.');
    if (!confirm) return;
    
    // Save empty strings to trigger backend to return defaults
    const resetSettings = { rollingPrompt: '', finalPrompt: '' };
    await updateSummaryPromptSettings(resetSettings);
    
    // Reload to get the defaults from backend
    const settings = await getSummaryPromptSettings();
    setLocalSettings({
      rollingPrompt: settings.rollingPrompt,
      finalPrompt: settings.finalPrompt,
    });
  };

  if (!appSettings || isLoading) {
    return <div>Loading summary settings...</div>;
  }

  // Get all available providers (base + presets)
  const allProviders = [
    ...appSettings.llmSettings.providers,
    ...appSettings.llmSettings.presets
  ];

  const activeProvider = appSettings.llmSettings.activeProviderInstanceId;
  const activeProviderName = allProviders.find(p => p.instanceId === activeProvider)?.customName || activeProvider;

  return (
    <div className="prompts-view">
      <div className="header-row">
        <div>
          <h3>Summary Generation Settings</h3>
          <p className="muted-text">Configure how conversation summaries are generated.</p>
        </div>
        <div className="header-actions">
          <button onClick={handleResetAll}>Reset all to defaults</button>
        </div>
      </div>
      
      <div className="form-group">
        <h4>Provider Override</h4>
        <p className="muted-text">
          Choose a specific provider for generating conversation summaries. Leave as "Use Active Provider" to use your currently selected provider.
        </p>
        
        <div className="field-row">
          <label htmlFor="summaryProvider">Summary Provider:</label>
          <select
            id="summaryProvider"
            value={summaryProviderInstanceId || ''}
            onChange={handleProviderChange}
          >
            <option value="">Use Active Provider ({activeProviderName})</option>
            {allProviders.map(provider => (
              <option key={provider.instanceId} value={provider.instanceId}>
                {provider.customName || provider.providerType}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="info-card">
        <h4>About Summary Generation</h4>
        <p className="muted-text">
          Summaries are automatically generated in two scenarios:
        </p>
        <ul>
          <li><strong>Rolling Summaries:</strong> Created during long conversations when the context limit is approaching. These help compress older messages while preserving important information.</li>
          <li><strong>Final Summaries:</strong> Generated when a conversation ends. These comprehensive summaries are saved to character files and used as context in future conversations.</li>
        </ul>
        <p className="muted-text">
          The prompts below show the current active prompts. Changes are automatically saved after you stop typing.
        </p>
      </div>
      <div className="main-prompt-card">
        <div className="card-header">
          <h4>Rolling Summary Prompt</h4>
          <div className="mini-buttons">
            <button onClick={handleResetRolling}>Reset to default</button>
          </div>
        </div>
        <p className="muted-text">
          This prompt is used when the conversation gets too long and needs to be compressed. It creates incremental summaries during the conversation.
        </p>
        <textarea
          value={localSettings.rollingPrompt}
          rows={6}
          onChange={(e) => persist({ ...localSettings, rollingPrompt: e.target.value })}
          style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
        />
      </div>

      <div className="main-prompt-card">
        <div className="card-header">
          <h4>Final Summary Prompt</h4>
          <div className="mini-buttons">
            <button onClick={handleResetFinal}>Reset to default</button>
          </div>
        </div>
        <p className="muted-text">
          This prompt is used at the end of a conversation to create a comprehensive summary that will be saved for future reference.
        </p>
        <textarea
          value={localSettings.finalPrompt}
          rows={8}
          onChange={(e) => persist({ ...localSettings, finalPrompt: e.target.value })}
          style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
        />
      </div>
    </div>
  );
};

export default SummariesView;
