import React, { useState, useEffect, ChangeEvent, FormEvent, useRef } from 'react'; // Added ChangeEvent, FormEvent, useRef
import type { AppSettings, LLMProviderConfig, ProviderType as ConfigProviderType, ILLMModel } from '../../main/llmProviders/types';
import { v4 as uuidv4 } from 'uuid';
import ProviderSidebar from './components/ProviderSidebar';
import ProviderConfigPanel from './components/ProviderConfigPanel';
import PresetModal from './components/PresetModal'; // Import the actual component
import ConfirmDeleteModal from './components/ConfirmDeleteModal'; // Import the new modal

const DEFAULT_PARAMETERS_CV = { temperature: 0.7, max_tokens: 2048 };

const ConnectionView: React.FC<{ 
    appSettings: AppSettings | null, 
    setAppSettings: React.Dispatch<React.SetStateAction<AppSettings | null>> 
}> = ({ appSettings, setAppSettings }) => {
    const [selectedProviderTypeForEditing, setSelectedProviderTypeForEditing] = useState<ConfigProviderType | null>(null);
    const [selectedPresetIdForEditing, setSelectedPresetIdForEditing] = useState<string | null>(null);
    const [editingConfig, setEditingConfig] = useState<Partial<LLMProviderConfig>>({});
    const [availableModels, setAvailableModels] = useState<ILLMModel[]>([]);
    const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [modelSearchText, setModelSearchText] = useState('');
    const [suggestedModels, setSuggestedModels] = useState<ILLMModel[]>([]);
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
    const [initialEditingConfig, setInitialEditingConfig] = useState<Partial<LLMProviderConfig>>({}); // Track initial state for comparison

    // State for the delete confirmation modal
    const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
    const [presetToDeleteDetails, setPresetToDeleteDetails] = useState<{ id: string; name?: string } | null>(null);

    // Refs to track previous selection state and for focus management
    const prevSelectedProviderTypeRef = useRef<ConfigProviderType | null>(null);
    const prevSelectedPresetIdRef = useRef<string | null>(null);
    const configPanelRef = useRef<HTMLDivElement>(null); // Ref for the main panel to restore focus

    // Add a new useEffect to initialize selection based on activeProviderInstanceId
    useEffect(() => {
        if (appSettings && appSettings.llmSettings.activeProviderInstanceId) {
            const activeId = appSettings.llmSettings.activeProviderInstanceId;
            const isBaseProvider = ['openrouter', 'ollama', 'openai-compatible'].includes(activeId);

            if (isBaseProvider) {
                // Check if it's different from current to avoid loop, though initial load should be fine
                if (selectedProviderTypeForEditing !== activeId) {
                    setSelectedProviderTypeForEditing(activeId as ConfigProviderType);
                    setSelectedPresetIdForEditing(null); // Ensure preset selection is cleared
                }
            } else {
                // It's a preset ID
                if (selectedPresetIdForEditing !== activeId) {
                    setSelectedPresetIdForEditing(activeId);
                    setSelectedProviderTypeForEditing(null); // Ensure base type selection is cleared
                }
            }
        } else if (appSettings && !appSettings.llmSettings.activeProviderInstanceId) {
            // No active provider, explicitly clear selections to show placeholder
            // or default to OpenRouter if that's the desired behavior even if activeProviderInstanceId is null
            // This complements the LLMManager change.
            if (selectedProviderTypeForEditing !== 'openrouter') {
                 setSelectedProviderTypeForEditing('openrouter');
                 setSelectedPresetIdForEditing(null);
            }
        }
    }, [appSettings]); // Run when appSettings are loaded

    const getBaseConfigByType = (type: ConfigProviderType): Partial<LLMProviderConfig> => {
        return appSettings?.llmSettings.providers.find(p => p.providerType === type) || {
            instanceId: type, // Base configs use their type as instanceId
            providerType: type,
            apiKey: '', baseUrl: type === 'ollama' ? 'http://localhost:11434' : '', defaultModel: '',
            defaultParameters: { ...DEFAULT_PARAMETERS_CV },
        };
    };
    
    const getPresetById = (id: string): Partial<LLMProviderConfig> | null => {
        return appSettings?.llmSettings.presets.find(p => p.instanceId === id) || null;
    };

    useEffect(() => {
        let configToEdit: Partial<LLMProviderConfig> = {};
        if (selectedProviderTypeForEditing && appSettings) {
            configToEdit = getBaseConfigByType(selectedProviderTypeForEditing);
        } else if (selectedPresetIdForEditing && appSettings) {
            configToEdit = getPresetById(selectedPresetIdForEditing) || {};
        }
        setEditingConfig(configToEdit);
        setInitialEditingConfig(configToEdit); // Store the initial config when selection changes

        // Check if the actual selection has changed
        const selectionChanged = 
            prevSelectedProviderTypeRef.current !== selectedProviderTypeForEditing ||
            prevSelectedPresetIdRef.current !== selectedPresetIdForEditing;

        if (selectionChanged) {
            if (configToEdit.providerType) {
                fetchModelsForConfig(configToEdit);
            } else {
                setAvailableModels([]);
            }
            setTestResult(null);
            setModelSearchText(configToEdit.defaultModel || '');
            setSuggestedModels([]);
        }
        // If only appSettings changed (e.g. auto-save) but selection is the same,
        // modelSearchText and suggestedModels will not be reset.

        // Update refs for the next render
        prevSelectedProviderTypeRef.current = selectedProviderTypeForEditing;
        prevSelectedPresetIdRef.current = selectedPresetIdForEditing;

    }, [selectedProviderTypeForEditing, selectedPresetIdForEditing, appSettings]);

    // Auto-save effect
    useEffect(() => {
        // Don't save if config is empty, lacks essential info, or hasn't changed
        if (!editingConfig || !editingConfig.providerType || !editingConfig.instanceId || 
            JSON.stringify(editingConfig) === JSON.stringify(initialEditingConfig)) {
            return;
        }

        // Debounce mechanism
        const handler = setTimeout(async () => {
            console.log('Auto-saving config (changed):', editingConfig);
            const configToSave: LLMProviderConfig = {
                instanceId: editingConfig.instanceId, 
                providerType: editingConfig.providerType,
                customName: editingConfig.customName,
                apiKey: editingConfig.apiKey || '',
                baseUrl: editingConfig.baseUrl || '',
                defaultModel: editingConfig.defaultModel || '',
                defaultParameters: editingConfig.defaultParameters || { ...DEFAULT_PARAMETERS_CV },
            };
            
            try {
                const saved = await window.llmConfigAPI.saveProviderConfig(configToSave);
                // Update local appSettings state to reflect the save, especially if instanceId was generated
                setAppSettings(prev => {
                    if (!prev) return null;
                    let newProviders = [...prev.llmSettings.providers];
                    let newPresets = [...prev.llmSettings.presets];
                    const baseProviderTypes = ['openrouter', 'ollama', 'openai-compatible'];

                    if (baseProviderTypes.includes(saved.instanceId)) { // Saved a base config
                        const index = newProviders.findIndex(p => p.instanceId === saved.instanceId);
                        if (index > -1) newProviders[index] = saved; else newProviders.push(saved);
                    } else { // Saved a preset
                        const index = newPresets.findIndex(p => p.instanceId === saved.instanceId);
                        if (index > -1) newPresets[index] = saved; else newPresets.push(saved);
                    }
                    return { ...prev, llmSettings: { ...prev.llmSettings, providers: newProviders, presets: newPresets }};
                });
                // Optionally, provide subtle feedback instead of alert
                // console.log(`Settings for "${saved.customName || saved.providerType}" auto-saved.`);
                setInitialEditingConfig(saved); // Update initial config to the saved state
            } catch (error) {
                console.error("Auto-save failed:", error);
                // Optionally notify user of save failure
            }
        }, 3000); // Increased debounce to 3 seconds

        // Cleanup function to clear the timeout if the component unmounts or editingConfig changes again
        return () => {
            clearTimeout(handler);
        };
    }, [editingConfig, initialEditingConfig, setAppSettings]); // Depend on editingConfig and initialEditingConfig


    const fetchModelsForConfig = async (config: Partial<LLMProviderConfig>) => {
        if (!config.providerType) return;
        if (config.providerType === 'openrouter' && !config.apiKey) { setAvailableModels([]); return; }
        if ((config.providerType === 'ollama' || config.providerType === 'openai-compatible') && !config.baseUrl) { setAvailableModels([]); return; }
        
        setIsLoadingModels(true);
        setAvailableModels([]);
        try {
            const result = await window.llmConfigAPI.listModels(config as LLMProviderConfig);
            if ('error' in result) console.error("Error listing models:", result.error);
            else setAvailableModels(result);
        } catch (error) { console.error("Failed to fetch models:", error); }
        finally { setIsLoadingModels(false); }
    };

    useEffect(() => {
        if (editingConfig?.providerType === 'openrouter' && editingConfig.apiKey) {
          fetchModelsForConfig(editingConfig);
        } else if ((editingConfig?.providerType === 'ollama' || editingConfig?.providerType === 'openai-compatible') && editingConfig.baseUrl) {
          fetchModelsForConfig(editingConfig);
        }
      }, [editingConfig?.apiKey, editingConfig?.baseUrl, editingConfig?.providerType]);


    const handleSelectProviderType = (type: ConfigProviderType) => {
        setSelectedProviderTypeForEditing(type);
        setSelectedPresetIdForEditing(null);
        handleSetActiveProvider(type); // Set active immediately
    };

    const handleSelectPreset = (presetId: string) => {
        setSelectedPresetIdForEditing(presetId);
        setSelectedProviderTypeForEditing(null);
        handleSetActiveProvider(presetId); // Set active immediately
    };
    
    const handleSetActiveProvider = async (instanceId: string | null) => {
        if (!appSettings) return;
        await window.llmConfigAPI.setActiveProvider(instanceId);
        const newAppSettings = {
            ...appSettings,
            llmSettings: { ...appSettings.llmSettings, activeProviderInstanceId: instanceId }
        };
        setAppSettings(newAppSettings);
         if (instanceId) {
            const activeConf = newAppSettings.llmSettings.providers.find(p=>p.instanceId === instanceId) || newAppSettings.llmSettings.presets.find(p=>p.instanceId === instanceId);
            // alert(`Provider "${activeConf?.customName || activeConf?.providerType}" is now active.`); // User feedback can be annoying
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setEditingConfig(prev => {
            let newConfig = { ...prev };
            if (name.startsWith('defaultParameters.')) {
                const paramName = name.split('.')[1];
                newConfig.defaultParameters = { ...(newConfig.defaultParameters || DEFAULT_PARAMETERS_CV), [paramName]: type === 'number' ? parseFloat(value) : value };
            } else if (type === 'checkbox') { // Though no checkboxes are planned for provider panel now
                newConfig = { ...newConfig, [name]: checked };
            } else if (type === 'number') {
                newConfig = { ...newConfig, [name]: parseFloat(value) };
            } else {
                newConfig = { ...newConfig, [name]: value };
            }
            
            if (name === 'defaultModel' && newConfig.providerType === 'openrouter') {
                setModelSearchText(value);
                if (value.trim() === '') setSuggestedModels([]);
                else setSuggestedModels(availableModels.filter(m => m.name.toLowerCase().includes(value.toLowerCase())).slice(0, 10));
            }
            return newConfig;
        });
    };

    const handleModelSuggestionClick = (modelId: string) => {
        setEditingConfig(prev => ({ ...prev, defaultModel: modelId }));
        setModelSearchText(modelId);
        setSuggestedModels([]);
    };

    // Removed handleSaveCurrentConfig function as saving is now automatic via useEffect

    const handleTestConnection = async () => {
        if (!editingConfig.providerType) return;
        setTestResult(null);
        const configToTest: LLMProviderConfig = {
            instanceId: editingConfig.instanceId || `${editingConfig.providerType}_config`,
            providerType: editingConfig.providerType,
            customName: editingConfig.customName,
            apiKey: editingConfig.apiKey, baseUrl: editingConfig.baseUrl,
            defaultModel: editingConfig.defaultModel || (editingConfig.providerType === 'ollama' && availableModels.length > 0 ? availableModels[0].id : 'openrouter/auto'),
            defaultParameters: editingConfig.defaultParameters || DEFAULT_PARAMETERS_CV,
        };
        const result = await window.llmConfigAPI.testConnection(configToTest);
        setTestResult(result);
    };

    const handleOpenPresetModal = () => setIsPresetModalOpen(true);
    const handleClosePresetModal = () => setIsPresetModalOpen(false);

    const restoreFocusToPanel = () => {
        configPanelRef.current?.focus();
    };

    const handleCreatePreset = async (presetName: string) => {
        if (!editingConfig.providerType) {
            alert("Cannot create preset from incomplete configuration.");
            return;
        }
        if (!appSettings) return;

        const newPresetConfig: LLMProviderConfig = {
            ...editingConfig, // current form state, ensure it's a full config
            providerType: editingConfig.providerType, // Explicitly ensure providerType is set
            apiKey: editingConfig.apiKey || '',
            baseUrl: editingConfig.baseUrl || '',
            defaultModel: editingConfig.defaultModel || '',
            defaultParameters: editingConfig.defaultParameters || { ...DEFAULT_PARAMETERS_CV },
            instanceId: uuidv4(),
            customName: presetName,
        };

        try {
            const savedPreset = await window.llmConfigAPI.saveProviderConfig(newPresetConfig);

            // Atomically update appSettings and set the new preset as active
            setAppSettings(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    llmSettings: {
                        ...prev.llmSettings,
                        presets: [...prev.llmSettings.presets, savedPreset],
                        activeProviderInstanceId: savedPreset.instanceId // Set new preset as active
                    }
                };
            });
            
            // Update local selection state for the UI
            setSelectedPresetIdForEditing(savedPreset.instanceId);
            setSelectedProviderTypeForEditing(null); // Clear base provider selection

            // Ensure the backend is notified about the active provider
            // This might be redundant if activeProviderInstanceId in appSettings already triggers this,
            // but explicit call ensures it if there's any complex effect dependency.
            // Given handleSetActiveProvider also updates appSettings, we should be careful.
            // The primary update to activeProviderInstanceId is now in the setAppSettings above.
            // We still need to inform the backend.
            await window.llmConfigAPI.setActiveProvider(savedPreset.instanceId);

            handleClosePresetModal();
            // Removed alert for smoother UX: alert(`Preset "${presetName}" created.`);
            // The UI will navigate to the new preset due to state changes.

        } catch (error) {
            console.error("Failed to create preset:", error);
            alert("Failed to create preset. See console for details.");
        }
    };

    // Opens the confirmation modal
    const handleDeletePreset = (presetId: string) => {
        if (!appSettings) return;
        const preset = appSettings.llmSettings.presets.find(p => p.instanceId === presetId);
        if (preset) {
            setPresetToDeleteDetails({ id: preset.instanceId, name: preset.customName || preset.providerType });
            setIsConfirmDeleteModalOpen(true);
        }
    };

    // Actually performs the deletion after confirmation
    const executeDeletePreset = async () => {
        if (!appSettings || !presetToDeleteDetails) return;

        const presetIdToDelete = presetToDeleteDetails.id;
        await window.llmConfigAPI.deletePreset(presetIdToDelete);

        const wasEditingPresetDeleted = selectedPresetIdForEditing === presetIdToDelete;
        const defaultProviderId: ConfigProviderType = 'openrouter';

        setAppSettings(prev => {
            if (!prev) return null;
            const newPresets = prev.llmSettings.presets.filter(p => p.instanceId !== presetIdToDelete);
            let newActiveId = prev.llmSettings.activeProviderInstanceId;

            if (newActiveId === presetIdToDelete) {
                newActiveId = defaultProviderId;
            }
            if (newActiveId === null && newPresets.length === 0 && prev.llmSettings.providers.some(p => p.providerType === defaultProviderId)) {
                newActiveId = defaultProviderId;
            }

            return {
                ...prev,
                llmSettings: {
                    ...prev.llmSettings,
                    presets: newPresets,
                    activeProviderInstanceId: newActiveId
                }
            };
        });

        if (wasEditingPresetDeleted) {
            setSelectedPresetIdForEditing(null);
            setSelectedProviderTypeForEditing(null); 
        }
        
        // Close modal and clean up state
        setIsConfirmDeleteModalOpen(false);
        setPresetToDeleteDetails(null);
        restoreFocusToPanel();
    };

    const handleCloseConfirmDeleteModal = () => {
        setIsConfirmDeleteModalOpen(false);
        setPresetToDeleteDetails(null);
        restoreFocusToPanel();
    };
    
    return (
        <div 
            ref={configPanelRef} 
            tabIndex={-1} // Make it focusable
            style={{ display: 'flex', height: 'calc(100% - 40px)', outline: 'none' /* Remove focus ring if not desired */ }}
        >
            <ProviderSidebar
                appSettings={appSettings}
                onSelectProviderType={handleSelectProviderType}
                onSelectPreset={handleSelectPreset}
                onDeletePreset={handleDeletePreset}
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
                // onSave={handleSaveCurrentConfig} // Removed
                onTestConnection={handleTestConnection}
                onMakePreset={handleOpenPresetModal}
            />
            <PresetModal
                isOpen={isPresetModalOpen}
                onClose={handleClosePresetModal}
                onSubmit={handleCreatePreset}
            />
            <ConfirmDeleteModal
                isOpen={isConfirmDeleteModalOpen}
                onClose={handleCloseConfirmDeleteModal}
                onConfirm={executeDeletePreset}
                presetName={presetToDeleteDetails?.name}
            />
        </div>
    );
};

export default ConnectionView;
