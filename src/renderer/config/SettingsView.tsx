import React, { ChangeEvent } from 'react';
import type { AppSettings } from '../../main/llmProviders/types';

interface SettingsViewProps {
    appSettings: AppSettings | null;
    setAppSettings: React.Dispatch<React.SetStateAction<AppSettings | null>>;
}

const SettingsView: React.FC<SettingsViewProps> = ({ appSettings, setAppSettings }) => {
    if (!appSettings) {
        return <div>Loading global settings...</div>;
    }

    const handleGlobalStreamToggle = async (e: ChangeEvent<HTMLInputElement>) => {
        const newGlobalStreamEnabled = e.target.checked;
        setAppSettings(prev => {
            if (!prev) return null; // Should not happen if appSettings is loaded
            return { ...prev, globalStreamEnabled: newGlobalStreamEnabled };
        });
        await window.llmConfigAPI.saveGlobalStreamSetting(newGlobalStreamEnabled);
        // alert(`Global streaming setting saved: ${newGlobalStreamEnabled}`); // Optional
    };

    const handleSelectCK3Folder = async () => {
        const path = await window.llmConfigAPI.selectFolder();
        if (path) {
            await window.llmConfigAPI.setCK3Folder(path);
            setAppSettings(prev => (prev ? { ...prev, ck3UserFolderPath: path } : null));
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
                <button type="button" onClick={handleSelectCK3Folder}>Select Folder</button>
            </div>
        </div>
    );
};

export default SettingsView;