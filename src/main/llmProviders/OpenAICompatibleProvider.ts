import { providerRegistry } from './ProviderRegistry';
import {
  ILLMCompletionRequest,
  ILLMCompletionResponse,
  ILLMModel,
  ILLMStreamChunk,
  OpenAICompatibleConfig,
  LLMProviderConfig,
  ILLMOutput
} from './types';
import { BaseProvider } from './BaseProvider';
import OpenAI from 'openai';

export class OpenAICompatibleProvider extends BaseProvider {
  providerId = 'openai-compatible';
  name = 'OpenAI-Compatible API';

  /**
   * Determine if an error should trigger a retry
   * @param error The error to check
   * @returns true if the error is retryable
   */
  private shouldRetry(error: any): boolean {
    if (error instanceof OpenAI.APIError) {
      const status = error.status;
      // Retry on rate limiting (429) or server errors (5xx)
      return status === 429 || (status >= 500 && status < 600);
    }
    // Retry on network errors or other transient issues
    return error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND';
  }

  async listModels(config: LLMProviderConfig): Promise<ILLMModel[]> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      "X-Title": "reVOTC",
      'User-Agent': 'reVOTC/1.0.0', // Custom User-Agent to avoid Cloudflare blocking
      ...(this.getAPIKey(config) && { 'Authorization': `Bearer ${this.getAPIKey(config)}` }),
    };

    try {
      // Try using OpenAI library first
      const openAIClient = new OpenAI({
        apiKey: this.getAPIKey(config),
        baseURL: this.getBaseUrl(config),
        defaultHeaders: headers,
        maxRetries: 0,
      });

      const response = await this.retryWithBackoff(
        () => openAIClient.models.list(),
        3,
        1000,
        this.shouldRetry.bind(this)
      );

      return response.data.map((modelData: any): ILLMModel => ({
        id: modelData.id,
        name: modelData.id,
      }));
    } catch (error) {
      console.warn('OpenAICompatibleProvider: Failed to fetch models using OpenAI library, falling back to fetch:', error);
      
      // Fallback to manual fetch with proper headers
      try {
        const response = await fetch(`${this.getBaseUrl(config)}/models`, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.warn(`OpenAICompatibleProvider: Failed to fetch models from ${this.getBaseUrl(config)} (${response.status}): ${errorBody}`);
          return [];
        }

        const { data } = await response.json();
        if (!Array.isArray(data)) {
          console.warn('OpenAICompatibleProvider: Unexpected response format from /models endpoint:', data);
          return [];
        }

        return data.map((modelData: any): ILLMModel => ({
          id: modelData.id,
          name: modelData.id,
        }));
      } catch (fallbackError) {
        console.warn('OpenAICompatibleProvider: Error fetching models with fallback:', fallbackError);
        return [];
      }
    }
  }
  
  chatCompletion(
    request: ILLMCompletionRequest,
    config: OpenAICompatibleConfig
  ): ILLMOutput {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Title': 'reVOTC',
      'User-Agent': 'reVOTC/1.0.0', // Custom User-Agent to avoid Cloudflare blocking
      ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
    };

    const openAIClient = new OpenAI({
      apiKey: this.getAPIKey(config),
      baseURL: this.getBaseUrl(config),
      defaultHeaders: headers,
      maxRetries: 0,
    });

    const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: request.model,
      messages: request.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      stream: request.stream,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      top_p: request.top_p,
      presence_penalty: request.presence_penalty,
      frequency_penalty: request.frequency_penalty,
      ...(request.stream ? { stream_options: { include_usage: true } } : {}),
    };

    if (requestParams.stream) {
      return this._streamChatCompletion(requestParams, openAIClient, request.signal);
    } else {
      return this._nonStreamChatCompletion(requestParams, openAIClient);
    }
  }

  private async _nonStreamChatCompletion(
    request: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
    openAIClient: OpenAI
  ): Promise<ILLMCompletionResponse> {
    try {
      const data = await this.retryWithBackoff(
        () => openAIClient.chat.completions.create(request),
        3,
        1000,
        this.shouldRetry.bind(this)
      );

      const choice = data.choices?.[0];
      if (!choice) {
        throw new Error(`OpenAI-Compatible SDK: No choices returned for model ${request.model}`);
      }

      return {
        id: data.id,
        content: choice.message?.content ?? null,
        tool_calls: choice.message?.tool_calls,
        finish_reason: choice.finish_reason ?? null,
        usage: data.usage
          ? {
              prompt_tokens: data.usage.prompt_tokens,
              completion_tokens: data.usage.completion_tokens,
              total_tokens: data.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error: any) {
      if (error instanceof OpenAI.APIError) {
        console.error(
          `[OpenAICompatibleProvider] API error for model ${request.model}:`,
          error.status,
          error.name,
          error.message
        );
        throw new Error(`OpenAI-Compatible API error via SDK: ${error.status} ${error.name} - ${error.message}`);
      }

      console.error(`[OpenAICompatibleProvider] Unexpected error for model ${request.model}:`, error);
      throw new Error(`Unexpected OpenAI-Compatible SDK error: ${error.message || error}`);
    }
  }

  private async *_streamChatCompletion(
    request: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
    openAIClient: OpenAI,
    signal?: AbortSignal
  ): AsyncGenerator<ILLMStreamChunk> {
    try {
      const stream = await this.retryWithBackoff(
        () => openAIClient.chat.completions.create(request, signal ? { signal } : undefined),
        7,
        1000,
        this.shouldRetry.bind(this)
      );
      
      const contentParts: string[] = [];
      const toolCallsMap: Record<string, any> = {};
      let finalUsage = undefined;
      let finalFinishReason: string | null | undefined = null;
      let firstChunkId = '';

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        
        if (!firstChunkId && chunk.id) {
          firstChunkId = chunk.id;
        }

        if (!choice) continue;

        const delta = choice.delta;
        const finish_reason = choice.finish_reason;

        if ((chunk as any).usage) {
          finalUsage = (chunk as any).usage;
        }

        const streamChunk: ILLMStreamChunk = {
          id: chunk.id,
          delta: delta ? {
            content: delta.content || undefined,
            role: delta.role as 'assistant' | undefined,
            tool_calls: delta.tool_calls as any,
          } : undefined,
          finish_reason: finish_reason as ILLMCompletionResponse['finish_reason'],
        };
        yield streamChunk;

        // Handle content and tool calls efficiently
        if (delta?.content) {
          contentParts.push(delta.content);
        }
        
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const key = `${tc.index}_${tc.id}`;
            if (!toolCallsMap[key]) {
              toolCallsMap[key] = {
                id: tc.id,
                type: 'function',
                function: { name: '', arguments: '' }
              };
            }
            
            if (tc.function?.name) {
              toolCallsMap[key].function.name = tc.function.name;
            }
            
            if (tc.function?.arguments) {
              toolCallsMap[key].function.arguments += tc.function.arguments;
            }
          }
        }
        
        if (finish_reason) {
          finalFinishReason = finish_reason as ILLMCompletionResponse['finish_reason'];
        }
      }

      // Convert tool calls map to array
      const toolCalls = Object.values(toolCallsMap);

      return {
        id: firstChunkId,
        content: contentParts.join(''),
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        finish_reason: finalFinishReason,
        usage: finalUsage
      };
    } catch (error: any) {
      if (signal?.aborted) {
        console.info(`[OpenAICompatibleProvider] OpenAI SDK stream cancelled for model ${request.model}:`, error);
        throw new Error(`AbortError: Message cancelled`);
      }
      console.error(`[OpenAICompatibleProvider] OpenAI SDK stream error for model ${request.model}:`, error);
      if (error instanceof OpenAI.APIError) {
        throw new Error(`OpenAI-Compatible API stream error via SDK: ${error.status} ${error.name} - ${error.message}`);
      }
      throw new Error(`OpenAI-Compatible API stream error via SDK: ${error.message || 'Unknown error'}`);
    }
  }

  async testConnection(config: OpenAICompatibleConfig): Promise<{success: boolean, error?: string, message?: string}> {
    try {
      const testRequest: ILLMCompletionRequest = {
        model: config.defaultModel || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 1,
        stream: false,
      };
      
      const response = await (this.chatCompletion(testRequest, config) as Promise<ILLMCompletionResponse>);
      if (response && (response.content || response.id)) {
        return { success: true, message: `Successfully connected to OpenAI-Compatible API. Received response ID: ${response.id}` };
      }
      return { success: false, error: 'Test connection to OpenAI-Compatible API failed to get a valid response.' };
    } catch (e: any) {
      console.error('OpenAI-Compatible testConnection error:', e);
      return { success: false, error: e.message || 'Unknown error during OpenAI-Compatible test connection.' };
    }
  }
}

// Register this provider with the registry
providerRegistry.register('openai-compatible', OpenAICompatibleProvider);
