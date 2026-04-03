import { providerRegistry } from './ProviderRegistry';
import {
  ILLMCompletionRequest,
  ILLMCompletionResponse,
  ILLMModel,
  ILLMStreamChunk,
  LLMProviderConfig,
  ILLMOutput,
  ILLMMessage
} from './types';
import { BaseProvider } from './BaseProvider';

/**
 * Gemini Provider for Google's Gemini API
 * 
 * Key differences from OpenAI API:
 * - Uses "contents" instead of "messages"
 * - Each content has "parts" array instead of direct content
 * - Assistant role is called "model"
 * - System instruction is separate from contents
 * - Streaming uses SSE with different endpoint
 * - Structured output uses responseMimeType and responseJsonSchema
 */
export class GeminiProvider extends BaseProvider {
  providerId = 'gemini';
  name = 'Google Gemini';
  
  private readonly DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetry(error: any): boolean {
    if (error.status) {
      const status = error.status;
      // Retry on rate limiting (429) or server errors (5xx)
      return status === 429 || (status >= 500 && status < 600);
    }
    // Retry on network errors
    return error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND';
  }

  /**
   * Get the base URL for Gemini API
   */
  private getGeminiBaseUrl(config: LLMProviderConfig): string {
    return config.baseUrl || this.DEFAULT_BASE_URL;
  }

  /**
   * Convert OpenAI-style messages to Gemini contents format
   */
  private convertMessagesToGeminiFormat(messages: ILLMMessage[]): {
    contents: GeminiContent[];
    systemInstruction?: GeminiContent;
  } {
    const contents: GeminiContent[] = [];
    let systemInstruction: GeminiContent | undefined;

    for (const message of messages) {
      // Handle system messages separately
      if (message.role === 'system') {
        // Merge multiple system messages
        if (systemInstruction) {
          systemInstruction.parts.push({ text: '\n\n' + message.content });
        } else {
          systemInstruction = {
            role: 'user',
            parts: [{ text: message.content }]
          };
        }
        continue;
      }

      // Convert role names
      const geminiRole = message.role === 'assistant' ? 'model' : 'user';
      
      const content: GeminiContent = {
        role: geminiRole,
        parts: [{ text: message.content }]
      };

      contents.push(content);
    }

    return { contents, systemInstruction };
  }

  /**
   * Build generation config from request parameters
   */
  private buildGenerationConfig(request: ILLMCompletionRequest): GeminiGenerationConfig {
    const config: GeminiGenerationConfig = {};

    if (request.temperature !== undefined) {
      config.temperature = request.temperature;
    }

    if (request.max_tokens !== undefined) {
      config.maxOutputTokens = request.max_tokens;
    }

    if (request.top_p !== undefined) {
      config.topP = request.top_p;
    }

    // Gemini also supports topK
    if ((request as any).top_k !== undefined) {
      config.topK = (request as any).top_k;
    }

    // Handle structured output (JSON schema)
    if (request.response_format) {
      if (request.response_format.type === 'json_schema' && request.response_format.json_schema) {
        config.responseMimeType = 'application/json';
        // Gemini uses responseJsonSchema for the schema
        config.responseJsonSchema = this.convertJsonSchemaToGeminiFormat(
          request.response_format.json_schema.schema || request.response_format.json_schema
        );
      } else if (request.response_format.type === 'json_object') {
        config.responseMimeType = 'application/json';
      }
    }

    return config;
  }

  /**
   * Convert JSON Schema to Gemini-compatible format
   * Gemini supports a subset of JSON Schema
   */
  private convertJsonSchemaToGeminiFormat(schema: any): any {
    if (!schema || typeof schema !== 'object') {
      return schema;
    }

    // Gemini doesn't support all JSON Schema features, but most common ones work
    // Just pass through and let Gemini handle it
    const result: any = {};

    // Copy supported properties
    const supportedProps = [
      'type', 'properties', 'required', 'items', 'enum', 'description',
      'minimum', 'maximum', 'minItems', 'maxItems', 'additionalProperties',
      'anyOf', 'oneOf', '$ref', '$defs', 'prefixItems', 'format', 'title'
    ];

    for (const prop of supportedProps) {
      if (schema[prop] !== undefined) {
        if (prop === 'properties') {
          result[prop] = {};
          for (const [key, value] of Object.entries(schema[prop])) {
            result[prop][key] = this.convertJsonSchemaToGeminiFormat(value);
          }
        } else if (prop === 'items' || prop === 'additionalProperties') {
          result[prop] = this.convertJsonSchemaToGeminiFormat(schema[prop]);
        } else if (prop === 'anyOf' || prop === 'oneOf' || prop === 'prefixItems') {
          result[prop] = schema[prop].map((s: any) => this.convertJsonSchemaToGeminiFormat(s));
        } else {
          result[prop] = schema[prop];
        }
      }
    }

    return result;
  }

