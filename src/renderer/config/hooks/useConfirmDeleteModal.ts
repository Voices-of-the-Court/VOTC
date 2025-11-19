import { useState, useCallback } from 'react';
import type { AppSettings, ProviderType as ConfigProviderType } from '../../../main/llmProviders/types';

interface UseConfirmDeleteModalProps {
    appSettings: AppSettings | null;
    setAppSettings: React.Dispatch<React.SetStateAction<AppSettings | null>>;
    selectedPresetIdForEditing: string | null;
    setSelectedPresetIdForEditing: React.Dispatch<React.SetStateAction<string | null>>;
    setSelectedProviderTypeForEditing: React.Dispatch<React.SetStateAction<ConfigProviderType | null>>;
    onSetActiveProvider: (instanceId: string | null) => Promise<void>;
    restoreFocusToPanel?: () => void; // Optional: to restore focus after modal closes
}

export const useConfirmDeleteModal = ({
    appSettings,
    setAppSettings,
    selectedPresetIdForEditing,
    setSelectedPresetIdForEditing,
    setSelectedProviderTypeForEditing,
    onSetActiveProvider,
    restoreFocusToPanel,
}: UseConfirmDeleteModalProps) => {
    const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
    const [presetToDeleteDetails, setPresetToDeleteDetails] = useState<{ id: string; name?: string } | null>(null);

    // Type guard to check if a string is one of the known ConfigProviderTypes
    const isConfigProviderTypeLocal = (value: string | null): value is ConfigProviderType => {
        if (value === null) return false;
        return ['openrouter', 'ollama', 'openai-compatible'].includes(value);
    };

    const openConfirmDeleteModal = useCallback((presetId: string) => {
        if (!appSettings) return;
        const preset = appSettings.llmSettings.presets.find(p => p.instanceId === presetId);
        if (preset) {
            setPresetToDeleteDetails({ id: preset.instanceId, name: preset.customName || preset.providerType });
            setIsConfirmDeleteModalOpen(true);
        }
    }, [appSettings]);

    const closeConfirmDeleteModal = useCallback(() => {
        setIsConfirmDeleteModalOpen(false);
        setPresetToDeleteDetails(null);
        restoreFocusToPanel?.();
    }, [restoreFocusToPanel]);

    const confirmDeletePreset = useCallback(async () => {
        if (!appSettings || !presetToDeleteDetails) return;

        const presetIdToDelete = presetToDeleteDetails.id;
        await window.llmConfigAPI.deletePreset(presetIdToDelete);

        const wasEditingPresetDeleted = selectedPresetIdForEditing === presetIdToDelete;
        const defaultProviderId: ConfigProviderType = 'openrouter'; // Fallback active provider

        let newSelectedIdToFallBackTo: ConfigProviderType | string | null = defaultProviderId;
        const currentPresets = appSettings.llmSettings.presets.filter(p => p.instanceId !== presetIdToDelete);

        if (currentPresets.length > 0) {
            newSelectedIdToFallBackTo = currentPresets[0].instanceId;
        } else if (appSettings.llmSettings.providers.some(p => p.instanceId === defaultProviderId)) {
            newSelectedIdToFallBackTo = defaultProviderId;
        } else if (appSettings.llmSettings.providers.length > 0) {
            newSelectedIdToFallBackTo = appSettings.llmSettings.providers[0].instanceId as ConfigProviderType; // instanceId of base provider is ConfigProviderType
        } else {
            newSelectedIdToFallBackTo = null;
        }

        let newActiveId = appSettings.llmSettings.activeProviderInstanceId;
        if (newActiveId === presetIdToDelete) {
            newActiveId = defaultProviderId; // Fallback to default if deleted preset was active
        }
        
        setAppSettings(prev => {
            if (!prev) return null;
            const newPresets = prev.llmSettings.presets.filter(p => p.instanceId !== presetIdToDelete);
            
            // If no active ID is set after potential deletion, and no presets left,
            // but base providers exist, set a default base provider as active.
            let finalActiveId = newActiveId;
            if (finalActiveId === presetIdToDelete || finalActiveId === null) { // If deleted was active or no active
                 if (newPresets.length > 0) {
                    finalActiveId = newPresets[0].instanceId; // Fallback to first preset
                 } else if (prev.llmSettings.providers.some(p => p.instanceId === defaultProviderId)) {
                    finalActiveId = defaultProviderId; // Fallback to default base provider
                 } else if (prev.llmSettings.providers.length > 0) {
                    finalActiveId = prev.llmSettings.providers[0].instanceId; // Fallback to first available base provider
                 } else {
                    finalActiveId = null; // No providers left
                 }
            }


            return {
                ...prev,
                llmSettings: {
                    ...prev.llmSettings,
                    presets: newPresets,
                    activeProviderInstanceId: finalActiveId,
                },
            };
        });
        
        // Update selection in UI if the deleted preset was being edited
        if (wasEditingPresetDeleted) {
            // Determine the new active ID from the potentially updated appSettings
            // newSelectedIdToFallBackTo is already determined above

            if (isConfigProviderTypeLocal(newSelectedIdToFallBackTo)) {
                setSelectedProviderTypeForEditing(newSelectedIdToFallBackTo);
                setSelectedPresetIdForEditing(null);
            } else if (newSelectedIdToFallBackTo) { // It's a preset ID (string)
                setSelectedPresetIdForEditing(newSelectedIdToFallBackTo);
                setSelectedProviderTypeForEditing(null);
            } else { // No providers left (null)
                setSelectedPresetIdForEditing(null);
                setSelectedProviderTypeForEditing(null);
            }
            await onSetActiveProvider(newSelectedIdToFallBackTo);
        } else if (appSettings.llmSettings.activeProviderInstanceId === presetIdToDelete) {
            // If the active provider was deleted but not being edited, still need to update active provider
            // The activeProviderInstanceId is updated in setAppSettings.
            // We need to ensure onSetActiveProvider is called with the new active ID derived from there.
            // The `newActiveId` determined earlier in this callback (before setAppSettings)
            // might not reflect the final state if setAppSettings itself has complex logic.
            // However, `activeProviderInstanceId` in `setAppSettings` is set to `finalActiveId`.
            // So, we can use that.
            let finalActiveIdFromState = appSettings.llmSettings.activeProviderInstanceId;
             if (finalActiveIdFromState === presetIdToDelete) { // If it was the one deleted
                const newPresets = appSettings.llmSettings.presets.filter(p => p.instanceId !== presetIdToDelete);
                if (newPresets.length > 0) {
                    finalActiveIdFromState = newPresets[0].instanceId;
                } else if (appSettings.llmSettings.providers.some(p => p.instanceId === defaultProviderId)) {
                    finalActiveIdFromState = defaultProviderId;
                } else if (appSettings.llmSettings.providers.length > 0) {
                    finalActiveIdFromState = appSettings.llmSettings.providers[0].instanceId as ConfigProviderType;
                } else {
                    finalActiveIdFromState = null;
                }
            }
            await onSetActiveProvider(finalActiveIdFromState);
        }

        closeConfirmDeleteModal();
    }, [appSettings, presetToDeleteDetails, selectedPresetIdForEditing, setAppSettings, setSelectedPresetIdForEditing, setSelectedProviderTypeForEditing, onSetActiveProvider, closeConfirmDeleteModal, isConfigProviderTypeLocal]); // Added isConfigProviderTypeLocal to dependencies

    return {
        isConfirmDeleteModalOpen,
        presetToDeleteDetails,
        openConfirmDeleteModal, // This is the function to call to initiate deletion
        closeConfirmDeleteModal,
        confirmDeletePreset, // This is the function to pass to the modal's confirm button
    };
};
