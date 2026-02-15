import React from 'react';
import type { LLMProviderConfig } from '@llmTypes';
import FormGroupInput from './FormGroupInput'; // Assuming FormGroupInput is used

// Define ChangeHandler type (if not globally available or imported from a common types file)
type ChangeHandler = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;

interface CommonFieldProps {
    config: Partial<LLMProviderConfig>;
    onInputChange: ChangeHandler;
}

export const OpenRouterConfigFieldsComponent: React.FC<CommonFieldProps> = ({ config, onInputChange }) => (
  <FormGroupInput
    id="apiKey"
    label="OpenRouter API Key:"
    type="password"
    name="apiKey"
    value={config.apiKey || ''}
    onChange={onInputChange}
    placeholder="sk-or-..."
  />
);

export const OpenAICompatibleConfigFieldsComponent: React.FC<CommonFieldProps> = ({ config, onInputChange }) => (
    <>
        <FormGroupInput
            id="baseUrl"
            label="Base URL:"
            type="text"
            name="baseUrl"
            value={config.baseUrl || ''}
            onChange={onInputChange}
            placeholder="e.g., https://api.example.com/v1"
        />
        <FormGroupInput
            id="apiKey"
            label="API Key (Optional):"
            type="password"
            name="apiKey"
            value={config.apiKey || ''}
            onChange={onInputChange}
        />
    </>
);

export const OllamaConfigFieldsComponent: React.FC<CommonFieldProps> = ({ config, onInputChange }) => (
    <FormGroupInput
        id="baseUrl"
        label="Ollama Base URL:"
        type="text"
        name="baseUrl"
        value={config.baseUrl || 'http://localhost:11434'}
        onChange={onInputChange}
        required
    />
);

export const DeepseekConfigFieldsComponent: React.FC<CommonFieldProps> = ({ config, onInputChange }) => (
    <FormGroupInput
        id="apiKey"
        label="Deepseek API Key:"
        type="password"
        name="apiKey"
        value={config.apiKey || ''}
        onChange={onInputChange}
        placeholder="sk-..."
    />
);
