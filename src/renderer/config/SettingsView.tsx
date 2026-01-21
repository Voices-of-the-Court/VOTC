import React, { ChangeEvent } from 'react';
import { useConfigStore, useAppSettings } from './store/useConfigStore';

const SettingsView: React.FC = () => {
  const appSettings = useAppSettings();
  const updateGlobalStreamSetting = useConfigStore((state) => state.updateGlobalStreamSetting);
  const updatePauseOnRegeneration = useConfigStore((state) => state.updatePauseOnRegeneration);
  const updateGenerateFollowingMessages = useConfigStore((state) => state.updateGenerateFollowingMessages);
  const updateMessageFontSize = useConfigStore((state) => state.updateMessageFontSize);
  const selectCK3Folder = useConfigStore((state) => state.selectCK3Folder);
  const importLegacySummaries = useConfigStore((state) => state.importLegacySummaries);

  if (!appSettings) {
    return <div>Loading global settings...</div>;
  }

  const handleGlobalStreamToggle = async (e: ChangeEvent<HTMLInputElement>) => {
    await updateGlobalStreamSetting(e.target.checked);
  };

  const handlePauseOnRegenerationToggle = async (e: ChangeEvent<HTMLInputElement>) => {
    await updatePauseOnRegeneration(e.target.checked);
  };

  const handleGenerateFollowingMessagesToggle = async (e: ChangeEvent<HTMLInputElement>) => {
    await updateGenerateFollowingMessages(e.target.checked);
  };

  const handleMessageFontSizeChange = async (e: ChangeEvent<HTMLInputElement>) => {
    await updateMessageFontSize(parseFloat(e.target.value));
  };

  const handleSelectCK3Folder = async () => {
    await selectCK3Folder();
  };

  const [isImporting, setIsImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<{success: boolean, message: string, filesCopied?: number, errors?: string[]} | null>(null);

  const handleImportLegacySummaries = async () => {
    setIsImporting(true);
    setImportResult(null);
    
    try {
      const result = await importLegacySummaries();
      setImportResult(result);
    } catch (error) {
      setImportResult({
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsImporting(false);
    }
  };


  return (
    <div className="settings-view">
      <h3>Global Application Settings</h3>
      
      <div className="form-group">
        <label htmlFor="globalStreamEnabled">Enable Streaming Globally:</label>
        <input
          type="checkbox"
          id="globalStreamEnabled"
          name="globalStreamEnabled"
          checked={appSettings.globalStreamEnabled ?? true}
          onChange={handleGlobalStreamToggle}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="pauseOnRegeneration">Pause on Regeneration:</label>
        <input
          type="checkbox"
          id="pauseOnRegeneration"
          name="pauseOnRegeneration"
          checked={appSettings.pauseOnRegeneration ?? true}
          onChange={handlePauseOnRegenerationToggle}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="generateFollowingMessages">Generate Following Messages:</label>
        <input
          type="checkbox"
          id="generateFollowingMessages"
          name="generateFollowingMessages"
          checked={appSettings.generateFollowingMessages ?? true}
          onChange={handleGenerateFollowingMessagesToggle}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="messageFontSize">Message Font Size: {appSettings.messageFontSize?.toFixed(1) || 1.1}rem</label>
        <input
          type="range"
          id="messageFontSize"
          name="messageFontSize"
          min="0.8"
          max="2.0"
          step="0.1"
          value={appSettings.messageFontSize || 1.1}
          onChange={handleMessageFontSizeChange}
        />
      </div>
      
      <hr />
      
      <div className="form-group legacy-data-import">
        <h4>Legacy Data Import</h4>
        <p className="help-text">
          Import conversation summaries from legacy VOTC installation. Existing summaries will be backed up.
        </p>
        <button 
          type="button" 
          onClick={handleImportLegacySummaries}
          disabled={isImporting}
        >
          {isImporting ? 'Importing...' : 'Import Legacy Summaries'}
        </button>
        {importResult && (
          <div className={`import-result ${importResult.success ? 'success' : 'error'}`}>
            {importResult.message}
            {importResult.filesCopied && (
              <div>Copied {importResult.filesCopied} files.</div>
            )}
            {importResult.errors && importResult.errors.length > 0 && (
              <div className="error-list">
                <strong>Errors:</strong>
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
      
      <hr />
      
      <div className="form-group">
        <h4>CK3 User Folder</h4>
        <label htmlFor="ck3UserFolderPath">Current Path:</label>
        <input
          type="text"
          id="ck3UserFolderPath"
          value={appSettings.ck3UserFolderPath || ''}
          readOnly
        />
        <button type="button" onClick={handleSelectCK3Folder}>
          Select Folder
        </button>
      </div>
    </div>
  );
};

export default SettingsView;
