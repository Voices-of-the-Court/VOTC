import React from 'react';
import type { LLMProviderConfig, ILLMModel, ProviderType as ConfigProviderType } from '../../../main/llmProviders/types';

// Import reusable components that will remain separate
import ModelSelector from './ModelSelector';
import FormGroupInput from './FormGroupInput'; // Assuming FormGroupInput is used by inlined components
import { OpenRouterConfigFieldsComponent, OpenAICompatibleConfigFieldsComponent, OllamaConfigFieldsComponent } from './ConfigFields'
// --- Start Inlined Component Definitions ---

// Define ChangeHandler type (if not globally available)
type ChangeHandler = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;

interface CommonFieldProps {
    config: Partial<LLMProviderConfig>;
    onInputChange: ChangeHandler;
}

// PresetNameField (formerly PresetNameField.tsx)
const PresetNameFieldComponent: React.FC<CommonFieldProps> = ({ config, onInputChange }) => (
    <FormGroupInput
        id="customName"
        label="Preset Name:"
        type="text"
        name="customName"
        value={config.customName || ''}
        onChange={onInputChange}
        required
    />
);

// DefaultParameterFields (formerly DefaultParameterFields.tsx)
const DEFAULT_PARAMETERS_COMPONENT = { temperature: 0.7, max_tokens: 2048 };
const DefaultParameterFieldsComponent: React.FC<CommonFieldProps> = ({ config, onInputChange }) => (
    <>
        <h4>Default Parameters</h4>
        <FormGroupInput
            id="temperature"
            label="Temperature:"
            type="number"
            name="defaultParameters.temperature"
            step="0.1"
            min="0"
            max="2"
            value={config.defaultParameters?.temperature ?? DEFAULT_PARAMETERS_COMPONENT.temperature}
            onChange={onInputChange}
        />
        <FormGroupInput
            id="max_tokens"
            label="Max Tokens:"
            type="number"
            name="defaultParameters.max_tokens"
            step="1"
            min="1"
            value={config.defaultParameters?.max_tokens ?? DEFAULT_PARAMETERS_COMPONENT.max_tokens}
            onChange={onInputChange}
        />
    </>
);

// ActionButtons (formerly ActionButtons.tsx)
interface ActionButtonsComponentProps {
    onTestConnection: () => void;
    onMakePreset: () => void;
}
const ActionButtonsComponent: React.FC<ActionButtonsComponentProps> = ({ onTestConnection, onMakePreset }) => (
    <div className="form-actions">
        <button type="button" onClick={onTestConnection}>Test Connection</button>
        <button type="button" onClick={onMakePreset}>Make Preset from these Settings</button>
    </div>
);

// TestResultDisplay (formerly TestResultDisplay.tsx)
interface TestResultDisplayComponentProps {
    testResult: { success: boolean; message?: string; error?: string } | null;
}
const TestResultDisplayComponent: React.FC<TestResultDisplayComponentProps> = ({ testResult }) => {
    if (!testResult) return null;
    return (
        <p className={`test-result ${testResult.success ? 'success' : 'error'}`}>
            {testResult.message || testResult.error}
        </p>
    );
};

// --- End Inlined Component Definitions ---

// Provider Component Map using locally defined components
const ProviderFieldComponents: Record<ConfigProviderType, React.FC<CommonFieldProps>> = {
    openrouter: OpenRouterConfigFieldsComponent,
    'openai-compatible': OpenAICompatibleConfigFieldsComponent,
    ollama: OllamaConfigFieldsComponent,
};

interface ProviderConfigPanelProps {
    config: Partial<LLMProviderConfig>;
    availableModels: ILLMModel[];
    isLoadingModels: boolean;
    modelSearchText: string;
    suggestedModels: ILLMModel[];
    testResult: { success: boolean; message?: string; error?: string } | null;
    onInputChange: ChangeHandler;
    onModelSuggestionClick: (modelId: string) => void;
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
    onTestConnection,
    onMakePreset,
}) => {
    if (!config.providerType) {
        return <div className="config-panel-placeholder"><p>Select a provider or preset from the sidebar to configure.</p></div>;
    }

    const displayName = config.customName || config.providerType!.charAt(0).toUpperCase() + config.providerType!.slice(1);
    const isPreset = !!config.customName && config.instanceId !== config.providerType;

    const SpecificProviderFields = ProviderFieldComponents[config.providerType];

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Form submitted (auto-save handles actual saving)");
    };

    return (
        <div className="provider-config-panel">
            <h3>
                {isPreset ? `Preset: ${displayName}` : `${displayName} Configuration`}
                {isPreset && <small className="preset-type-indicator"> (Type: {config.providerType})</small>}
            </h3>
            <form onSubmit={handleFormSubmit}>
                {isPreset && (
                    <PresetNameFieldComponent
                        config={config}
                        onInputChange={onInputChange}
                    />
                )}

                {SpecificProviderFields && (
                    <SpecificProviderFields
                        config={config}
                        onInputChange={onInputChange}
                    />
                )}

                <ModelSelector
                    providerType={config.providerType}
                    defaultModelValue={config.defaultModel || ''}
                    modelSearchText={modelSearchText}
                    suggestedModels={suggestedModels}
                    apiKey={config.apiKey}
                    isLoadingModels={isLoadingModels}
                    availableModels={availableModels}
                    onInputChange={onInputChange}
                    onModelSuggestionClick={onModelSuggestionClick}
                />

                <DefaultParameterFieldsComponent
                    config={config}
                    onInputChange={onInputChange}
                />

                <ActionButtonsComponent
                    onTestConnection={onTestConnection}
                    onMakePreset={onMakePreset}
                />

                <TestResultDisplayComponent testResult={testResult} />
            </form>
        </div>
    );
};

export default ProviderConfigPanel;