  /**
   * Build the request body for Gemini API
   */
  private buildRequestBody(request: ILLMCompletionRequest): GeminiRequestBody {
    const { contents, systemInstruction } = this.convertMessagesToGeminiFormat(request.messages);
    const generationConfig = this.buildGenerationConfig(request);

    const body: GeminiRequestBody = {
      contents,
      generationConfig
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    // Convert OpenAI-style tools to Gemini functionDeclarations
    if (request.tools && request.tools.length > 0) {
      body.tools = [{
        functionDeclarations: request.tools.map(tool => ({
          name: tool.function.name,
          description: tool.function.description || '',
          parameters: tool.function.parameters ? this.convertJsonSchemaToGeminiFormat(tool.function.parameters) : undefined,
        }))
      }];
    }

    return body;
  }

  async listModels(config: LLMProviderConfig): Promise<ILLMModel[]> {
    const baseUrl = this.getGeminiBaseUrl(config);
    const apiKey = this.getAPIKey(config);

    try {
      const response = await fetch(`${baseUrl}/models?key=${apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`GeminiProvider: Failed to fetch models (${response.status})`);
        return this.getDefaultModels();
      }

      const data = await response.json();
      
      if (!data.models || !Array.isArray(data.models)) {
        console.warn('GeminiProvider: Unexpected response format from /models endpoint');
        return this.getDefaultModels();
      }

      // Filter to only include Gemini models that support generateContent
      return data.models
        .filter((model: any) => 
          model.supportedGenerationMethods?.includes('generateContent') &&
          model.name?.includes('gemini')
        )
        .map((model: any): ILLMModel => ({
          id: model.name.replace('models/', ''),
          name: model.displayName || model.name.replace('models/', ''),
          contextLength: model.inputTokenLimit,
        }));
    } catch (error) {
      console.warn('GeminiProvider: Error fetching models:', error);
      return this.getDefaultModels();
    }
  }

  /**
   * Default models if API call fails
   */
  private getDefaultModels(): ILLMModel[] {
    return [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextLength: 2000000 },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextLength: 1000000 },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', contextLength: 1000000 },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextLength: 1000000 },
    ];
  }

  chatCompletion(
    request: ILLMCompletionRequest,
    config: LLMProviderConfig
  ): ILLMOutput {
    const baseUrl = this.getGeminiBaseUrl(config);
    const apiKey = this.getAPIKey(config);
    const modelName = request.model.startsWith('models/') ? request.model : `models/${request.model}`;

    if (request.stream) {
      return this._streamChatCompletion(baseUrl, apiKey, modelName, request);
    } else {
      return this._nonStreamChatCompletion(baseUrl, apiKey, modelName, request);
    }
  }

  private async _nonStreamChatCompletion(
    baseUrl: string,
    apiKey: string,
    modelName: string,
    request: ILLMCompletionRequest
  ): Promise<ILLMCompletionResponse> {
    const body = this.buildRequestBody(request);

    try {
      const response = await this.retryWithBackoff(
        async () => {
          const res = await fetch(`${baseUrl}/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const errorBody = await res.text();
            const error: any = new Error(`Gemini API error: ${res.status} - ${errorBody}`);
            error.status = res.status;
            throw error;
          }

          return res.json();
        },
        3,
        1000,
        this.shouldRetry.bind(this)
      );

      return this.parseGeminiResponse(response);
    } catch (error: any) {
      console.error(`[GeminiProvider] API error for model ${request.model}:`, error);
      throw new Error(`Gemini API error: ${error.message || error}`);
    }
  }

  private async *_streamChatCompletion(
    baseUrl: string,
    apiKey: string,
    modelName: string,
    request: ILLMCompletionRequest
  ): AsyncGenerator<ILLMStreamChunk> {
    const body = this.buildRequestBody(request);
    const url = `${baseUrl}/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;

    let response: Response;
    try {
      response = await this.retryWithBackoff(
        async () => {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: request.signal,
          });

          if (!res.ok) {
            const errorBody = await res.text();
            const error: any = new Error(`Gemini API error: ${res.status} - ${errorBody}`);
            error.status = res.status;
            throw error;
          }

          return res;
        },
        3,
        1000,
        this.shouldRetry.bind(this)
      );
    } catch (error: any) {
      if (request.signal?.aborted) {
        throw new Error('AbortError: Message cancelled');
      }
      console.error(`[GeminiProvider] Stream error for model ${request.model}:`, error);
      throw new Error(`Gemini API stream error: ${error.message || error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Gemini API: No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedContent = '';
    let firstChunkId = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const chunk = this.parseGeminiStreamChunk(parsed);
              
              if (!firstChunkId && chunk.id) {
                firstChunkId = chunk.id;
              }

              if (chunk.delta?.content) {
                accumulatedContent += chunk.delta.content;
              }

              yield chunk;
            } catch (parseError) {
              // Skip malformed JSON
              console.warn('[GeminiProvider] Failed to parse SSE data:', data);
            }
          }
        }
      }

      // Return final aggregated response
      return {
        id: firstChunkId,
        content: accumulatedContent,
        finish_reason: 'stop',
      };
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parse Gemini API response to our format
   */
  private parseGeminiResponse(response: GeminiResponse): ILLMCompletionResponse {
    const candidate = response.candidates?.[0];
    
    if (!candidate) {
      // Check for prompt feedback (blocked content)
      if (response.promptFeedback?.blockReason) {
        throw new Error(`Gemini API: Prompt blocked - ${response.promptFeedback.blockReason}`);
      }
      throw new Error('Gemini API: No candidates in response');
    }

    // Extract text and function calls from parts
    let content = '';
    const toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];
    
    if (candidate.content?.parts) {
      for (let i = 0; i < candidate.content.parts.length; i++) {
        const part = candidate.content.parts[i];
        if (part.text) {
          content += part.text;
        }
        if (part.functionCall) {
          toolCalls.push({
            id: `call_gemini_${i}`,
            type: 'function',
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args || {}),
            }
          });
        }
      }
    }

    // Map finish reason
    const finishReasonMap: Record<string, string> = {
      'STOP': 'stop',
      'MAX_TOKENS': 'length',
      'SAFETY': 'content_filter',
      'RECITATION': 'content_filter',
      'OTHER': 'stop',
    };

    const usage = response.usageMetadata ? {
      prompt_tokens: response.usageMetadata.promptTokenCount,
      completion_tokens: response.usageMetadata.candidatesTokenCount,
      total_tokens: response.usageMetadata.totalTokenCount,
    } : undefined;

    return {
      id: response.responseId || undefined,
      content: content || null,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      finish_reason: candidate.finishReason ? finishReasonMap[candidate.finishReason] || 'stop' : 'stop',
      usage,
    };
  }

  /**
   * Parse Gemini streaming chunk
   */
  private parseGeminiStreamChunk(chunk: GeminiResponse): ILLMStreamChunk {
    const candidate = chunk.candidates?.[0];
    
    if (!candidate) {
      return {
        id: chunk.responseId,
        delta: undefined,
        finish_reason: null,
      };
    }

    // Extract text from parts
    let content = '';
    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          content += part.text;
        }
      }
    }

    const finishReasonMap: Record<string, string> = {
      'STOP': 'stop',
      'MAX_TOKENS': 'length',
      'SAFETY': 'content_filter',
      'RECITATION': 'content_filter',
      'OTHER': 'stop',
    };

    return {
      id: chunk.responseId,
      delta: {
        content: content || undefined,
        role: 'assistant',
      },
      finish_reason: candidate.finishReason ? finishReasonMap[candidate.finishReason] || null : null,
    };
  }

  async testConnection(config: LLMProviderConfig): Promise<{success: boolean, error?: string, message?: string}> {
    try {
      const testRequest: ILLMCompletionRequest = {
        model: config.defaultModel || 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
        stream: false,
      };
      
      const response = await (this.chatCompletion(testRequest, config) as Promise<ILLMCompletionResponse>);
      if (response && (response.content !== null || response.id)) {
        return { success: true, message: `Successfully connected to Gemini. Response: ${response.content?.substring(0, 50) || '(empty)'}` };
      }
      return { success: false, error: 'Test connection to Gemini failed to get a valid response.' };
    } catch (e: any) {
      console.error('Gemini testConnection error:', e);
      return { success: false, error: e.message || 'Unknown error during Gemini test connection.' };
    }
  }
}

// --- Gemini API Types ---

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseJsonSchema?: any;
  stopSequences?: string[];
}

interface GeminiRequestBody {
  contents: GeminiContent[];
  generationConfig: GeminiGenerationConfig;
  systemInstruction?: GeminiContent;
  tools?: Array<{
    functionDeclarations: Array<{
      name: string;
      description: string;
      parameters?: any;
    }>;
  }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts: Array<{ text?: string; functionCall?: { name: string; args?: Record<string, any> } }>;
      role: string;
    };
    finishReason?: string;
    safetyRatings?: any[];
  }>;
  promptFeedback?: {
    blockReason?: string;
    safetyRatings?: any[];
  };
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  responseId?: string;
  modelVersion?: string;
}

// Register this provider with the registry
providerRegistry.register('gemini', GeminiProvider);
