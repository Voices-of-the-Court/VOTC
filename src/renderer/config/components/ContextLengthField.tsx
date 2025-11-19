import React, { useState, useEffect } from 'react';
import type { LLMProviderConfig } from '@llmTypes';
import { useConfigStore } from '../store/useConfigStore';

interface ContextLengthFieldProps {
  config: Partial<LLMProviderConfig>;
  onContextLengthChange: (contextLength: number | undefined) => void;
}

const getCacheKey = (config: Partial<LLMProviderConfig>): string => {
  if (config.providerType === 'openrouter') return 'openrouter';
  return config.instanceId || '';
};

const ContextLengthField: React.FC<ContextLengthFieldProps> = ({
  config,
  onContextLengthChange,
}) => {
  const getCachedModels = useConfigStore((state) => state.getCachedModels);
  const [contextLength, setContextLength] = useState<string>('');
  const [maxContextLength, setMaxContextLength] = useState<number>(90000);
  const [isCustom, setIsCustom] = useState<boolean>(false);

  const cacheKey = getCacheKey(config);
  const availableModels = getCachedModels(cacheKey);
  const currentModel = availableModels.find(model => model.id === config.defaultModel);

  useEffect(() => {
    if (currentModel?.contextLength) {
      setMaxContextLength(currentModel.contextLength);
    }

    if (config.customContextLength !== undefined) {
      setContextLength(config.customContextLength.toString());
      setIsCustom(true);
    } else {
      setContextLength('');
      setIsCustom(false);
    }
  }, [config.defaultModel, config.customContextLength, currentModel]);

  const handleContextLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setContextLength(value);

    if (value === '') {
      setIsCustom(false);
      onContextLengthChange(undefined);
      return;
    }

    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue <= 0) return;

    setIsCustom(true);
    onContextLengthChange(numValue);
  };

  const handleClearCustom = () => {
    setContextLength('');
    setIsCustom(false);
    onContextLengthChange(undefined);
  };

  const numValue = parseInt(contextLength, 10);
  const exceedsMax = !isNaN(numValue) && numValue > maxContextLength;
  const placeholder = currentModel?.contextLength
    ? `Default: ${currentModel.contextLength}`
    : 'Default: 90000';

  return (
    <div className="form-group">
      <label htmlFor="customContextLength">
        Context Length (tokens):
        {isCustom && <span className="custom-indicator" title="Custom context length set">★</span>}
      </label>
      <div className="context-length-input-container">
        <input
          type="number"
          id="customContextLength"
          name="customContextLength"
          value={contextLength}
          onChange={handleContextLengthChange}
          placeholder={placeholder}
          min="1"
          max={maxContextLength}
        />
        {isCustom && (
          <button
            type="button"
            className="clear-custom-btn"
            onClick={handleClearCustom}
            title="Clear custom context length"
          >
            ✕
          </button>
        )}
      </div>

      {exceedsMax && (
        <div className="context-length-warning">
          ⚠️ Context length exceeds model's maximum ({maxContextLength})
        </div>
      )}
    </div>
  );
};

export default ContextLengthField;
