import React from 'react';
import type { ILLMModel, ProviderType as ConfigProviderType } from '../../../main/llmProviders/types';

interface ModelSelectorProps {
    providerType?: ConfigProviderType;
    defaultModelValue: string; // Current value of the defaultModel field
    modelSearchText: string;   // Text for search input, especially for OpenRouter
    suggestedModels: ILLMModel[];
    apiKey?: string; // Needed to check if OpenRouter can search
    isLoadingModels: boolean;
    availableModels: ILLMModel[];
    onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void; // For general input change
    onModelSuggestionClick: (modelId: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
    providerType,
    defaultModelValue,
    modelSearchText,
    suggestedModels,
    apiKey,
    isLoadingModels,
    availableModels,
    onInputChange,
    onModelSuggestionClick,
}) => {
    return (
        <div className="form-group">
            <label htmlFor="defaultModel">Default Model ID:</label>
            {providerType === 'ollama' ? (
                <select
                    id="defaultModel"
                    name="defaultModel"
                    value={defaultModelValue}
                    onChange={onInputChange}
                >
                    <option value="">{isLoadingModels ? "Loading..." : "Select a model"}</option>
                    {availableModels.map(model => (
                        <option key={model.id} value={model.id}>{model.name}</option> 
                    ))}
                </select>
            ) : (
                <div className="model-search-container">
                    <input
                        type="text"
                        id="defaultModel"
                        name="defaultModel"
                        value={modelSearchText} // Use modelSearchText for the input value
                        onChange={onInputChange} // This should update modelSearchText and potentially defaultModel in parent
                        placeholder={providerType === 'openrouter' ? "Search OpenRouter models..." : "Enter model ID"}
                        autoComplete="off"
                    />
                    {providerType === 'openrouter' && !apiKey && (
                        <div className="api-key-required-info">
                            <img src="../assets/Alert.png" alt="Alert" />
                            <span>API Key required to search models.</span>
                        </div>
                    )}
                    {providerType === 'openrouter' && apiKey && suggestedModels.length > 0 && (
                        <ul className="suggestions-list">
                            {suggestedModels.map(model => (
                                <li key={model.id} onClick={() => onModelSuggestionClick(model.id)}>
                                    {model.id}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};

export default ModelSelector;
