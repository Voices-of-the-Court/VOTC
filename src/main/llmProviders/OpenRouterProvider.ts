import {
  ILLMProvider,
  ILLMCompletionRequest,
  ILLMCompletionResponse,
  // ILLMMessage,
  ILLMModel,
  ILLMStreamChunk,
  OpenRouterConfig,
  LLMProviderConfig
} from './types';
import OpenAI from 'openai'; // Import OpenAI SDK

// Helper to identify OpenRouter free models
const isOpenRouterFreeModel = (modelData: any): boolean => {
  if (modelData.id?.endsWith(':free')) {
    return true;
  }
  const pricing = modelData.pricing;
  if (pricing && pricing.prompt === '0.000000' && pricing.completion === '0.000000') {
    return true;
  }
  // OpenRouter API for models can also take `max_price=0` query param
  // but here we check the response data.
  return false;
};


export class OpenRouterProvider implements ILLMProvider {
  readonly providerId = 'openrouter';
  readonly name = 'OpenRouter';

  private getAPIKey(config: LLMProviderConfig): string {
    if (config.providerType !== 'openrouter' || !config.apiKey) {
      throw new Error('Invalid configuration for OpenRouterProvider: API key is missing.');
    }
    return config.apiKey;
  }

  async listModels(config: LLMProviderConfig): Promise<ILLMModel[]> {
    this.getAPIKey(config); // Ensures config is valid and apiKey is present

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`OpenRouter API error (${response.status}): ${errorBody}`);
        throw new Error(`Failed to fetch models from OpenRouter: ${response.statusText}`);
      }

      const { data } = await response.json();
      if (!Array.isArray(data)) {
        console.error('Unexpected response format from OpenRouter /models endpoint:', data);
        throw new Error('Unexpected response format from OpenRouter /models endpoint.');
      }

      return data.map((modelData: any): ILLMModel => ({
        id: modelData.id,
        name: modelData.name || modelData.id,
        isFree: isOpenRouterFreeModel(modelData),
        contextLength: modelData.context_length,
        // Add other properties as needed, e.g., pricing details
      }));
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      throw error;
    }
  }

  // Overload for non-streaming
  chatCompletion(
    request: ILLMCompletionRequest,
    config: OpenRouterConfig
  ): Promise<ILLMCompletionResponse>;
  // Overload for streaming
  chatCompletion(
    request: ILLMCompletionRequest & { stream: true },
    config: OpenRouterConfig
  ): AsyncGenerator<ILLMStreamChunk, ILLMCompletionResponse | void, undefined>;
  // Implementation
  chatCompletion(
    request: ILLMCompletionRequest,
    config: OpenRouterConfig
  ): Promise<ILLMCompletionResponse> | AsyncGenerator<ILLMStreamChunk, ILLMCompletionResponse | void, undefined> {
    const apiKey = this.getAPIKey(config);

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // Optional headers, can be made configurable if needed
      // 'HTTP-Referer': 'YOUR_SITE_URL',
      // 'X-Title': 'YOUR_SITE_NAME',
    };

    const body = {
      model: request.model,
      messages: request.messages,
      stream: request.stream,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      top_p: request.top_p,
      presence_penalty: request.presence_penalty,
      frequency_penalty: request.frequency_penalty,
      // Add other supported parameters as needed
    };

    if (request.stream) {
      // Pass config directly to _streamChatCompletion
      return this._streamChatCompletion(request, config);
    } else {
      // _nonStreamChatCompletion still uses headers and body from the old pattern.
      // This could be refactored similarly later if desired, but is not the focus now.
      return this._nonStreamChatCompletion(request, headers, body);
    }
  }

  private async _nonStreamChatCompletion(
    request: ILLMCompletionRequest,
    headers: Record<string, string>,
    body: any
  ): Promise<ILLMCompletionResponse> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`OpenRouter API error (${response.status}) for model ${request.model}: ${errorBody}`);
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();

    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('Invalid response from OpenRouter: No choices found.');
    }
    
    return {
      id: data.id,
      content: choice.message?.content,
      tool_calls: choice.message?.tool_calls,
      finish_reason: choice.finish_reason,
      usage: data.usage ? {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
      } : undefined,
    };
  }

  private async *_streamChatCompletion(
    request: ILLMCompletionRequest,
    config: OpenRouterConfig
  ): AsyncGenerator<ILLMStreamChunk, ILLMCompletionResponse | void, undefined> {
    const openAIClient = new OpenAI({
      apiKey: this.getAPIKey(config),
      baseURL: 'https://openrouter.ai/api/v1',
    });

    const streamRequestParams: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: request.model,
      messages: request.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      stream: true,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      top_p: request.top_p,
      presence_penalty: request.presence_penalty,
      frequency_penalty: request.frequency_penalty,
    };

    try {
      const stream = await openAIClient.chat.completions.create(streamRequestParams);
      const contentParts: string[] = [];
      const toolCallsMap: Record<string, any> = {};
      let finalUsage = undefined;
      let finalFinishReason: string | null | undefined = null;
      let firstChunkId = '';

      for await (const chunk of stream) {
        if (!firstChunkId && chunk.id) {
          firstChunkId = chunk.id;
        }

        const choice = chunk.choices[0];
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
      console.error(`[OpenRouterProvider] OpenAI SDK stream error for model ${request.model}:`, error);
      if (error instanceof OpenAI.APIError) {
        throw new Error(`OpenRouter API stream error via SDK: ${error.status} ${error.name} - ${error.message}`);
      }
      throw new Error(`OpenRouter API stream error via SDK: ${error.message || 'Unknown error'}`);
    }
  }

  async testConnection(config: OpenRouterConfig): Promise<{success: boolean, error?: string, message?: string}> {
    try {
      const testRequest: ILLMCompletionRequest = {
        model: config.defaultModel || 'openrouter/auto', // Use a known cheap/fast model or user's default
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 1,
        stream: false,
      };
      
      const response = await this.chatCompletion(testRequest, config);
      if (response && (response.content || response.id)) {
        return { success: true, message: `Successfully connected to OpenRouter. Received response ID: ${response.id}` };
      }
      return { success: false, error: 'Test connection to OpenRouter failed to get a valid response.' };
    } catch (e: any) {
      console.error('OpenRouter testConnection error:', e);
      return { success: false, error: e.message || 'Unknown error during OpenRouter test connection.' };
    }
  }
}
