import {
  LLMProviderConfig,
  ILLMProvider,
  ILLMCompletionRequest,
  ILLMOutput,
  ILLMModel,
} from './llmProviders/types';
import { settingsRepository } from './SettingsRepository';
import { providerRegistry } from './llmProviders/ProviderRegistry';
import { TokenCounter } from './utils/TokenCounter';

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

  async listModelsForProvider(): Promise<ILLMModel[]> {
    const config = settingsRepository.getActiveProviderConfig();
    if (!config) {
      throw new Error('No active and enabled LLM provider configured.');
    }
    
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

   async testProviderConnection(): Promise<{success: boolean, error?: string, message?: string}> {
    const config = settingsRepository.getActiveProviderConfig();
    if (!config) {
      return { success: false, error: 'No active and enabled LLM provider configured.' };
    }
    
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
    signal?: AbortSignal,
    noStream?: boolean
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
    const stream = settingsRepository.getGlobalStreamSetting() && !noStream;

    const request: ILLMCompletionRequest = {
      model: activeConfig.defaultModel,
      messages: messages,
      stream: stream,
      // Merge default parameters from config with specific request params
      ...activeConfig.defaultParameters,
      signal,
      // ...params,
    };
    const providerData = JSON.stringify(activeConfig).replace(/"apiKey":\s*"[^"]*"/g, 'HIDDEN'); // apiKey excluded
    console.log(`[LLMManager] Provider data stringified: ${providerData}`); 

    return await provider.chatCompletion(request, activeConfig);
  }

  /**
   * Send a structured JSON request for Actions.
   * Uses the actions provider override if set, otherwise active provider.
   */
  async sendActionsRequest(
    messages: ILLMCompletionRequest['messages'],
    schemaName: string,
    jsonSchemaObject: object,
    signal?: AbortSignal
  ): Promise<ILLMOutput> {
    const config = settingsRepository.getActionsProviderConfig();
    if (!config) {
      throw new Error('No provider configured for Actions.');
    }
    if (!config.defaultModel) {
      throw new Error(`Provider '${config.customName || config.providerType}' has no default model selected.`);
    }

    const provider = this.getProviderInstance(config);

    const request: ILLMCompletionRequest = {
      model: config.defaultModel,
      messages,
      stream: false, // structured outputs should be non-streamed
      ...config.defaultParameters,
      signal,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: schemaName,
          schema: jsonSchemaObject,
          strict: true
        }
      }
    };

    console.log(`[LLMManager] Sending structured request: ${JSON.stringify(request)}`);

    const providerData = JSON.stringify(config).replace(/"apiKey":\s*"[^"]*"/g, 'HIDDEN'); // apiKey excluded
    console.log(`[LLMManager] Provider data stringified: ${providerData}`); 
    console.log(`[TOKEN_COUNT] Structured request ${TokenCounter.estimateTokens(JSON.stringify(request))}`);
    return await provider.chatCompletion(request, config);
  }

  /**
   * Send a request for Summaries (rolling or final).
   * Uses the summary provider override if set, otherwise active provider.
   */
  async sendSummaryRequest(
    messages: ILLMCompletionRequest['messages'],
    signal?: AbortSignal
  ): Promise<ILLMOutput> {
    const config = settingsRepository.getSummaryProviderConfig();
    if (!config) {
      throw new Error('No provider configured for Summaries.');
    }
    if (!config.defaultModel) {
      throw new Error(`Provider '${config.customName || config.providerType}' has no default model selected.`);
    }

    const provider = this.getProviderInstance(config);

    const request: ILLMCompletionRequest = {
      model: config.defaultModel,
      messages,
      stream: false, // summaries don't need streaming
      ...config.defaultParameters,
      signal,
    };

    const providerData = JSON.stringify(config).replace(/"apiKey":\s*"[^"]*"/g, 'HIDDEN');
    console.log(`[LLMManager] Provider data stringified: ${providerData}`); 
    return await provider.chatCompletion(request, config);
  }

  // Get current context length for the active provider
  async getCurrentContextLength(): Promise<number> {
    const activeConfig = settingsRepository.getActiveProviderConfig();
    if (!activeConfig) {
      return 90000; // Fallback value
    }

    // If user has set a custom context length, use that
    if (activeConfig.customContextLength !== undefined) {
      return activeConfig.customContextLength;
    }

    // Otherwise, try to get the default context length for the current model
    try {
      const models = await this.listModelsForProvider();
      const currentModel = models.find(model => model.id === activeConfig.defaultModel);
      
      if (currentModel && currentModel.contextLength !== undefined) {
        return currentModel.contextLength;
      }
    } catch (error) {
      console.warn('Failed to fetch model context length:', error);
    }

    // Fallback to default value
    return 90000;
  }

  // Get the maximum context length for the current model
  async getMaxContextLength(): Promise<number> {
    const activeConfig = settingsRepository.getActiveProviderConfig();
    if (!activeConfig) {
      return 90000; // Fallback value
    }

    try {
      const models = await this.listModelsForProvider();
      const currentModel = models.find(model => model.id === activeConfig.defaultModel);
      
      if (currentModel && currentModel.contextLength !== undefined) {
        return currentModel.contextLength;
      }
    } catch (error) {
      console.warn('Failed to fetch model max context length:', error);
    }

    // Fallback to default value
    return 90000;
  }

  // Set custom context length for the active provider
  setCustomContextLength(contextLength: number): void {
    const activeConfig = settingsRepository.getActiveProviderConfig();
    if (!activeConfig) {
      throw new Error('No active and enabled LLM provider configured.');
    }

    // Update the config with custom context length
    const updatedConfig = {
      ...activeConfig,
      customContextLength: contextLength
    };

    settingsRepository.saveProviderConfig(updatedConfig);
  }

  // Clear custom context length for the active provider
  clearCustomContextLength(): void {
    const activeConfig = settingsRepository.getActiveProviderConfig();
    if (!activeConfig) {
      throw new Error('No active and enabled LLM provider configured.');
    }

    // Remove custom context length from config
    const { customContextLength, ...configWithoutCustomContext } = activeConfig;
    settingsRepository.saveProviderConfig(configWithoutCustomContext);
  }
}

// Export a singleton instance
export const llmManager = new LLMManager();
