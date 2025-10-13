import React from 'react';
import type {  ProviderType as ConfigProviderType } from '@llmTypes';
import { useAppSettings } from '../store/useConfigStore';

interface ProviderSidebarProps {
    onSelectProviderType: (type: ConfigProviderType) => void;
    onSelectPreset: (presetId: string) => void;
    onDeletePreset: (presetId: string) => void;
    selectedProviderTypeForEditing: ConfigProviderType | null;
    selectedPresetIdForEditing: string | null;
}

const ProviderSidebar: React.FC<ProviderSidebarProps> = ({
    onSelectProviderType,
    onSelectPreset,
    onDeletePreset,
    selectedProviderTypeForEditing,
    selectedPresetIdForEditing,
}) => {
    const appSettings = useAppSettings();
    const baseProviderTypes: ConfigProviderType[] = ['openrouter', 'ollama', 'openai-compatible'];

    return (
        <div className="provider-sidebar">
            <h4>Providers</h4>
            <ul className="provider-list">
                {baseProviderTypes.map(type => (
                    <li 
                        key={type} 
                        onClick={() => onSelectProviderType(type)}
                        className={selectedProviderTypeForEditing === type && !selectedPresetIdForEditing ? 'active' : ''}
                    >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                    </li>
                ))}
            </ul>
            <hr />
            <h4>Presets</h4>
            {appSettings?.llmSettings.presets && appSettings.llmSettings.presets.length > 0 ? (
                <ul className="preset-list">
                    {appSettings.llmSettings.presets.map(preset => (
                        <li 
                            key={preset.instanceId} 
                            className={`preset-item ${selectedPresetIdForEditing === preset.instanceId ? 'active' : ''}`}
                            onClick={() => onSelectPreset(preset.instanceId)} // Moved onClick to li
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <span className="preset-name"> {/* Removed onClick from span */}
                                    {preset.customName || 'Unnamed Preset'} 
                                </span>
                                <small className="preset-type">({preset.providerType})</small>
                            </div>
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); // Prevent li onClick from firing
                                    onDeletePreset(preset.instanceId); 
                                }} 
                                className="delete-preset-btn"
                                title="Delete preset"
                            >
                                &times;
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="no-presets-message">No presets saved yet.</p>
            )}
        </div>
    );
};

export default ProviderSidebar;
