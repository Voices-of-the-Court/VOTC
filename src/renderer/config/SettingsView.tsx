import React, { ChangeEvent } from 'react';
import { useConfigStore, useAppSettings } from './store/useConfigStore';

const SettingsView: React.FC = () => {
  const appSettings = useAppSettings();
  const updateGlobalStreamSetting = useConfigStore((state) => state.updateGlobalStreamSetting);
  const updatePauseOnRegeneration = useConfigStore((state) => state.updatePauseOnRegeneration);
  const updateGenerateFollowingMessages = useConfigStore((state) => state.updateGenerateFollowingMessages);
  const updateMessageFontSize = useConfigStore((state) => state.updateMessageFontSize);
  const updateShowSettingsOnStartup = useConfigStore((state) => state.updateShowSettingsOnStartup);
  const getActionApprovalSettings = useConfigStore((state) => state.getActionApprovalSettings);
  const saveActionApprovalSettings = useConfigStore((state) => state.saveActionApprovalSettings);
  const selectCK3Folder = useConfigStore((state) => state.selectCK3Folder);
  const selectModLocationPath = useConfigStore((state) => state.selectModLocationPath);
  
  const [actionApprovalSettings, setActionApprovalSettings] = React.useState<any>(null);
  
  // Load action approval settings on mount
  React.useEffect(() => {
    const loadActionApprovalSettings = async () => {
      try {
        const settings = await getActionApprovalSettings();
        setActionApprovalSettings(settings);
      } catch (error) {
        console.error('Failed to load action approval settings:', error);
      }
    };
    
    loadActionApprovalSettings();
  }, [getActionApprovalSettings]);

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

  const handleShowSettingsOnStartupToggle = async (e: ChangeEvent<HTMLInputElement>) => {
    await updateShowSettingsOnStartup(e.target.checked);
  };

  const handleApprovalModeChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    if (!actionApprovalSettings) return;
    
    const newSettings = {
      ...actionApprovalSettings,
      approvalMode: e.target.value
    };
    
    try {
      await saveActionApprovalSettings(newSettings);
      setActionApprovalSettings(newSettings);
    } catch (error) {
      console.error('Failed to save action approval settings:', error);
    }
  };

  const handlePauseOnApprovalToggle = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!actionApprovalSettings) return;
    
    const newSettings = {
      ...actionApprovalSettings,
      pauseOnApproval: e.target.checked
    };
    
    try {
      await saveActionApprovalSettings(newSettings);
      setActionApprovalSettings(newSettings);
    } catch (error) {
      console.error('Failed to save action approval settings:', error);
    }
  };

  const handleSelectCK3Folder = async () => {
    await selectCK3Folder();
  };

  const handleSelectModLocationPath = async () => {
    await selectModLocationPath();
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
      
      <div className="form-group">
        <label htmlFor="showSettingsOnStartup">Show Settings on Startup:</label>
        <input
          type="checkbox"
          id="showSettingsOnStartup"
          name="showSettingsOnStartup"
          checked={appSettings.showSettingsOnStartup ?? true}
          onChange={handleShowSettingsOnStartupToggle}
        />
      </div>
      
      <hr />
      
      <div className="form-group">
        <h4>Action Approval Settings</h4>
        <p className="help-text">
          Configure when actions require user approval before execution. Destructive actions (like killing characters) always require approval regardless of these settings.
        </p>
        
        <div className="form-group">
          <label htmlFor="approvalMode">Approval Mode:</label>
          <select
            id="approvalMode"
            name="approvalMode"
            value={actionApprovalSettings?.approvalMode || 'none'}
            onChange={handleApprovalModeChange}
          >
            <option value="none">No Auto-accept (All actions require approval)</option>
            <option value="non-destructive">Auto-accept Non-destructive (Only destructive actions require approval)</option>
            <option value="all">Auto-accept All (No actions require approval)</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="pauseOnApproval">Pause Conversation When Approval Needed:</label>
          <input
            type="checkbox"
            id="pauseOnApproval"
            name="pauseOnApproval"
            checked={actionApprovalSettings?.pauseOnApproval ?? true}
            onChange={handlePauseOnApprovalToggle}
          />
          <span className="help-text">
            When enabled, the conversation will pause when actions need approval, allowing you to review them before continuing.
          </span>
        </div>
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
      
      <div className="form-group">
        <h4>VOTC Mod Location</h4>
        <label htmlFor="modLocationPath">Current Path:</label>
        <input
          type="text"
          id="modLocationPath"
          value={appSettings.modLocationPath || ''}
          readOnly
        />
        <button type="button" onClick={handleSelectModLocationPath}>
          Select Folder
        </button>
      </div>
    </div>
  );
};

export default SettingsView;
