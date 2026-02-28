import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { LLMProviderConfig } from '../../../main/llmProviders/types';
import { useConfigStore, useAppSettings } from '../store/useConfigStore';
import { DEFAULT_PARAMETERS } from '../../../main/llmProviders/types';

import ModelSelector from './ModelSelector';
import ContextLengthField from './ContextLengthField';
import FormGroupInput from './FormGroupInput';
import Tooltip from './Tooltip';
import { OpenRouterConfigFieldsComponent, OpenAICompatibleConfigFieldsComponent, OllamaConfigFieldsComponent, DeepseekConfigFieldsComponent } from './ConfigFields';

const Player2OpenAppButton: React.FC = () => {
  const { t } = useTranslation();
  
  const handleOpenPlayer2 = async () => {
    try {
      const result = await window.electronAPI.openExternal('player2://');
      if (!result.success) {
        console.error('Failed to open Player2 app:', result.error);
      }
    } catch (error) {
      console.error('Error opening Player2 app:', error);
    }
  };

  return (
    <div className="form-group">
      <button type="button" onClick={handleOpenPlayer2} className="open-player2-button">
        {t('connection.openPlayer2App', 'Open Player2 App')}
      </button>
      <small className="form-help-text">
        {t('connection.player2AppHelp', 'Click to open the Player2 application. Make sure it is installed and running.')}
      </small>
    </div>
  );
};

const Player2HealthStatusBar: React.FC<{
  status: {
    status: 'idle' | 'checking' | 'healthy' | 'error';
    clientVersion?: string;
    error?: string;
    code?: number;
  } | null;
  onCheck: () => void;
}> = ({ status, onCheck }) => {
  const { t } = useTranslation();

  if (!status) return null;

  const statusLabel = (() => {
    if (status.status === 'healthy') return t('connection.player2HealthOnline', 'online');
    if (status.status === 'error') return t('connection.player2HealthErrorShort', 'error');
    if (status.status === 'checking') return t('connection.player2HealthCheckingShort', 'checking');
    return t('connection.player2HealthIdleShort', 'idle');
  })();

  const statusDetail = (() => {
    if (status.status === 'healthy') {
      return status.clientVersion ? `v${status.clientVersion}` : undefined;
    }
    if (status.status === 'error') {
      return status.error || undefined;
    }
    return undefined;
  })();

  return (
    <div className={`player2-health-bar ${status.status}`}>
      <div className="player2-health-left">
        <span className="player2-health-dot" aria-hidden="true" />
        <span className="player2-health-text">{statusLabel}</span>
        {statusDetail && <span className="player2-health-detail">{statusDetail}</span>}
      </div>
      <button type="button" className="player2-health-refresh" onClick={onCheck}>
        {t('connection.player2HealthRefresh', 'Refresh')}
      </button>
    </div>
  );
};

type ChangeHandler = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;

interface CommonFieldProps {
  config: Partial<LLMProviderConfig>;
  onInputChange: ChangeHandler;
}

const PresetNameFieldComponent: React.FC<CommonFieldProps & { t: any }> = ({ config, onInputChange, t }) => (
  <FormGroupInput
    id="customName"
    label={t('connection.presetName') + ':'}
    type="text"
    name="customName"
    value={config.customName || ''}
    onChange={onInputChange}
    required
  />
);

const DefaultParameterFieldsComponent: React.FC<CommonFieldProps & { t: any }> = ({ config, onInputChange, t }) => (
  <>
    <h4>{t('connection.defaultParameters')}</h4>
    <FormGroupInput
      id="temperature"
      label={t('connection.temperature') + ':'}
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
      label={t('connection.maxTokens') + ':'}
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
  providerType?: string;
  t: any;
}

const ActionButtonsComponent: React.FC<ActionButtonsComponentProps> = ({ onTestConnection, onMakePreset, providerType, t }) => (
  <div className="form-actions">
    <button type="button" onClick={onTestConnection}>{t('connection.testConnection')}</button>
    {providerType !== 'player2' && (
      <button type="button" onClick={onMakePreset}>{t('connection.makePreset')}</button>
    )}
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
  deepseek: DeepseekConfigFieldsComponent,
};

interface ProviderConfigPanelProps {
  config: Partial<LLMProviderConfig>;
  testResult: { success: boolean; message?: string; error?: string } | null;
  onInputChange: ChangeHandler;
  onContextLengthChange: (contextLength: number | undefined) => void;
  onTestConnection: () => void;
  onMakePreset: () => void;
}

