import {
  LLMProviderConfig,
  ILLMProvider,
  ILLMCompletionRequest,
  ILLMOutput,
  ILLMModel,
} from './llmProviders/types';
import { settingsRepository } from './SettingsRepository';
import { providerRegistry } from './llmProviders/ProviderRegistry';


export class LLMManager {
  private providers: Map<string, ILLMProvider>; // Cache instantiated providers

  constructor() {
    this.providers = new Map();
    console.log('LLMManager initialized with refactored architecture.');
  }



  // --- Provider Instantiation ---

  private getProviderInstance(config: LLMProviderConfig): ILLMProvider {
    // Simple caching by provider type for now
    if (this.providers.has(config.providerType)) {
      return this.providers.get(config.providerType)!;
    }

    const provider = providerRegistry.createProvider(config);
    // Cache the provider instance by type
    this.providers.set(config.providerType, provider);
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
    signal?: AbortSignal
  ): Promise<ILLMOutput> {
    const activeConfig = settingsRepository.getActiveProviderConfig();
    if (!activeConfig) {
      throw new Error('No active and enabled LLM provider configured.');
    }
    if (!activeConfig.defaultModel) {
       throw new Error(`Active provider '${activeConfig.customName}' has no default model selected.`);
    }

    const provider = this.getProviderInstance(activeConfig);

    // Use global stream setting from AppSettings
    const stream = settingsRepository.getGlobalStreamSetting();

    const request: ILLMCompletionRequest = {
      model: activeConfig.defaultModel,
      messages: messages,
      stream: stream,
      // Merge default parameters from config with specific request params
      ...activeConfig.defaultParameters,
      signal,
      // ...params,
    };

    return await provider.chatCompletion(request, activeConfig);
  }
}

// Export a singleton instance
export const llmManager = new LLMManager();
