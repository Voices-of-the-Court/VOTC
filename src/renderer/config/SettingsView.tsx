import React, { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfigStore, useAppSettings } from './store/useConfigStore';
import { LettersStatusModal } from './components/LettersStatusModal';

const SettingsView: React.FC = () => {
  const { t } = useTranslation();
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
  const [showLettersModal, setShowLettersModal] = React.useState(false);
  
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
    return <div>{t('common.loading')}</div>;
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
      <h3>{t('settings.globalApplicationSettings')}</h3>
      
      <div className="form-group">
        <label htmlFor="globalStreamEnabled">{t('settings.enableStreamingGlobally')}:</label>
        <input
          type="checkbox"
          id="globalStreamEnabled"
          name="globalStreamEnabled"
          checked={appSettings.globalStreamEnabled ?? true}
          onChange={handleGlobalStreamToggle}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="pauseOnRegeneration">{t('settings.pauseOnRegeneration')}:</label>
        <input
          type="checkbox"
          id="pauseOnRegeneration"
          name="pauseOnRegeneration"
          checked={appSettings.pauseOnRegeneration ?? true}
          onChange={handlePauseOnRegenerationToggle}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="generateFollowingMessages">{t('settings.generateFollowingMessages')}:</label>
        <input
          type="checkbox"
          id="generateFollowingMessages"
          name="generateFollowingMessages"
          checked={appSettings.generateFollowingMessages ?? true}
          onChange={handleGenerateFollowingMessagesToggle}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="messageFontSize">{t('settings.messageFontSize')}: {appSettings.messageFontSize?.toFixed(1) || 1.1}rem</label>
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
        <label htmlFor="showSettingsOnStartup">{t('settings.showSettingsOnStartup')}:</label>
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
        <h4>{t('settings.actionApprovalSettings')}</h4>
        <p className="help-text">
          {t('settings.actionApprovalHelp')}
        </p>
        
        <div className="form-group">
          <label htmlFor="approvalMode">{t('settings.approvalMode')}:</label>
          <select
            id="approvalMode"
            name="approvalMode"
            value={actionApprovalSettings?.approvalMode || 'none'}
            onChange={handleApprovalModeChange}
          >
            <option value="none">{t('settings.approvalModeNone')}</option>
            <option value="non-destructive">{t('settings.approvalModeNonDestructive')}</option>
            <option value="all">{t('settings.approvalModeAll')}</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="pauseOnApproval">{t('settings.pauseOnApproval')}:</label>
          <input
            type="checkbox"
            id="pauseOnApproval"
            name="pauseOnApproval"
            checked={actionApprovalSettings?.pauseOnApproval ?? true}
            onChange={handlePauseOnApprovalToggle}
          />
          <span className="help-text">
            {t('settings.pauseOnApprovalHelp')}
          </span>
        </div>
      </div>
      
      <hr />
      
      <div className="form-group letter-management">
        <h4>{t('settings.letterStatusManagement')}</h4>
        <p className="help-text">
          {t('settings.letterStatusHelp')}
        </p>
        <div className="button-group">
          <button
            type="button"
            onClick={() => setShowLettersModal(true)}
          >
            {t('settings.viewLettersStatus')}
          </button>
        </div>
      </div>
      
      <hr />
      
      <div className="form-group">
        <h4>{t('settings.ck3UserFolder')}</h4>
        <label htmlFor="ck3UserFolderPath">{t('settings.currentPath')}:</label>
        <input
          type="text"
          id="ck3UserFolderPath"
          value={appSettings.ck3UserFolderPath || ''}
          readOnly
        />
        <button type="button" onClick={handleSelectCK3Folder}>
          {t('settings.selectFolder')}
        </button>
      </div>
      
      <div className="form-group">
        <h4>{t('settings.votcModLocation')}</h4>
        <label htmlFor="modLocationPath">{t('settings.currentPath')}:</label>
        <input
          type="text"
          id="modLocationPath"
          value={appSettings.modLocationPath || ''}
          readOnly
        />
        <button type="button" onClick={handleSelectModLocationPath}>
          {t('settings.selectFolder')}
        </button>
      </div>
      
      {showLettersModal && (
        <LettersStatusModal onClose={() => setShowLettersModal(false)} />
      )}
    </div>
  );
};

export default SettingsView;
