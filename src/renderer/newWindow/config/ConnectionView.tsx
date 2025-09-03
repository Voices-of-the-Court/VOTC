import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { AppSettings, LLMProviderConfig, ProviderType as ConfigProviderType, ILLMModel } from '../../../main/llmProviders/types';
// Removed uuid import as it's handled in usePresetModal

// Import hooks
import { useProviderSelectionManagement } from './hooks/useProviderSelectionManagement';
import { useModelManagement } from './hooks/useModelManagement';
import { useAutoSave } from './hooks/useAutoSave';
import { usePresetModal } from './hooks/usePresetModal';
import { useConfirmDeleteModal } from './hooks/useConfirmDeleteModal';

// Import components
import ProviderSidebar from './components/ProviderSidebar';
import ProviderConfigPanel from './components/ProviderConfigPanel';
import PresetModal from './components/PresetModal';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';

const DEFAULT_PARAMETERS_CV = { temperature: 0.7, max_tokens: 2048 }; // Keep for default test connection

const ConnectionView: React.FC<{
    appSettings: AppSettings | null,
    setAppSettings: React.Dispatch<React.SetStateAction<AppSettings | null>>
}> = ({ appSettings, setAppSettings }) => {
    const configPanelRef = useRef<HTMLDivElement>(null);
    const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

    // Centralized handler for setting active provider (passed to hooks)
    const handleSetActiveProvider = useCallback(async (instanceId: string | null) => {
        if (!appSettings) return;
        await window.llmConfigAPI.setActiveProvider(instanceId);
        setAppSettings(prev => {
            if (!prev) return null;
            return {
                ...prev,
                llmSettings: { ...prev.llmSettings, activeProviderInstanceId: instanceId }
            };
        });
        // Optional: User feedback for active provider change (can be annoying)
        // if (instanceId) {
        //     const activeConf = appSettings.llmSettings.providers.find(p => p.instanceId === instanceId) ||
        //                        appSettings.llmSettings.presets.find(p => p.instanceId === instanceId);
        //     console.log(`Provider "${activeConf?.customName || activeConf?.providerType}" is now active.`);
        // }
    }, [appSettings, setAppSettings]);


    const {
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
    } = useProviderSelectionManagement({ appSettings, onSetActiveProvider: handleSetActiveProvider });

    const {
        availableModels,
        isLoadingModels,
        modelSearchText,
        setModelSearchText, // Renamed from setModelSearchText to handleModelSearchChange in hook
        suggestedModels,
        setSuggestedModels, // Keep for clearing on blur etc.
        // fetchModelsForConfig, // Not directly called from ConnectionView anymore
    } = useModelManagement({ editingConfig });

    useAutoSave({ editingConfig, initialEditingConfig, setAppSettings, setInitialEditingConfig });

    const {
        isPresetModalOpen,
        openPresetModal,
        closePresetModal,
        createPreset,
    } = usePresetModal({
        editingConfig,
        appSettings,
        setAppSettings,
        setSelectedPresetIdForEditing,
        setSelectedProviderTypeForEditing,
        onSetActiveProvider: handleSetActiveProvider,
    });

    const restoreFocusToPanel = useCallback(() => {
        configPanelRef.current?.focus();
    }, []);

    const {
        isConfirmDeleteModalOpen,
        presetToDeleteDetails,
        openConfirmDeleteModal,
        closeConfirmDeleteModal,
        confirmDeletePreset,
    } = useConfirmDeleteModal({
        appSettings,
        setAppSettings,
        selectedPresetIdForEditing,
        setSelectedPresetIdForEditing,
        setSelectedProviderTypeForEditing,
        onSetActiveProvider: handleSetActiveProvider,
        restoreFocusToPanel,
    });

    // Effect to reset testResult and model search when selection changes
    useEffect(() => {
        setTestResult(null);
        // modelSearchText is now handled by useModelManagement based on editingConfig.defaultModel
    }, [selectedProviderTypeForEditing, selectedPresetIdForEditing]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked; // For potential checkboxes

        setEditingConfig(prev => {
            let newConfig = { ...prev };
            if (name.startsWith('defaultParameters.')) {
                const paramName = name.split('.')[1];
                newConfig.defaultParameters = {
                    ...(newConfig.defaultParameters || DEFAULT_PARAMETERS_CV),
                    [paramName]: type === 'number' ? parseFloat(value) : value,
                };
            } else if (type === 'checkbox') {
                newConfig = { ...newConfig, [name]: checked };
            } else if (type === 'number') {
                  newConfig = { ...newConfig, [name]: parseFloat(value) };
            } else {
                newConfig = { ...newConfig, [name]: value };
            }

            // If the input being changed is 'defaultModel', update modelSearchText via its dedicated setter from the hook
            if (name === 'defaultModel') {
                setModelSearchText(value); // This now calls handleModelSearchChange from useModelManagement
            }
            return newConfig;
        });
    };

    const handleModelSuggestionClick = (modelId: string) => {
        setEditingConfig(prev => ({ ...prev, defaultModel: modelId }));
        setModelSearchText(modelId); // Update search text
        setSuggestedModels([]);    // Clear suggestions
    };

    const handleTestConnection = async () => {
        if (!editingConfig.providerType) return;
        setTestResult(null); // Clear previous result
        const configToTest: LLMProviderConfig = {
            instanceId: editingConfig.instanceId || `${editingConfig.providerType}_test_config`, // Ensure instanceId
            providerType: editingConfig.providerType,
            customName: editingConfig.customName,
            apiKey: editingConfig.apiKey,
            baseUrl: editingConfig.baseUrl,
            defaultModel: editingConfig.defaultModel ||
                          (editingConfig.providerType === 'ollama' && availableModels.length > 0 ? availableModels[0].id : 'openrouter/auto'),
            defaultParameters: editingConfig.defaultParameters || DEFAULT_PARAMETERS_CV,
        };
        const result = await window.llmConfigAPI.testConnection(configToTest);
        setTestResult(result);
    };

    return (
        <div
            ref={configPanelRef}
            tabIndex={-1}
            style={{ display: 'flex', height: 'calc(100% - 40px)', outline: 'none' }}
        >
            <ProviderSidebar
                appSettings={appSettings}
                onSelectProviderType={selectProviderType} // from useProviderSelectionManagement
                onSelectPreset={selectPreset}             // from useProviderSelectionManagement
                onDeletePreset={openConfirmDeleteModal}   // from useConfirmDeleteModal
                selectedProviderType={selectedProviderTypeForEditing}
                selectedPresetId={selectedPresetIdForEditing}
            />
            <ProviderConfigPanel
                key={selectedPresetIdForEditing || selectedProviderTypeForEditing || 'panel-placeholder'}
                config={editingConfig}
                availableModels={availableModels}
                isLoadingModels={isLoadingModels}
                modelSearchText={modelSearchText}
                suggestedModels={suggestedModels}
                testResult={testResult}
                onInputChange={handleInputChange}
                onModelSuggestionClick={handleModelSuggestionClick}
                onTestConnection={handleTestConnection}
                onMakePreset={openPresetModal} // from usePresetModal
            />
            <PresetModal
                isOpen={isPresetModalOpen}
                onClose={closePresetModal}
                onSubmit={createPreset} // from usePresetModal
            />
            <ConfirmDeleteModal
                isOpen={isConfirmDeleteModalOpen}
                onClose={closeConfirmDeleteModal}
                onConfirm={confirmDeletePreset} // from useConfirmDeleteModal
                presetName={presetToDeleteDetails?.name}
            />
        </div>
    );
};

export default ConnectionView;