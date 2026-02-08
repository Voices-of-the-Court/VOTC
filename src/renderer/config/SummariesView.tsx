import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from './store/useConfigStore';
import SummariesManager from './components/SummariesManager';

const SummariesView: React.FC = () => {
  const { t } = useTranslation();
  const appSettings = useConfigStore((state) => state.appSettings);
  const summaryProviderInstanceId = useConfigStore((state) => state.summaryProviderInstanceId);
  const setSummaryProvider = useConfigStore((state) => state.setSummaryProvider);
  const updateSummaryPromptSettings = useConfigStore((state) => state.updateSummaryPromptSettings);
  const getSummaryPromptSettings = useConfigStore((state) => state.getSummaryPromptSettings);
  const importLegacySummaries = useConfigStore((state) => state.importLegacySummaries);
  const openSummariesFolder = useConfigStore((state) => state.openSummariesFolder);
  const clearSummaries = useConfigStore((state) => state.clearSummaries);
  
  const [localSettings, setLocalSettings] = useState({
    rollingPrompt: '',
    finalPrompt: '',
    letterSummaryPrompt: '',
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  
  // State for legacy import
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{success: boolean, message: string, filesCopied?: number, errors?: string[]} | null>(null);
  
  // State for clear summaries
  const [isClearing, setIsClearing] = useState(false);
  const [clearResult, setClearResult] = useState<{success: boolean, message: string} | null>(null);

  // Load summary prompt settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getSummaryPromptSettings();
        // Backend returns either custom or default prompts
        setLocalSettings({
          rollingPrompt: settings.rollingPrompt,
          finalPrompt: settings.finalPrompt,
          letterSummaryPrompt: settings.letterSummaryPrompt,
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
    const confirm = window.confirm(t('summaries.resetRollingPrompt'));
    if (!confirm) return;
    
    // Save empty string to trigger backend to return default
    const resetSettings = { ...localSettings, rollingPrompt: '' };
    await updateSummaryPromptSettings(resetSettings);
    
    // Reload to get the default from backend
    const settings = await getSummaryPromptSettings();
    setLocalSettings({
      rollingPrompt: settings.rollingPrompt,
      finalPrompt: settings.finalPrompt,
      letterSummaryPrompt: settings.letterSummaryPrompt,
    });
  };

  const handleResetFinal = async () => {
    const confirm = window.confirm(t('summaries.resetFinalPrompt'));
    if (!confirm) return;
    
    // Save empty string to trigger backend to return default
    const resetSettings = { ...localSettings, finalPrompt: '' };
    await updateSummaryPromptSettings(resetSettings);
    
    // Reload to get the default from backend
    const settings = await getSummaryPromptSettings();
    setLocalSettings({
      rollingPrompt: settings.rollingPrompt,
      finalPrompt: settings.finalPrompt,
      letterSummaryPrompt: settings.letterSummaryPrompt,
    });
  };

  const handleResetLetterSummary = async () => {
    const confirm = window.confirm(t('summaries.resetLetterSummaryPrompt'));
    if (!confirm) return;
    
    // Save empty string to trigger backend to return default
    const resetSettings = { ...localSettings, letterSummaryPrompt: '' };
    await updateSummaryPromptSettings(resetSettings);
    
    // Reload to get the default from backend
    const settings = await getSummaryPromptSettings();
    setLocalSettings({
      rollingPrompt: settings.rollingPrompt,
      finalPrompt: settings.finalPrompt,
      letterSummaryPrompt: settings.letterSummaryPrompt,
    });
  };

  const handleResetAll = async () => {
    const confirm = window.confirm(t('summaries.resetAllPrompts'));
    if (!confirm) return;
    
    // Save empty strings to trigger backend to return defaults
    const resetSettings = { rollingPrompt: '', finalPrompt: '', letterSummaryPrompt: '' };
    await updateSummaryPromptSettings(resetSettings);
    
    // Reload to get the defaults from backend
    const settings = await getSummaryPromptSettings();
    setLocalSettings({
      rollingPrompt: settings.rollingPrompt,
      finalPrompt: settings.finalPrompt,
      letterSummaryPrompt: settings.letterSummaryPrompt,
    });
  };

  const handleImportLegacySummaries = async () => {
    setIsImporting(true);
    setImportResult(null);
    
    try {
      const result = await importLegacySummaries();
      setImportResult(result);
    } catch (error) {
      setImportResult({
        success: false,
        message: t('summaries.importFailed', { error: error instanceof Error ? error.message : 'Unknown error' }),
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleOpenSummariesFolder = async () => {
    const result = await openSummariesFolder();
    if (!result.success) {
      console.error('Failed to open summaries folder:', result.error);
    }
  };

  const handleClearSummaries = async () => {
    if (!window.confirm(t('summaries.confirmClearSummaries'))) {
      return;
    }
    
    setIsClearing(true);
    setClearResult(null);
    
    try {
      const result = await clearSummaries();
      if (result.success) {
        setClearResult({
          success: true,
          message: t('summaries.clearSuccess'),
        });
      } else {
        setClearResult({
          success: false,
          message: t('summaries.clearFailed', { error: result.error || 'Unknown error' }),
        });
      }
    } catch (error) {
      setClearResult({
        success: false,
        message: t('summaries.clearFailed', { error: error instanceof Error ? error.message : 'Unknown error' }),
      });
    } finally {
      setIsClearing(false);
    }
  };

  if (!appSettings || isLoading) {
    return <div>{t('summaries.loadingSummaries')}</div>;
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
          <h3>{t('summaries.summaryGenerationSettings')}</h3>
          <p className="muted-text">{t('summaries.configureSummaries')}</p>
        </div>
        <div className="header-actions">
          <button onClick={handleResetAll}>{t('summaries.resetAllDefaults')}</button>
        </div>
      </div>
      
      <div className="form-group">
        <h4>{t('summaries.providerOverride')}</h4>
        <p className="muted-text">
          {t('summaries.providerOverrideHelp')}
        </p>
        
        <div className="field-row">
          <label htmlFor="summaryProvider">{t('summaries.summaryProvider')}:</label>
          <select
            id="summaryProvider"
            value={summaryProviderInstanceId || ''}
            onChange={handleProviderChange}
          >
            <option value="">{t('summaries.useActiveProvider')} ({activeProviderName})</option>
            {allProviders.map(provider => (
              <option key={provider.instanceId} value={provider.instanceId}>
                {provider.customName || provider.providerType}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="info-card">
        <h4>{t('summaries.aboutSummaryGeneration')}</h4>
        <p className="muted-text">
          {t('summaries.aboutSummaryGenerationHelp')}
        </p>
        <ul>
          <li><strong>{t('summaries.rollingSummaries')}:</strong> {t('summaries.rollingSummariesHelp')}</li>
          <li><strong>{t('summaries.finalSummaries')}:</strong> {t('summaries.finalSummariesHelp')}</li>
        </ul>
        <p className="muted-text">
          {t('summaries.promptsActiveInfo')}
        </p>
      </div>
      <div className="main-prompt-card">
        <div className="card-header">
          <h4>{t('summaries.rollingSummaryPrompt')}</h4>
          <div className="mini-buttons">
            <button onClick={handleResetRolling}>{t('prompts.resetToDefault')}</button>
          </div>
        </div>
        <p className="muted-text">
          {t('summaries.rollingSummaryPromptHelp')}
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
          <h4>{t('summaries.finalSummaryPrompt')}</h4>
          <div className="mini-buttons">
            <button onClick={handleResetFinal}>{t('prompts.resetToDefault')}</button>
          </div>
        </div>
        <p className="muted-text">
          {t('summaries.finalSummaryPromptHelp')}
        </p>
        <textarea
          value={localSettings.finalPrompt}
          rows={8}
          onChange={(e) => persist({ ...localSettings, finalPrompt: e.target.value })}
          style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
        />
      </div>

      <div className="main-prompt-card">
        <div className="card-header">
          <h4>{t('summaries.letterSummaryPrompt')}</h4>
          <div className="mini-buttons">
            <button onClick={handleResetLetterSummary}>{t('prompts.resetToDefault')}</button>
          </div>
        </div>
        <p className="muted-text">
          {t('summaries.letterSummaryPromptHelp')}
        </p>
        <textarea
          value={localSettings.letterSummaryPrompt}
          rows={6}
          onChange={(e) => persist({ ...localSettings, letterSummaryPrompt: e.target.value })}
          style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
        />
      </div>
      
      <div className="form-group legacy-data-import">
        <h4>{t('summaries.legacyDataImport')}</h4>
        <p className="help-text">
          {t('summaries.legacyDataImportHelp')}
        </p>
        <button
          type="button"
          onClick={handleImportLegacySummaries}
          disabled={isImporting}
        >
          {isImporting ? t('summaries.importing') : t('summaries.importLegacySummaries')}
        </button>
        {importResult && (
          <div className={`import-result ${importResult.success ? 'success' : 'error'}`}>
            {importResult.message}
            {importResult.filesCopied && (
              <div>{t('summaries.filesCopied', { count: importResult.filesCopied })}</div>
            )}
            {importResult.errors && importResult.errors.length > 0 && (
              <div className="error-list">
                <strong>{t('summaries.errors')}:</strong>
                <ul>
                  {importResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="form-group summary-management">
        <h4>{t('summaries.conversationSummaryManagement')}</h4>
        <p className="help-text">
          {t('summaries.conversationSummaryManagementHelp')}
        </p>
        <div className="button-group">
          <button
            type="button"
            onClick={handleOpenSummariesFolder}
          >
            {t('summaries.openSummariesFolder')}
          </button>
          <button
            type="button"
            onClick={handleClearSummaries}
            disabled={isClearing}
            className="danger-button"
          >
            {isClearing ? t('summaries.clearing') : t('summaries.clearAllSummaries')}
          </button>
        </div>
        {clearResult && (
          <div className={`clear-result ${clearResult.success ? 'success' : 'error'}`}>
            {clearResult.message}
          </div>
        )}
      </div>

      {/* Summaries Manager Component */}
      <SummariesManager />
    </div>
  );
};

export default SummariesView;
