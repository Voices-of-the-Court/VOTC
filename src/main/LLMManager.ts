import Store, { Schema } from 'electron-store';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs for provider configs
import path from 'path';
import {
  AppSettings,
  LLMSettings,
  LLMProviderConfig,
  ILLMProvider,
  ILLMCompletionRequest,
  ILLMOutput,
  ILLMModel,
  // OpenRouterConfig,
  // OllamaConfig,
  // OpenAICompatibleConfig
} from './llmProviders/types';
import { OpenRouterProvider } from './llmProviders/OpenRouterProvider';
import { OpenAICompatibleProvider } from './llmProviders/OpenAICompatibleProvider';
import { OllamaProvider } from './llmProviders/OllamaProvider';

// Define the schema for electron-store for type safety
const baseProviderConfigSchema = {
  type: 'object' as const,
  properties: {
    instanceId: { type: 'string' as const },
    providerType: { type: 'string' as const, enum: ['openrouter', 'openai-compatible', 'ollama'] },
    customName: { type: 'string' as const },
    apiKey: { type: 'string' as const },
    baseUrl: { type: 'string' as const },
    defaultModel: { type: 'string' as const },
    defaultParameters: { type: 'object' as const },
  },
  required: ['instanceId', 'providerType']
};

const schema: Schema<AppSettings> = {
	llmSettings: {
		type: 'object',
    default: {
      providers: [], // Will be initialized with 3 base configs
      presets: [],
      activeProviderInstanceId: null,
    } as LLMSettings,
		properties: {
			providers: { // Stores the 3 base configurations
				type: 'array',
        default: [],
        items: baseProviderConfigSchema
			},
      presets: { // Stores user-created presets
        type: 'array',
        default: [],
        items: baseProviderConfigSchema
      },
			activeProviderInstanceId: {
        type: ['string', 'null'],
        default: null
      }
		}
	},
  ck3UserFolderPath: {
    type: ['string', 'null'],
    default: null
  },
  globalStreamEnabled: {
    type: 'boolean',
    default: true
  }
};

export class LLMManager {
  private store: Store<AppSettings>;
  private providers: Map<string, ILLMProvider>; // Cache instantiated providers

  constructor() {
    this.store = new Store<AppSettings>({ schema, name: 'revotc-llm-config' });
    this.providers = new Map();
    console.log('LLMManager initialized. Settings path:', this.store.path);
    this.initializeDefaultSettings();
  }

  private initializeDefaultSettings(): void {
    const currentSettings = this.store.get('llmSettings', { providers: [], presets: [], activeProviderInstanceId: null });
    const currentAppSettings = this.store.store;

    const providerTypes: ['openrouter', 'ollama', 'openai-compatible'] = ['openrouter', 'ollama', 'openai-compatible'];
    let updatedProviders = [...currentSettings.providers];
    let settingsChanged = false;

    providerTypes.forEach(type => {
      if (!updatedProviders.some(p => p.providerType === type && p.instanceId === type)) {
        updatedProviders.push({
          instanceId: type,
          providerType: type,
          // customName: type.charAt(0).toUpperCase() + type.slice(1), // No customName for base configs
          apiKey: '',
          baseUrl: type === 'ollama' ? 'http://localhost:11434' : '',
          defaultModel: '',
          defaultParameters: { temperature: 0.7, max_tokens: 2048 },
        });
        settingsChanged = true;
      }
    });
    // Ensure providers only contains one of each base type
    updatedProviders = providerTypes.map(type => {
        const existing = updatedProviders.find(p => p.providerType === type && p.instanceId === type);
        return existing || { // Should not happen if logic above is correct, but as a fallback
            instanceId: type, providerType: type, apiKey: '', 
            baseUrl: type === 'ollama' ? 'http://localhost:11434' : '', 
            defaultModel: '', defaultParameters: { temperature: 0.7, max_tokens: 2048 }
        };
    }).filter(p => providerTypes.includes(p.instanceId as any));


    if (settingsChanged) {
      currentSettings.providers = updatedProviders;
    }
    
    // Initialize presets if not present
    if (!currentSettings.presets) {
      currentSettings.presets = [];
      settingsChanged = true;
    }

    // If no active provider is set, default to OpenRouter
    if (currentSettings.activeProviderInstanceId === null && updatedProviders.some(p => p.instanceId === 'openrouter')) {
      currentSettings.activeProviderInstanceId = 'openrouter';
      settingsChanged = true; // Ensure this change is part of what might be saved
    }

    this.store.set('llmSettings', currentSettings);

    if (currentAppSettings.globalStreamEnabled === undefined) {
        this.store.set('globalStreamEnabled', true); // Default global stream to true
    }
    if (currentAppSettings.ck3UserFolderPath === undefined) {
        this.store.set('ck3UserFolderPath', null);
    }
  }

