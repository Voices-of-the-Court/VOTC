import React, { useMemo } from 'react';
import type { ProviderType as ConfigProviderType } from '../../../main/llmProviders/types';
import { PROVIDER_TYPES } from '../../../main/llmProviders/types';
import { useAppSettings } from '../store/useConfigStore';

interface ProviderSidebarProps {
    onSelectProviderType: (type: ConfigProviderType) => void;
    onSelectPreset: (presetId: string) => void;
    onDeletePreset: (presetId: string) => void;
    selectedProviderTypeForEditing: ConfigProviderType | null;
    selectedPresetIdForEditing: string | null;
    actionsProviderInstanceId: string | null;
    summaryProviderInstanceId: string | null;
    onSetActionsProvider: (instanceId: string | null) => void;
    onSetSummaryProvider: (instanceId: string | null) => void;
}

const ProviderSidebar: React.FC<ProviderSidebarProps> = ({
    onSelectProviderType,
    onSelectPreset,
    onDeletePreset,
    selectedProviderTypeForEditing,
    selectedPresetIdForEditing,
    actionsProviderInstanceId,
    summaryProviderInstanceId,
    onSetActionsProvider,
    onSetSummaryProvider,
}) => {
    const appSettings = useAppSettings();
    const baseProviderTypes: ConfigProviderType[] = [...PROVIDER_TYPES];

    // Helper to get all available providers (base + presets)
    const allProviders = useMemo(() => [
        ...(appSettings?.llmSettings.providers || []),
        ...(appSettings?.llmSettings.presets || [])
    ], [appSettings?.llmSettings.providers, appSettings?.llmSettings.presets]);

    // Get active provider info for NPC messages
    const activeProviderInfo = useMemo(() => {
        const activeId = appSettings?.llmSettings.activeProviderInstanceId;
        const activeProvider = allProviders.find(p => p.instanceId === activeId);
        return {
            displayName: activeProvider?.customName || activeProvider?.providerType || 'None',
            modelName: activeProvider?.defaultModel || 'No model selected'
        };
    }, [appSettings?.llmSettings.activeProviderInstanceId, allProviders]);

    // Helper to get CSS class for assignment styling
    const getAssignmentClass = (instanceId: string) => {
        const isActions = actionsProviderInstanceId === instanceId;
        const isSummary = summaryProviderInstanceId === instanceId;
        if (isActions && isSummary) return 'assigned-both';
        if (isActions) return 'assigned-actions';
        if (isSummary) return 'assigned-summary';
        return '';
    };

    return (
        <div className="provider-sidebar">
            <div className="providers-presets-container">
                <h4>Providers</h4>
                <ul className="provider-list">
                    {baseProviderTypes.map(type => {
                        return (
                            <li
                                key={type}
                                onClick={() => onSelectProviderType(type)}
                                className={`
                                    ${selectedProviderTypeForEditing === type && !selectedPresetIdForEditing ? 'active' : ''}
                                    ${getAssignmentClass(type)}
                                `.trim()}
                            >
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                            </li>
                        );
                    })}
                </ul>
                <hr />
                <h4>Presets</h4>
                {appSettings?.llmSettings.presets && appSettings.llmSettings.presets.length > 0 ? (
                    <ul className="preset-list">
                        {appSettings.llmSettings.presets.map(preset => {
                            return (
                                <li
                                    key={preset.instanceId}
                                    className={`preset-item
                                        ${selectedPresetIdForEditing === preset.instanceId ? 'active' : ''}
                                        ${getAssignmentClass(preset.instanceId)}
                                    `.trim()}
                                    onClick={() => onSelectPreset(preset.instanceId)}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', overflow: 'hidden', width: '100%' }}>
                                        <span className="preset-name" title={preset.customName || 'Unnamed Preset'}>
                                            {preset.customName || 'Unnamed Preset'}
                                        </span>
                                        <small className="preset-type">({preset.providerType})</small>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeletePreset(preset.instanceId);
                                        }}
                                        className="delete-preset-btn"
                                        title="Delete preset"
                                    >
                                        &times;
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="no-presets-message">No presets saved yet.</p>
                )}
            </div>
            
            {/* Override For Section */}
            <div className="override-section">
                <div className="override-item npc-messages-indicator">
                    <label>💬 NPC Messages</label>
                    <div className="npc-provider-display">
                        <div className="provider-info" title={activeProviderInfo.modelName}>
                            <span className="provider-name">{activeProviderInfo.displayName}</span>
                            <span className="model-name">{activeProviderInfo.modelName}</span>
                        </div>
                    </div>
                </div>
                
                <div className="override-item">
                    <label>⚡ Actions</label>
                    <select 
                        value={actionsProviderInstanceId || ''}
                        onChange={(e) => onSetActionsProvider(e.target.value || null)}
                    >
                        <option value="">Default</option>
                        {allProviders.map(p => (
                            <option key={p.instanceId} value={p.instanceId}>
                                {p.customName || p.providerType}
                            </option>
                        ))}
                    </select>
                </div>
                
                <div className="override-item">
                    <label>📝 Summaries</label>
                    <select 
                        value={summaryProviderInstanceId || ''}
                        onChange={(e) => onSetSummaryProvider(e.target.value || null)}
                    >
                        <option value="">Default</option>
                        {allProviders.map(p => (
                            <option key={p.instanceId} value={p.instanceId}>
                                {p.customName || p.providerType}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
};

export default ProviderSidebar;
