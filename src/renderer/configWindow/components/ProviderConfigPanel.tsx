import React from 'react';
import type { LLMProviderConfig, ILLMModel, ProviderType as ConfigProviderType } from '../../../main/llmProviders/types';

const DEFAULT_PARAMETERS_PANEL = { temperature: 0.7, max_tokens: 2048 };

interface ProviderConfigPanelProps {
    config: Partial<LLMProviderConfig>; // The current config being edited (base or preset)
    availableModels: ILLMModel[];
    isLoadingModels: boolean;
    modelSearchText: string; // For OpenRouter suggestions
    suggestedModels: ILLMModel[]; // For OpenRouter suggestions
    testResult: { success: boolean; message?: string; error?: string } | null;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    onModelSuggestionClick: (modelId: string) => void;
    onSave: (e: React.FormEvent) => void;
    onTestConnection: () => void;
    onMakePreset: () => void;
}

const ProviderConfigPanel: React.FC<ProviderConfigPanelProps> = ({
    config,
    availableModels,
    isLoadingModels,
    modelSearchText,
    suggestedModels,
    testResult,
    onInputChange,
    onModelSuggestionClick,
    onSave,
    onTestConnection,
    onMakePreset,
}) => {
    if (!config.providerType) {
        return <div className="config-panel-placeholder"><p>Select a provider or preset from the sidebar to configure.</p></div>;
    }

    // For base provider types, customName is not directly part of their config from LLMSettings.
    // It's derived or fixed. For presets, it's a key property.
    const displayName = config.customName || config.providerType!.charAt(0).toUpperCase() + config.providerType!.slice(1);
    const isPreset = !!config.customName && config.instanceId !== config.providerType;


    return (
        <div className="provider-config-panel">
            <h3>
                {isPreset ? `Preset: ${displayName}` : `${displayName} Configuration`}
                {isPreset && <small className="preset-type-indicator"> (Type: {config.providerType})</small>}
            </h3>
            <form onSubmit={onSave}>
                {isPreset && ( // Allow editing customName only for presets
                    <div className="form-group">
                        <label htmlFor="customName">Preset Name:</label>
                        <input
                            type="text"
                            id="customName"
                            name="customName"
                            value={config.customName || ''}
                            onChange={onInputChange}
                            required
                        />
                    </div>
                )}

                {config.providerType === 'openrouter' && (
                    <div className="form-group">
                        <label htmlFor="apiKey">OpenRouter API Key:</label>
                        <input
                            type="password"
                            id="apiKey"
                            name="apiKey"
                            value={config.apiKey || ''}
                            onChange={onInputChange}
                            placeholder="sk-or-..."
                        />
                    </div>
                )}

                {config.providerType === 'openai-compatible' && (
                    <>
                        <div className="form-group">
                            <label htmlFor="baseUrl">Base URL:</label>
                            <input
                                type="text"
                                id="baseUrl"
                                name="baseUrl"
                                value={config.baseUrl || ''}
                                onChange={onInputChange}
                                placeholder="e.g., https://api.example.com/v1"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="apiKey">API Key (Optional):</label>
                            <input
                                type="password"
                                id="apiKey"
                                name="apiKey"
                                value={config.apiKey || ''}
                                onChange={onInputChange}
                            />
                        </div>
                    </>
                )}

                {config.providerType === 'ollama' && (
                    <div className="form-group">
                        <label htmlFor="baseUrl">Ollama Base URL:</label>
                        <input
                            type="text"
                            id="baseUrl"
                            name="baseUrl"
                            value={config.baseUrl || 'http://localhost:11434'}
                            onChange={onInputChange}
                            required
                        />
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="defaultModel">Default Model ID:</label>
                    {config.providerType === 'ollama' ? (
                        <select
                            id="defaultModel"
                            name="defaultModel"
                            value={config.defaultModel || ''}
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
                                name="defaultModel" // This name is used by onInputChange
                                value={modelSearchText} // Display search text
                                onChange={onInputChange} // Use onInputChange, which handles modelSearchText and suggestedModels
                                placeholder={config.providerType === 'openrouter' ? "Search OpenRouter models..." : "Enter model ID"}
                                autoComplete="off"
                                // disabled={config.providerType === 'openrouter' && !config.apiKey} // Disable if OpenRouter and no API key
                            />
                            {config.providerType === 'openrouter' && !config.apiKey && (
                                <div className="api-key-required-info">
                                    <img src="../assets/Alert.png" alt="Alert" /> 
                                    <span>API Key required to search models.</span>
                                </div>
                            )}
                            {config.providerType === 'openrouter' && config.apiKey && suggestedModels.length > 0 && ( // Only show suggestions if key exists
                                <ul className="suggestions-list">
                                    {suggestedModels.map(model => (
                                        <li key={model.id} onClick={() => onModelSuggestionClick(model.id)}>
                                            {model.name} {model.isFree ? '(Free)' : ''}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                <h4>Default Parameters</h4>
                <div className="form-group">
                    <label htmlFor="temperature">Temperature:</label>
                    <input
                        type="number"
                        id="temperature"
                        name="defaultParameters.temperature"
                        step="0.1"
                        min="0"
                        max="2"
                        value={config.defaultParameters?.temperature ?? DEFAULT_PARAMETERS_PANEL.temperature}
                        onChange={onInputChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="max_tokens">Max Tokens:</label>
                    <input
                        type="number"
                        id="max_tokens"
                        name="defaultParameters.max_tokens"
                        step="1"
                        min="1"
                        value={config.defaultParameters?.max_tokens ?? DEFAULT_PARAMETERS_PANEL.max_tokens}
                        onChange={onInputChange}
                    />
                </div>
                {/* Global stream toggle is in Settings tab, not per-provider */}

                <div className="form-actions">
                    {/* <button type="submit">Save Settings</button> Removed, will save on change */}
                    <button type="button" onClick={onTestConnection}>Test Connection</button>
                    <button type="button" onClick={onMakePreset}>Make Preset from these Settings</button>
                </div>
                {testResult && (
                    <p className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                        {testResult.message || testResult.error}
                    </p>
                )}
            </form>
        </div>
    );
};

export default ProviderConfigPanel;
