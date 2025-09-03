import { useState, useEffect, useCallback } from 'react';
import type { AppSettings, LLMProviderConfig, ProviderType as ConfigProviderType } from '../../../../main/llmProviders/types';

const DEFAULT_PARAMETERS_HOOK = { temperature: 0.7, max_tokens: 2048 };

interface UseProviderSelectionManagementProps {
    appSettings: AppSettings | null;
    onSetActiveProvider: (instanceId: string | null) => Promise<void>;
}

export const useProviderSelectionManagement = ({
    appSettings,
    onSetActiveProvider,
}: UseProviderSelectionManagementProps) => {
    const [selectedProviderTypeForEditing, setSelectedProviderTypeForEditing] = useState<ConfigProviderType | null>(null);
    const [selectedPresetIdForEditing, setSelectedPresetIdForEditing] = useState<string | null>(null);
    const [editingConfig, setEditingConfig] = useState<Partial<LLMProviderConfig>>({});
    const [initialEditingConfig, setInitialEditingConfig] = useState<Partial<LLMProviderConfig>>({});
    
    // Effect to initialize selection based on activeProviderInstanceId from appSettings
    useEffect(() => {
        if (appSettings && appSettings.llmSettings.activeProviderInstanceId) {
            const activeId = appSettings.llmSettings.activeProviderInstanceId;
            const isBaseProvider = ['openrouter', 'ollama', 'openai-compatible'].includes(activeId);

            if (isBaseProvider) {
                if (selectedProviderTypeForEditing !== activeId) {
                    setSelectedProviderTypeForEditing(activeId as ConfigProviderType);
                    setSelectedPresetIdForEditing(null);
                }
            } else {
                if (selectedPresetIdForEditing !== activeId) {
                    setSelectedPresetIdForEditing(activeId);
                    setSelectedProviderTypeForEditing(null);
                }
            }
        } else if (appSettings && !appSettings.llmSettings.activeProviderInstanceId) {
            // Default to OpenRouter if no active provider is set and it's not already selected
            if (selectedProviderTypeForEditing !== 'openrouter') {
                setSelectedProviderTypeForEditing('openrouter');
                setSelectedPresetIdForEditing(null);
            }
        }
    }, [appSettings]); // Only re-run if appSettings changes

    const getBaseConfigByType = useCallback((type: ConfigProviderType): Partial<LLMProviderConfig> => {
        return appSettings?.llmSettings.providers.find(p => p.providerType === type) || {
            instanceId: type,
            providerType: type,
            apiKey: '',
            baseUrl: type === 'ollama' ? 'http://localhost:11434' : '',
            defaultModel: '',
            defaultParameters: { ...DEFAULT_PARAMETERS_HOOK },
        };
    }, [appSettings]);

    const getPresetById = useCallback((id: string): Partial<LLMProviderConfig> | null => {
        return appSettings?.llmSettings.presets.find(p => p.instanceId === id) || null;
    }, [appSettings]);

    // Effect to update editingConfig and initialEditingConfig when selection or appSettings change
    useEffect(() => {
        let configToEdit: Partial<LLMProviderConfig> = {};
        if (selectedProviderTypeForEditing && appSettings) {
            configToEdit = getBaseConfigByType(selectedProviderTypeForEditing);
        } else if (selectedPresetIdForEditing && appSettings) {
            configToEdit = getPresetById(selectedPresetIdForEditing) || {};
        }
        setEditingConfig(configToEdit);
        setInitialEditingConfig(configToEdit);
    }, [selectedProviderTypeForEditing, selectedPresetIdForEditing, appSettings, getBaseConfigByType, getPresetById]);

    const selectProviderType = (type: ConfigProviderType) => {
        setSelectedProviderTypeForEditing(type);
        setSelectedPresetIdForEditing(null);
        onSetActiveProvider(type);
    };

    const selectPreset = (presetId: string) => {
        setSelectedPresetIdForEditing(presetId);
        setSelectedProviderTypeForEditing(null);
        onSetActiveProvider(presetId);
    };

    return {
        selectedProviderTypeForEditing,
        setSelectedProviderTypeForEditing,
        selectedPresetIdForEditing,
        setSelectedPresetIdForEditing,
        editingConfig,
        setEditingConfig,
        initialEditingConfig,
        setInitialEditingConfig,
        selectProviderType,
        selectPreset,
    };
};
