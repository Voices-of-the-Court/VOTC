import React from 'react';
import type { LLMProviderConfig } from '@llmTypes';
import { useConfigStore } from '../store/useConfigStore';

import ModelSelector from './ModelSelector';
import ContextLengthField from './ContextLengthField';
import FormGroupInput from './FormGroupInput';
import { OpenRouterConfigFieldsComponent, OpenAICompatibleConfigFieldsComponent, OllamaConfigFieldsComponent } from './ConfigFields';

const DEFAULT_PARAMETERS = { temperature: 0.7, max_tokens: 2048 };

type ChangeHandler = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;

interface CommonFieldProps {
  config: Partial<LLMProviderConfig>;
  onInputChange: ChangeHandler;
}

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
      value={config.defaultParameters?.temperature ?? DEFAULT_PARAMETERS.temperature}
      onChange={onInputChange}
    />
    <FormGroupInput
      id="max_tokens"
      label="Max Tokens:"
      type="number"
      name="defaultParameters.max_tokens"
      step="1"
      min="1"
      value={config.defaultParameters?.max_tokens ?? DEFAULT_PARAMETERS.max_tokens}
      onChange={onInputChange}
    />
  </>
);

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

const ProviderFieldComponents: Record<string, React.FC<CommonFieldProps>> = {
  openrouter: OpenRouterConfigFieldsComponent,
  'openai-compatible': OpenAICompatibleConfigFieldsComponent,
  ollama: OllamaConfigFieldsComponent,
};

interface ProviderConfigPanelProps {
  config: Partial<LLMProviderConfig>;
  testResult: { success: boolean; message?: string; error?: string } | null;
  onInputChange: ChangeHandler;
  onContextLengthChange: (contextLength: number | undefined) => void;
  onTestConnection: () => void;
  onMakePreset: () => void;
}

const ProviderConfigPanel: React.FC<ProviderConfigPanelProps> = ({
  config,
  testResult,
  onInputChange,
  onContextLengthChange,
  onTestConnection,
  onMakePreset,
}) => {
  const updateEditingConfig = useConfigStore((state) => state.updateEditingConfig);

  if (!config.providerType) {
    return (
      <div className="config-panel-placeholder">
        <p>Select a provider or preset from the sidebar to configure.</p>
      </div>
    );
  }

  const displayName = config.customName || config.providerType!.charAt(0).toUpperCase() + config.providerType!.slice(1);
  const isPreset = !!config.customName && config.instanceId !== config.providerType;
  const SpecificProviderFields = ProviderFieldComponents[config.providerType];

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="provider-config-panel">
      <h3>
        {isPreset ? `Preset: ${displayName}` : `${displayName} Configuration`}
        {isPreset && <small className="preset-type-indicator"> (Type: {config.providerType})</small>}
      </h3>
      
      <form onSubmit={handleFormSubmit}>
        {isPreset && <PresetNameFieldComponent config={config} onInputChange={onInputChange} />}
        
        {SpecificProviderFields && <SpecificProviderFields config={config} onInputChange={onInputChange} />}
        
        <ModelSelector
          config={config}
          onInputChange={onInputChange}
          onModelSelect={(modelId) => updateEditingConfig({ defaultModel: modelId })}
        />
        
        <ContextLengthField
          config={config}
          onContextLengthChange={onContextLengthChange}
        />
        
        <DefaultParameterFieldsComponent config={config} onInputChange={onInputChange} />
        
        <ActionButtonsComponent onTestConnection={onTestConnection} onMakePreset={onMakePreset} />
        
        <TestResultDisplayComponent testResult={testResult} />
      </form>
    </div>
  );
};

export default ProviderConfigPanel;