  // --- Settings Management ---

  getAppSettings(): AppSettings {
    return {
      llmSettings: this.getLLMSettings(),
      ck3UserFolderPath: this.getCK3UserFolderPath(),
      globalStreamEnabled: this.getGlobalStreamSetting()
    };
  }

  getLLMSettings(): LLMSettings {
    // Defaults are handled by initializeDefaultSettings and schema
    return this.store.get('llmSettings');
  }

  saveLLMSettings(settings: LLMSettings): void {
    this.store.set('llmSettings', settings);
    console.log('LLM Settings saved.');
  }
  
  getGlobalStreamSetting(): boolean {
    return this.store.get('globalStreamEnabled', true); // Default to true if not set
  }

  saveGlobalStreamSetting(enabled: boolean): void {
    this.store.set('globalStreamEnabled', enabled);
    console.log('Global stream setting saved:', enabled);
  }

  getCK3UserFolderPath(): string | null | undefined {
     return this.store.get('ck3UserFolderPath');
  }

  getCK3DebugLogPath(): string | null {
     const ck3Folder = this.getCK3UserFolderPath();
     return ck3Folder ? path.join(ck3Folder, 'logs', 'debug.log') : null;
  }

  setCK3UserFolderPath(path: string | null): void {
    this.store.set('ck3UserFolderPath', path);
    console.log('CK3 User Folder Path saved:', path);
  }

  // --- Provider Configuration and Preset Management ---

  // This method now handles saving both base provider configs and presets
  saveProviderConfig(configToSave: LLMProviderConfig): LLMProviderConfig {
    const settings = this.getLLMSettings();
    const baseProviderTypes: string[] = ['openrouter', 'ollama', 'openai-compatible'];

    if (baseProviderTypes.includes(configToSave.instanceId)) { // It's a base provider config
      const index = settings.providers.findIndex(p => p.instanceId === configToSave.instanceId);
      if (index > -1) {
        settings.providers[index] = configToSave;
      } else {
        // This case should ideally be handled by initialization, but as a fallback:
        settings.providers.push(configToSave);
      }
    } else { // It's a preset
      if (!configToSave.instanceId || baseProviderTypes.includes(configToSave.instanceId)) {
        // Preset must have a unique ID, not a base provider type ID
        configToSave.instanceId = uuidv4();
      }
      const index = settings.presets.findIndex(p => p.instanceId === configToSave.instanceId);
      if (index > -1) {
        settings.presets[index] = configToSave;
      } else {
        settings.presets.push(configToSave);
      }
    }
    this.saveLLMSettings(settings);
    return configToSave;
  }

  // deleteProviderConfig is effectively deletePreset now, as base configs are not deleted
  deletePreset(presetInstanceId: string): void {
    const settings = this.getLLMSettings();
    settings.presets = settings.presets.filter(p => p.instanceId !== presetInstanceId);
    if (settings.activeProviderInstanceId === presetInstanceId) {
      settings.activeProviderInstanceId = null; // Or set to a default base provider
    }
    this.saveLLMSettings(settings);
  }

