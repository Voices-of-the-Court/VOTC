import {
  ILLMProvider,
  ILLMCompletionRequest,
  ILLMCompletionResponse,
  ILLMModel,
  ILLMStreamChunk,
  OllamaConfig,
  LLMProviderConfig
} from './types';

export class OllamaProvider implements ILLMProvider {
  readonly providerId = 'ollama';
  readonly name = 'Ollama';

  private getConfig(config: LLMProviderConfig): OllamaConfig {
    if (config.providerType !== 'ollama' || !config.baseUrl) {
      throw new Error('Invalid configuration for OllamaProvider: Base URL is missing or type is incorrect.');
    }
    return config;
  }

  async listModels(config: LLMProviderConfig): Promise<ILLMModel[]> {
    const providerConfig = this.getConfig(config);
    const endpoint = `${providerConfig.baseUrl.replace(/\/$/, '')}/api/tags`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Ollama API error (${response.status}) listing models: ${errorBody}`);
        throw new Error(`Failed to fetch models from Ollama: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.models || !Array.isArray(data.models)) {
        console.error('Unexpected response format from Ollama /api/tags endpoint:', data);
        throw new Error('Unexpected response format from Ollama /api/tags endpoint.');
      }

      return data.models.map((modelData: any): ILLMModel => ({
        id: modelData.name, // Ollama uses 'name' as the model identifier (e.g., 'llama3:latest')
        name: modelData.name,
        // Ollama doesn't directly provide isFree or contextLength in /api/tags in a standard way.
        // These might need to be fetched via /api/show or configured manually.
        // For now, we'll leave them undefined.
        // contextLength: modelData.details?.parameter_size ? parseInt(modelData.details.parameter_size) : undefined, // Example, might not be correct
      }));
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      throw error;
    }
  }

  // Overload for non-streaming
  chatCompletion(
    request: ILLMCompletionRequest,
    config: OllamaConfig
  ): Promise<ILLMCompletionResponse>;
  // Overload for streaming
  chatCompletion(
    request: ILLMCompletionRequest & { stream: true },
    config: OllamaConfig
  ): AsyncGenerator<ILLMStreamChunk, ILLMCompletionResponse | void, undefined>;
  // Implementation
  chatCompletion(
    request: ILLMCompletionRequest,
    config: OllamaConfig
  ): Promise<ILLMCompletionResponse> | AsyncGenerator<ILLMStreamChunk, ILLMCompletionResponse | void, undefined> {
    const providerConfig = this.getConfig(config);
    const endpoint = `${providerConfig.baseUrl.replace(/\/$/, '')}/api/chat`;

    const ollamaMessages = request.messages.map(msg => ({
        role: msg.role === 'tool' ? 'assistant' : msg.role, // Ollama might not have 'tool' role; map to assistant or handle appropriately
        content: msg.content,
        // Ollama specific: images array for multimodal
        // tool_calls are not directly supported in the same way as OpenAI by Ollama's native API.
        // If tool use is needed, it would typically be handled by a wrapper or by prompting.
    }));


    const body: any = {
      model: request.model,
      messages: ollamaMessages,
      stream: request.stream ?? false, // Ollama expects stream to be explicitly false for non-streaming
      options: { // Ollama puts parameters under an 'options' object
        temperature: request.temperature,
        num_predict: request.max_tokens, // Ollama uses num_predict for max_tokens
        top_p: request.top_p,
        presence_penalty: request.presence_penalty, // Check Ollama docs for exact mapping
        frequency_penalty: request.frequency_penalty, // Check Ollama docs for exact mapping
      },
    };
    // Remove undefined options to avoid sending them
    for (const key in body.options) {
      if (body.options[key] === undefined) {
        delete body.options[key];
      }
    }


    if (request.stream) {
      return this._streamChatCompletion(request, endpoint, body);
    } else {
      return this._nonStreamChatCompletion(request, endpoint, body);
    }
  }

  private async _nonStreamChatCompletion(
    request: ILLMCompletionRequest,
    endpoint: string,
    body: any
  ): Promise<ILLMCompletionResponse> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, stream: false }), // Ensure stream is false
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Ollama API error (${response.status}) for model ${request.model}: ${errorBody}`);
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    if (!data.message || typeof data.message.content !== 'string') {
      throw new Error('Invalid response from Ollama: No message content found.');
    }
    
    return {
      id: data.created_at, // Ollama doesn't have a specific response ID like OpenAI, use created_at or generate one
      content: data.message.content,
      // tool_calls: undefined, // Ollama native API doesn't support OpenAI-style tool calls directly
      finish_reason: data.done ? (data.done_reason || 'stop') : null, // done_reason might exist
      usage: { // Ollama provides token counts in the response
        prompt_tokens: data.prompt_eval_count,
        completion_tokens: data.eval_count,
        total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };
  }

  private async *_streamChatCompletion(
    request: ILLMCompletionRequest,
    endpoint: string,
    body: any
  ): AsyncGenerator<ILLMStreamChunk, ILLMCompletionResponse | void, undefined> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, stream: true }),
    });

    if (!response.ok || !response.body) {
      const errorBody = await response.text();
      console.error(`Ollama API stream error (${response.status}) for model ${request.model}: ${errorBody}`);
      throw new Error(`Ollama API stream error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let aggregatedResponse: ILLMCompletionResponse = {
      id: '', // Will be set from first chunk or generated
      content: '',
      // tool_calls: [], // Ollama native API doesn't support OpenAI-style tool calls directly
      finish_reason: null,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    };
    let firstChunk = true;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Ollama streams JSON objects separated by newlines
        let eolIndex;
        while ((eolIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.substring(0, eolIndex).trim();
          buffer = buffer.substring(eolIndex + 1);

          if (line) { // Ensure line is not empty
            try {
              const chunkData = JSON.parse(line);
              
              if (firstChunk) {
                aggregatedResponse.id = chunkData.created_at || Date.now().toString();
                firstChunk = false;
              }

              const streamChunk: ILLMStreamChunk = {
                delta: chunkData.message?.content ? { content: chunkData.message.content } : undefined,
                finish_reason: chunkData.done ? (chunkData.done_reason || 'stop') : null,
              };
              yield streamChunk;

              if (chunkData.message?.content) {
                aggregatedResponse.content = (aggregatedResponse.content || '') + chunkData.message.content;
              }
              if (chunkData.done) {
                aggregatedResponse.finish_reason = chunkData.done_reason || 'stop';
                aggregatedResponse.usage = {
                  prompt_tokens: chunkData.prompt_eval_count,
                  completion_tokens: chunkData.eval_count,
                  total_tokens: (chunkData.prompt_eval_count || 0) + (chunkData.eval_count || 0),
                };
                return aggregatedResponse; // Ollama sends full stats in the final 'done' chunk
              }
            } catch (e) {
              console.error('Error parsing Ollama stream chunk:', e, 'Raw line:', line);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    // This part should ideally not be reached if Ollama always sends a 'done:true' chunk.
    return aggregatedResponse; 
  }

  async testConnection(config: LLMProviderConfig): Promise<{success: boolean, error?: string, message?: string}> {
    const providerConfig = this.getConfig(config);
    try {
      // Ollama's /api/tags is a good lightweight check
      await this.listModels(providerConfig);
      return { success: true, message: `Successfully connected to Ollama at ${providerConfig.baseUrl}.` };
    } catch (e: any) {
      console.error(`Ollama testConnection error for ${providerConfig.baseUrl}:`, e);
      return { success: false, error: e.message || `Unknown error during Ollama test connection to ${providerConfig.baseUrl}.` };
    }
  }
}
