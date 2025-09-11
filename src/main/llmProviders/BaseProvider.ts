import {
  ILLMCompletionRequest,
  ILLMCompletionResponse,
  ILLMStreamChunk,
  ILLMModel,
  ILLMOutput,
  LLMProviderConfig
} from './types';

/**
 * Base implementation for LLM providers with common functionality
 */
export abstract class BaseProvider {
  abstract readonly providerId: string;
  abstract readonly name: string;

  /**
   * Validates the provider configuration
   * @param config - The provider configuration to validate
   */
  protected validateConfig(config: LLMProviderConfig): void {
    if (!config.apiKey) {
      throw new Error(`API key is required for ${this.name}`);
    }

    if (this.requiresBaseUrl && !config.baseUrl) {
      throw new Error(`Base URL is required for ${this.name}`);
    }

    if (!config.defaultModel) {
      throw new Error(`Default model is required for ${this.name}`);
    }
  }

  /**
   * Whether this provider requires a base URL
   * Override in subclasses if needed
   */
  protected requiresBaseUrl = false;

  /**
   * Tests connection to the LLM provider
   * @param config - Provider configuration
   * @returns Connection test result
   */
  async testConnection(config: LLMProviderConfig): Promise<{success: boolean, error?: string, message?: string}> {
    try {
      this.validateConfig(config);

      const testMessages = [{
        role: 'user' as const,
        content: 'Hi.'
      }];

      // Send a minimal completion request
      await this.chatCompletion({
        model: config.defaultModel!,
        messages: testMessages,
        max_tokens: 10,
        stream: false
      }, config);

      return {
        success: true,
        message: `Successfully connected to ${this.name}`
      };
    } catch (error: any) {
      console.error(`[${this.providerId}] Connection test failed:`, error);
      return {
        success: false,
        error: error.message || `Failed to connect to ${this.name}`
      };
    }
  }

  /**
   * Lists available models (if provider supports it)
   * @param config - Provider configuration
   * @returns Array of available models
   */
  async listModels(config: LLMProviderConfig): Promise<ILLMModel[]> {
    try {
      this.validateConfig(config);

      // Default implementation - providers should override if they support model listing
      console.warn(`[${this.providerId}] Model listing not implemented for ${this.name}`);
      return [];
    } catch (error: any) {
      console.error(`[${this.providerId}] Error listing models:`, error);
      throw error;
    }
  }

  /**
   * Send chat completion request
   * @param request - The completion request
   * @param config - Provider configuration
   * @returns Completion response or stream
   */
  abstract chatCompletion(
    request: ILLMCompletionRequest,
    config: LLMProviderConfig
  ): ILLMOutput;

  /**
   * Helper method to create consistent error messages
   */
  protected createErrorMessage(operation: string, error: any): string {
    return `[${this.providerId}] ${operation} failed: ${error.message || 'Unknown error'}`;
  }

  /**
   * Helper method to validate messages format
   */
  protected validateMessages(messages: ILLMCompletionRequest['messages']): void {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages must be a non-empty array');
    }

    for (const message of messages) {
      if (!message.role || !message.content) {
        throw new Error('Each message must have role and content');
      }
    }
  }
}