  getActiveProviderInstanceId(): string | null | undefined {
    return this.getLLMSettings().activeProviderInstanceId;
  }

  setActiveProviderInstanceId(instanceId: string | null): void {
    const settings = this.getLLMSettings();
    settings.activeProviderInstanceId = instanceId;
    this.saveLLMSettings(settings);
  }

  getActiveProviderConfig(): LLMProviderConfig | null {
    const activeId = this.getActiveProviderInstanceId();
    if (!activeId) return null;
    
    // Check base providers first
    let config = this.getLLMSettings().providers.find(p => p.instanceId === activeId);
    if (config) return config;

    // Then check presets
    config = this.getLLMSettings().presets.find(p => p.instanceId === activeId);
    return config || null;
  }

  // --- Provider Instantiation ---

  private getProviderInstance(config: LLMProviderConfig): ILLMProvider {
    // Simple caching for now, could be more sophisticated
    if (this.providers.has(config.providerType)) {
      // This assumes one instance per type is sufficient.
      // If multiple configs of the same type need different instances, adjust caching.
      // return this.providers.get(config.providerType)!;
    }

    let provider: ILLMProvider;
    switch (config.providerType) {
      case 'openrouter':
        provider = new OpenRouterProvider();
        break;
      case 'openai-compatible':
        provider = new OpenAICompatibleProvider();
        break;
      case 'ollama':
        provider = new OllamaProvider();
        break;
      default:
        // This ensures exhaustiveness checking. If a new providerType is added to LLMProviderConfig
        // without updating this switch, TypeScript will error here.
        const exhaustiveCheck: never = config;
        throw new Error(`Unhandled provider type: ${JSON.stringify(exhaustiveCheck)}`);
    }
    // Caching logic can be added here if needed, e.g., using instanceId as key
    // this.providers.set(config.instanceId, provider);
    return provider;
  }

  // --- Core Functionality ---

  async listModelsForProvider(config: LLMProviderConfig): Promise<ILLMModel[]> {
    try {
      const provider = this.getProviderInstance(config);
      if (provider.listModels) {
        return await provider.listModels(config);
      }
      return []; // Provider doesn't support listing models
    } catch (error) {
      console.error(`Error listing models for ${config.customName} (${config.providerType}):`, error);
      throw error; // Re-throw to be handled by caller (e.g., UI)
    }
  }

   async testProviderConnection(config: LLMProviderConfig): Promise<{success: boolean, error?: string, message?: string}> {
     try {
      const provider = this.getProviderInstance(config);
      if (provider.testConnection) {
        return await provider.testConnection(config);
      }
      return { success: false, error: 'Provider does not support testConnection method.' };
    } catch (error: any) {
      console.error(`Error testing connection for ${config.customName} (${config.providerType}):`, error);
       return { success: false, error: error.message || 'Unknown error during test connection.' };
    }
  }

  // Unified method to send requests to the *active* provider
  async sendChatRequest(
    messages: ILLMCompletionRequest['messages'],
  ): Promise<ILLMOutput> {
    const activeConfig = this.getActiveProviderConfig();
    if (!activeConfig) {
      throw new Error('No active and enabled LLM provider configured.');
    }
    if (!activeConfig.defaultModel) {
       throw new Error(`Active provider '${activeConfig.customName}' has no default model selected.`);
    }

    const provider = this.getProviderInstance(activeConfig);

    // Use global stream setting from AppSettings
    const appSettings = this.getAppSettings();
    const stream = appSettings.globalStreamEnabled ?? true;

    const request: ILLMCompletionRequest = {
      model: activeConfig.defaultModel,
      messages: messages,
      stream: stream,
      // Merge default parameters from config with specific request params
      ...activeConfig.defaultParameters,
      // ...params,
    };

    return provider.chatCompletion(request, activeConfig);
  }
}

// Export a singleton instance
export const llmManager = new LLMManager();
