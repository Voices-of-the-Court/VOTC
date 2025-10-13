import React, { useState, useEffect } from 'react';
import type { LLMProviderConfig, ILLMModel } from '@llmTypes';
import { useConfigStore, useModelState } from '../store/useConfigStore';

interface ModelSelectorProps {
  config: Partial<LLMProviderConfig>;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onModelSelect: (modelId: string) => void;
}

const getCacheKey = (config: Partial<LLMProviderConfig>): string => {
  if (config.providerType === 'openrouter') return 'openrouter';
  return config.instanceId || '';
};

const ModelSelector: React.FC<ModelSelectorProps> = ({
  config,
  onInputChange,
  onModelSelect,
}) => {
  const { isLoadingModels, getCachedModels } = useModelState();
  const [searchText, setSearchText] = useState(config.defaultModel || '');
  const [suggestions, setSuggestions] = useState<ILLMModel[]>([]);
  
  const cacheKey = getCacheKey(config);
  const availableModels = getCachedModels(cacheKey);

  // Update search text when config changes
  useEffect(() => {
    setSearchText(config.defaultModel || '');
  }, [config.defaultModel]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    onInputChange(e);

    // Show suggestions for OpenRouter and OpenAI-compatible
    if (config.providerType === 'openrouter' || config.providerType === 'openai-compatible') {
      if (value.trim() === '') {
        setSuggestions([]);
      } else {
        setSuggestions(
          availableModels.filter(m => 
            m.id.toLowerCase().includes(value.toLowerCase()) ||
            m.name.toLowerCase().includes(value.toLowerCase())
          ).slice(0, 10) // Limit to 10 suggestions
        );
      }
    }
  };

  const handleSuggestionClick = (modelId: string) => {
    setSearchText(modelId);
    onModelSelect(modelId);
    setSuggestions([]);
  };

  const canShowSuggestions = 
    (config.providerType === 'openrouter' && config.apiKey) ||
    (config.providerType === 'openai-compatible' && config.baseUrl);

  return (
    <div className="form-group">
      <label htmlFor="defaultModel">Default Model ID:</label>
      
      {config.providerType === 'ollama' ? (
        <select
          id="defaultModel"
          name="defaultModel"
          value={config.defaultModel || ''}
          onChange={onInputChange}
        >
          <option value="">{isLoadingModels ? 'Loading...' : 'Select a model'}</option>
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
            value={searchText}
            onChange={handleSearchChange}
            placeholder={
              config.providerType === 'openrouter' 
                ? 'Search OpenRouter models...' 
                : 'Search or enter model ID...'
            }
            autoComplete="off"
          />
          
          {config.providerType === 'openrouter' && !config.apiKey && (
            <div className="api-key-required-info">
              <img src="assets/Alert.png" alt="Alert" />
              <span>API Key required to search models.</span>
            </div>
          )}
          
          {config.providerType === 'openai-compatible' && !config.baseUrl && (
            <div className="api-key-required-info">
              <img src="assets/Alert.png" alt="Alert" />
              <span>Base URL required to search models.</span>
            </div>
          )}
          
          {canShowSuggestions && suggestions.length > 0 && (
            <ul className="suggestions-list">
              {suggestions.map(model => (
                <li key={model.id} onClick={() => handleSuggestionClick(model.id)}>
                  <div className="suggestion-item">
                    <span className="model-id">{model.id}</span>
                    {model.name !== model.id && (
                      <small className="model-name">{model.name}</small>
                    )}
                  </div>
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
