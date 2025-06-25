import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AppSettings, LLMProviderConfig, ProviderType as ConfigProviderType } from '../../../main/llmProviders/types';

const DEFAULT_PARAMETERS_PRESET_MODAL = { temperature: 0.7, max_tokens: 2048 };

interface UsePresetModalProps {
    editingConfig: Partial<LLMProviderConfig>;
    appSettings: AppSettings | null;
    setAppSettings: React.Dispatch<React.SetStateAction<AppSettings | null>>;
    setSelectedPresetIdForEditing: React.Dispatch<React.SetStateAction<string | null>>;
    setSelectedProviderTypeForEditing: React.Dispatch<React.SetStateAction<ConfigProviderType | null>>;
    onSetActiveProvider: (instanceId: string | null) => Promise<void>;
}

export const usePresetModal = ({
    editingConfig,
    appSettings,
    setAppSettings,
    setSelectedPresetIdForEditing,
    setSelectedProviderTypeForEditing,
    onSetActiveProvider,
}: UsePresetModalProps) => {
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

    const openPresetModal = useCallback(() => setIsPresetModalOpen(true), []);
    const closePresetModal = useCallback(() => setIsPresetModalOpen(false), []);

    const createPreset = useCallback(async (presetName: string) => {
        if (!editingConfig.providerType) {
            alert("Cannot create preset from incomplete configuration.");
            return;
        }
        if (!appSettings) return;

        const newPresetConfig: LLMProviderConfig = {
            // Ensure all required fields for LLMProviderConfig are present
            instanceId: uuidv4(),
            providerType: editingConfig.providerType,
            customName: presetName,
            apiKey: editingConfig.apiKey || '',
            baseUrl: editingConfig.baseUrl || (editingConfig.providerType === 'ollama' ? 'http://localhost:11434' : ''),
            defaultModel: editingConfig.defaultModel || '',
            defaultParameters: editingConfig.defaultParameters || { ...DEFAULT_PARAMETERS_PRESET_MODAL },
        };

        try {
            const savedPreset = await window.llmConfigAPI.saveProviderConfig(newPresetConfig);

            setAppSettings(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    llmSettings: {
                        ...prev.llmSettings,
                        presets: [...prev.llmSettings.presets, savedPreset],
                        activeProviderInstanceId: savedPreset.instanceId, // Set new preset as active
                    },
                };
            });

            setSelectedPresetIdForEditing(savedPreset.instanceId);
            setSelectedProviderTypeForEditing(null);
            await onSetActiveProvider(savedPreset.instanceId); // Ensure backend is notified

            closePresetModal();
            // console.log(`Preset "${presetName}" created and set active.`);
        } catch (error) {
            console.error("Failed to create preset:", error);
            alert("Failed to create preset. See console for details.");
        }
    }, [editingConfig, appSettings, setAppSettings, setSelectedPresetIdForEditing, setSelectedProviderTypeForEditing, onSetActiveProvider, closePresetModal]);

    return {
        isPresetModalOpen,
        openPresetModal,
        closePresetModal,
        createPreset,
    };
};
