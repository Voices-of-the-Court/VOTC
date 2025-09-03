import { useState, useEffect, useCallback } from 'react';
import type { LLMProviderConfig, ILLMModel } from '../../../../main/llmProviders/types';

interface UseModelManagementProps {
    editingConfig: Partial<LLMProviderConfig>;
}

export const useModelManagement = ({ editingConfig }: UseModelManagementProps) => {
    const [availableModels, setAvailableModels] = useState<ILLMModel[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [modelSearchText, setModelSearchText] = useState('');
    const [suggestedModels, setSuggestedModels] = useState<ILLMModel[]>([]);

    const fetchModelsForConfig = useCallback(async (config: Partial<LLMProviderConfig>) => {
        if (!config.providerType) return;
        // Specific conditions for fetching models based on provider type
        if (config.providerType === 'openrouter' && !config.apiKey) {
            setAvailableModels([]);
            setSuggestedModels([]); // Clear suggestions if API key is missing
            return;
        }
        if ((config.providerType === 'ollama' || config.providerType === 'openai-compatible') && !config.baseUrl) {
            setAvailableModels([]);
            setSuggestedModels([]); // Clear suggestions if baseUrl is missing
            return;
        }

        setIsLoadingModels(true);
        setAvailableModels([]); // Clear previous models
        setSuggestedModels([]); // Clear previous suggestions
        try {
            const result = await window.llmConfigAPI.listModels(config as LLMProviderConfig);
            if ('error' in result) {
                console.error("Error listing models:", result.error);
                setAvailableModels([]);
            } else {
                setAvailableModels(result);
            }
        } catch (error) {
            console.error("Failed to fetch models:", error);
            setAvailableModels([]);
        } finally {
            setIsLoadingModels(false);
        }
    }, []); // Empty dependency array as it uses config passed as argument

    // Effect to fetch models when relevant parts of editingConfig change
    useEffect(() => {
        if (editingConfig?.providerType) {
            fetchModelsForConfig(editingConfig);
        } else {
            // Clear models if no provider type (e.g., when no config is selected)
            setAvailableModels([]);
            setSuggestedModels([]);
        }
        // Reset model search text when the config itself changes (e.g., selecting a new provider)
        // This should ideally be tied to a more direct indicator of "config selection changed"
        // For now, linking to editingConfig.defaultModel change or providerType change
        setModelSearchText(editingConfig?.defaultModel || '');

    }, [editingConfig?.providerType, editingConfig?.apiKey, editingConfig?.baseUrl, editingConfig?.instanceId, fetchModelsForConfig]);
    // Added editingConfig.instanceId to re-trigger if the selected preset/provider changes,
    // which implies editingConfig.defaultModel might also change.

    // Effect to update modelSearchText when editingConfig.defaultModel changes externally
    // (e.g. when a new provider/preset is selected, its defaultModel populates the editingConfig)
    useEffect(() => {
        setModelSearchText(editingConfig?.defaultModel || '');
    }, [editingConfig?.defaultModel]);


    const handleModelSearchChange = useCallback((searchText: string) => {
        setModelSearchText(searchText);
        if (editingConfig?.providerType === 'openrouter') {
            if (searchText.trim() === '') {
                setSuggestedModels([]);
            } else {
                setSuggestedModels(
                    availableModels
                        .filter(m => m.name.toLowerCase().includes(searchText.toLowerCase()))
                        .slice(0, 10)
                );
            }
        } else {
            setSuggestedModels([]); // No suggestions for other types for now
        }
    }, [editingConfig?.providerType, availableModels]);


    return {
        availableModels,
        isLoadingModels,
        modelSearchText,
        setModelSearchText: handleModelSearchChange, // Expose the handler for direct use
        suggestedModels,
        setSuggestedModels, // Allow direct manipulation if needed (e.g., clearing on focus out)
        fetchModelsForConfig, // Expose if manual refresh is needed
    };
};
