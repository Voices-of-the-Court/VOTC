import React, { ChangeEvent } from 'react';
import { useConfigStore, useAppSettings } from './store/useConfigStore';

const SettingsView: React.FC = () => {
  const appSettings = useAppSettings();
  const updateGlobalStreamSetting = useConfigStore((state) => state.updateGlobalStreamSetting);
  const updatePauseOnRegeneration = useConfigStore((state) => state.updatePauseOnRegeneration);
  const updateGenerateFollowingMessages = useConfigStore((state) => state.updateGenerateFollowingMessages);
  const selectCK3Folder = useConfigStore((state) => state.selectCK3Folder);

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

  const handleSelectCK3Folder = async () => {
    await selectCK3Folder();
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
