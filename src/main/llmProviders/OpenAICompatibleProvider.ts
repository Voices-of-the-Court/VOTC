import {
  ILLMProvider,
  ILLMCompletionRequest,
  ILLMCompletionResponse,
  ILLMModel,
  ILLMStreamChunk,
  OpenAICompatibleConfig,
  LLMProviderConfig
} from './types';

export class OpenAICompatibleProvider implements ILLMProvider {
  readonly providerId = 'openai-compatible';
  readonly name = 'OpenAI-Compatible API';

  private getConfig(config: LLMProviderConfig): OpenAICompatibleConfig {
    if (config.providerType !== 'openai-compatible') {
      throw new Error('Invalid configuration for OpenAICompatibleProvider.');
    }
    return config;
  }

  async listModels(config: LLMProviderConfig): Promise<ILLMModel[]> {
    const providerConfig = this.getConfig(config);
    if (!providerConfig.baseUrl) {
      // Cannot list models without a base URL
      console.warn('OpenAICompatibleProvider: Base URL not set, cannot list models.');
      return [];
    }

    try {
      // Attempt to fetch models from a standard /v1/models endpoint
      const response = await fetch(`${providerConfig.baseUrl.replace(/\/$/, '')}/v1/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(providerConfig.apiKey && { 'Authorization': `Bearer ${providerConfig.apiKey}` }),
        },
      });

      if (!response.ok) {
        // Don't throw an error, as this is best-effort. Just log and return empty.
        const errorBody = await response.text();
        console.warn(`OpenAICompatibleProvider: Failed to fetch models from ${providerConfig.baseUrl} (${response.status}): ${errorBody}`);
        return [];
      }

      const { data } = await response.json();
      if (!Array.isArray(data)) {
        console.warn('OpenAICompatibleProvider: Unexpected response format from /v1/models endpoint:', data);
        return [];
      }

      return data.map((modelData: any): ILLMModel => ({
        id: modelData.id,
        name: modelData.id, // OpenAI /v1/models usually just has 'id'
        // isFree and contextLength are not standard in OpenAI /v1/models response
        // and would need to be configured manually or inferred differently.
      }));
    } catch (error) {
      console.warn('OpenAICompatibleProvider: Error fetching models:', error);
      return []; // Best-effort, return empty on error
    }
  }
  
  // Overload for non-streaming
  chatCompletion(
    request: ILLMCompletionRequest,
    config: OpenAICompatibleConfig
  ): Promise<ILLMCompletionResponse>;
  // Overload for streaming
  chatCompletion(
    request: ILLMCompletionRequest & { stream: true },
    config: OpenAICompatibleConfig
  ): AsyncGenerator<ILLMStreamChunk, ILLMCompletionResponse | void, undefined>;
  // Implementation
  chatCompletion(
    request: ILLMCompletionRequest,
    config: OpenAICompatibleConfig
  ): Promise<ILLMCompletionResponse> | AsyncGenerator<ILLMStreamChunk, ILLMCompletionResponse | void, undefined> {
    const providerConfig = this.getConfig(config);
    if (!providerConfig.baseUrl) {
      throw new Error('OpenAICompatibleProvider: Base URL is not configured.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (providerConfig.apiKey) {
      headers['Authorization'] = `Bearer ${providerConfig.apiKey}`;
    }

    // Ensure messages is an array of ILLMMessage, not just a string.
    // The ILLMCompletionRequest type already enforces this.
    const body = {
      model: request.model,
      messages: request.messages,
      stream: request.stream,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      top_p: request.top_p,
      presence_penalty: request.presence_penalty,
      frequency_penalty: request.frequency_penalty,
      // Other parameters can be added if they are standard for OpenAI API
    };
    
    const endpoint = `${providerConfig.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;

    if (request.stream) {
      return this._streamChatCompletion(request, endpoint, headers, body);
    } else {
      return this._nonStreamChatCompletion(request, endpoint, headers, body);
    }
  }

  private async _nonStreamChatCompletion(
    request: ILLMCompletionRequest,
    endpoint: string,
    headers: Record<string, string>,
    body: any
  ): Promise<ILLMCompletionResponse> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`OpenAI-Compatible API error (${response.status}) for model ${request.model}: ${errorBody}`);
      throw new Error(`OpenAI-Compatible API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('Invalid response from OpenAI-Compatible API: No choices found.');
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
    endpoint: string,
    headers: Record<string, string>,
    body: any
  ): AsyncGenerator<ILLMStreamChunk, ILLMCompletionResponse | void, undefined> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, stream: true }),
    });

    if (!response.ok || !response.body) {
      const errorBody = await response.text();
      console.error(`OpenAI-Compatible API stream error (${response.status}) for model ${request.model}: ${errorBody}`);
      throw new Error(`OpenAI-Compatible API stream error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let aggregatedResponse: ILLMCompletionResponse = {
      id: '',
      content: '',
      tool_calls: [],
      finish_reason: null,
      usage: undefined
    };
    let firstChunk = true;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        let eolIndex;
        while ((eolIndex = buffer.indexOf('\\n')) >= 0) {
          const line = buffer.substring(0, eolIndex).trim();
          buffer = buffer.substring(eolIndex + 1);

          if (line.startsWith('data: ')) {
            const jsonData = line.substring(6);
            if (jsonData === '[DONE]') {
              return aggregatedResponse;
            }

            try {
              const chunkData = JSON.parse(jsonData);
               if (firstChunk && chunkData.id) {
                aggregatedResponse.id = chunkData.id;
                firstChunk = false;
              }
              
              const choice = chunkData.choices?.[0];
              if (choice?.error) {
                // If the chunk itself is an error reported by the provider
                const errorMessage = `OpenAI-Compatible stream error: ${choice.error.message || 'Unknown error'}`;
                console.error(errorMessage, choice.error);
                throw new Error(errorMessage);
              }

              const delta = choice?.delta;
              const finish_reason = choice?.finish_reason;
              
              const streamChunk: ILLMStreamChunk = {
                id: chunkData.id,
                delta: delta ? {
                  content: delta.content,
                  role: delta.role,
                  tool_calls: delta.tool_calls,
                } : undefined,
                finish_reason: finish_reason,
              };
              yield streamChunk;

              if (delta?.content) {
                aggregatedResponse.content = (aggregatedResponse.content || '') + delta.content;
              }
              if (delta?.tool_calls) {
                 if (!aggregatedResponse.tool_calls) aggregatedResponse.tool_calls = [];
                delta.tool_calls.forEach((tc: any) => {
                  const existingCall = aggregatedResponse.tool_calls!.find(c => c.id === tc.id && tc.index === (c as any).index);
                  if (existingCall && tc.function) {
                    if (tc.function.name) existingCall.function.name = tc.function.name;
                    if (tc.function.arguments) existingCall.function.arguments = (existingCall.function.arguments || '') + tc.function.arguments;
                  } else if (tc.id && tc.function) {
                     aggregatedResponse.tool_calls!.push({
                      id: tc.id,
                      type: 'function',
                      function: { name: tc.function.name || '', arguments: tc.function.arguments || ''}
                    });
                  }
                });
              }
              if (finish_reason) {
                aggregatedResponse.finish_reason = finish_reason;
              }
               if (chunkData.usage) { 
                aggregatedResponse.usage = chunkData.usage;
              }

            } catch (e) {
              console.error('Error parsing OpenAI-Compatible stream chunk:', e, 'Raw line:', line);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
     return aggregatedResponse;
  }

  async testConnection(config: LLMProviderConfig): Promise<{success: boolean, error?: string, message?: string}> {
    const providerConfig = this.getConfig(config);
    if (!providerConfig.baseUrl) {
      return { success: false, error: 'Base URL is not configured for OpenAI-Compatible provider.' };
    }
    try {
      const testRequest: ILLMCompletionRequest = {
        model: providerConfig.defaultModel || 'gpt-3.5-turbo', // A common default, user should override
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 1,
        // stream property is now global, not part of ILLMCompletionRequest for testConnection directly
        // stream: false, // This was for the old ProviderConfigBase.stream
      };
      
      // Cast providerConfig to LLMProviderConfig to access customName if it were a preset,
      // but for a base config, customName is not directly available. We'll use a generic name.
      const displayName = (providerConfig as LLMProviderConfig).customName || this.name;

      const response = await this.chatCompletion(testRequest, providerConfig);
      if (response && (response.content || response.id)) {
        return { success: true, message: `Successfully connected to ${displayName}. Received response ID: ${response.id}` };
      }
      return { success: false, error: `Test connection to ${displayName} failed to get a valid response.` };
    } catch (e: any) {
      const displayName = (providerConfig as LLMProviderConfig).customName || this.name;
      console.error(`OpenAI-Compatible testConnection error for ${displayName}:`, e);
      return { success: false, error: e.message || `Unknown error during ${displayName} test connection.` };
    }
  }
}