const ProviderConfigPanel: React.FC<ProviderConfigPanelProps> = (props) => {
  const { t } = useTranslation();
  const appSettings = useAppSettings();
  const {
    config,
    testResult,
    onInputChange,
    onContextLengthChange,
    onTestConnection,
    onMakePreset,
  } = props;
  const selectCK3Folder = useConfigStore((state) => state.selectCK3Folder);
  const player2Health = useConfigStore((state) => state.player2Health);
  const checkPlayer2Health = useConfigStore((state) => state.checkPlayer2Health);

  const updateEditingConfig = useConfigStore((state) => state.updateEditingConfig);
  const handleSelectCK3Folder = async () => {
    await selectCK3Folder();
  };

  if (!config.providerType) {
    return (
      <div className="config-panel-placeholder">
        <p>{t('config.selectProviderOrPreset')}</p>
      </div>
    );
  }

  const displayName = config.customName || config.providerType!.charAt(0).toUpperCase() + config.providerType!.slice(1);
  const isPreset = !!config.customName && config.instanceId !== config.providerType;
  const SpecificProviderFields = ProviderFieldComponents[config.providerType];

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  useEffect(() => {
    if (config.providerType === 'player2') {
      checkPlayer2Health();
    }
  }, [config.providerType, checkPlayer2Health]);

  const hasSelectedPath = appSettings?.ck3UserFolderPath && appSettings.ck3UserFolderPath.trim() !== '';

  return (
    <div className="provider-config-panel">
      <div className="form-group ck3-folder-section">
        <label>
          {hasSelectedPath ? t('settings.selectedCK3FolderTitle') : t('settings.selectCK3UserFolderTitle')}
          <Tooltip text={t('settings.ck3UserFolderHelp')} position="bottom" />
        </label>
        <div className={`ck3-path-display ${hasSelectedPath ? 'selected' : ''}`} onClick={handleSelectCK3Folder}>
          {hasSelectedPath ? (
            <span className="selected-path">{appSettings.ck3UserFolderPath}</span>
          ) : (
            <span className="example-path-text">
              C:\Users\<span className="example-highlight">{t('settings.ck3UserFolderExample')}</span>\Documents\Paradox Interactive\Crusader Kings III
            </span>
          )}
        </div>
      </div>

      <h3>
        {isPreset ? `${t('config.preset')}: ${displayName}` : `${displayName} ${t('config.configuration')}`}
        {isPreset && <small className="preset-type-indicator"> ({t('config.type')}: {config.providerType})</small>}
      </h3>
      
      <form onSubmit={handleFormSubmit}>
        {isPreset && <PresetNameFieldComponent config={config} onInputChange={onInputChange} t={t} />}
        
        {SpecificProviderFields && <SpecificProviderFields config={config} onInputChange={onInputChange} />}
        
        {config.providerType === 'player2' ? (
          <>
            <Player2OpenAppButton />
            <Player2HealthStatusBar status={player2Health} onCheck={checkPlayer2Health} />
          </>
        ) : (
          <ModelSelector
            config={config}
            onInputChange={onInputChange}
            onModelSelect={(modelId) => updateEditingConfig({ defaultModel: modelId })}
          />
        )}
        
        <ContextLengthField
          config={config}
          onContextLengthChange={onContextLengthChange}
        />
        
        {/* Actions Schema Type Toggle */}
        <div className="form-group">
          <label htmlFor="useMinimizedActionsSchema">
            {t('connection.actionsSchemaType')}
            <Tooltip
              text={t('connection.actionsSchemaTypeHelp')}
              position="top"
            />
          </label>
          <select
            id="useMinimizedActionsSchema"
            name="useMinimizedActionsSchema"
            value={
              config.useMinimizedActionsSchema === undefined
                ? 'auto'
                : config.useMinimizedActionsSchema
                  ? 'minimized'
                  : 'advanced'
            }
            onChange={(e) => {
              const value = e.target.value;
              const newValue =
                value === 'auto' ? undefined :
                value === 'minimized' ? true : false;
              updateEditingConfig({ useMinimizedActionsSchema: newValue });
            }}
            className="schema-type-select"
          >
            <option value="auto">{t('connection.actionsSchemaAuto')}</option>
            <option value="advanced">{t('connection.actionsSchemaAdvanced')}</option>
            <option value="minimized">{t('connection.actionsSchemaMinimized')}</option>
          </select>
        </div>
        
        <DefaultParameterFieldsComponent config={config} onInputChange={onInputChange} t={t} />
        
        <ActionButtonsComponent onTestConnection={onTestConnection} onMakePreset={onMakePreset} providerType={config.providerType} t={t} />
        
        <TestResultDisplayComponent testResult={testResult} />
      </form>
    </div>
  );
};

export default ProviderConfigPanel;
