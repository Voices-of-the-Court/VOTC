import { providerRegistry } from './ProviderRegistry';
import {
  ILLMCompletionRequest,
  ILLMCompletionResponse,
  ILLMModel,
  ILLMStreamChunk,
  DeepseekConfig,
  LLMProviderConfig,
  ILLMOutput
} from './types';
import { BaseProvider } from './BaseProvider';
import OpenAI from 'openai';

/**
 * Deepseek Provider
 * 
 * Deepseek API is OpenAI-compatible but with important differences:
 * - Does NOT support `response_format: { type: 'json_schema', json_schema: {...} }`
 * - Only supports `response_format: { type: 'json_object' }` for JSON output
 * - For structured outputs, the JSON schema must be described in the prompt
 * - Models: 'deepseek-chat', 'deepseek-reasoner'
 */
export class DeepseekProvider extends BaseProvider {
  providerId = 'deepseek';
  name = 'Deepseek';
  
  // Deepseek uses a fixed base URL
  private readonly DEFAULT_BASE_URL = 'https://api.deepseek.com';

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetry(error: any): boolean {
    if (error instanceof OpenAI.APIError) {
      const status = error.status;
      // Retry on rate limiting (429) or server errors (5xx)
      return status === 429 || (status >= 500 && status < 600);
    }
    // Retry on network errors
    return error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND';
  }

  /**
   * Get the base URL for Deepseek API
   */
  private getDeepseekBaseUrl(config: LLMProviderConfig): string {
    return config.baseUrl || this.DEFAULT_BASE_URL;
  }

  async listModels(_: LLMProviderConfig): Promise<ILLMModel[]> {
    // Deepseek has a fixed set of models, return them directly
    // The API does have a /models endpoint but the models are known
    return [
      { id: 'deepseek-chat', name: 'Deepseek Chat' },
      { id: 'deepseek-reasoner', name: 'Deepseek Reasoner' },
    ];
  }

  chatCompletion(
    request: ILLMCompletionRequest,
    config: DeepseekConfig
  ): ILLMOutput {
    const baseUrl = this.getDeepseekBaseUrl(config);
    
    const openAIClient = new OpenAI({
      apiKey: this.getAPIKey(config),
      baseURL: baseUrl,
      maxRetries: 0,
    });

    // Transform the request for Deepseek compatibility
    const transformedRequest = this.transformRequestForDeepseek(request);

    const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: transformedRequest.model,
      messages: transformedRequest.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      stream: transformedRequest.stream,
      temperature: transformedRequest.temperature,
      max_tokens: transformedRequest.max_tokens,
      top_p: transformedRequest.top_p,
      presence_penalty: transformedRequest.presence_penalty,
      frequency_penalty: transformedRequest.frequency_penalty,
      // Deepseek only supports json_object, not json_schema
      ...(transformedRequest.response_format ? { response_format: transformedRequest.response_format as any } : {}),
      ...(transformedRequest.stream ? { stream_options: { include_usage: true } } : {}),
    };

    if (requestParams.stream) {
      return this._streamChatCompletion(requestParams, openAIClient, request.signal);
    } else {
      return this._nonStreamChatCompletion(requestParams, openAIClient);
    }
  }

  /**
   * Transform the request for Deepseek compatibility
   * - Converts json_schema response_format to json_object with schema in prompt
   */
  private transformRequestForDeepseek(request: ILLMCompletionRequest): ILLMCompletionRequest {
    const transformed = { ...request };
    
    // Check if this is a json_schema request (used for actions)
    if (request.response_format?.type === 'json_schema' && request.response_format.json_schema) {
      const jsonSchemaObj = request.response_format.json_schema;
      const schemaName = jsonSchemaObj.name || 'response';
      const schemaObj = jsonSchemaObj.schema;
      
      // Convert json_schema to json_object and inject schema into the system prompt
      transformed.response_format = { type: 'json_object' };
      
      // Inject the schema description into the last system message or add a new one
      const schemaDescription = this.buildSchemaDescription(schemaName, schemaObj);
      
      // Find the last system message and append schema info, or add a new system message
      const messages = [...request.messages];
      let schemaInjected = false;
      
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'system') {
          messages[i] = {
            ...messages[i],
            content: messages[i].content + '\n\n' + schemaDescription
          };
          schemaInjected = true;
          break;
        }
      }
      
      if (!schemaInjected) {
        // Add a new system message at the beginning if no system message exists
        messages.unshift({
          role: 'system',
          content: schemaDescription
        });
      }
      
      transformed.messages = messages;
    }
    
    return transformed;
  }

  /**
   * Build a human-readable schema description for the prompt
   */
  private buildSchemaDescription(schemaName: string, schema: any): string {
    let description = `You MUST respond with valid JSON matching this schema:\n`;
    description += `Schema name: ${schemaName}\n`;
    
    if (schema.properties) {
      description += this.describeObjectSchema(schema, 0);
    }
    
    description += `\nIMPORTANT: Your response must be ONLY valid JSON. No prose, no code fences, no explanations.`;
    
    return description;
  }

  /**
   * Recursively describe an object schema
   */
  private describeObjectSchema(schema: any, indent: number): string {
    const spaces = '  '.repeat(indent);
    let result = '';
    
    if (schema.type === 'object' && schema.properties) {
      const required = schema.required || [];
      
      for (const [key, value] of Object.entries(schema.properties)) {
        const isRequired = required.includes(key);
        const reqMarker = isRequired ? ' (required)' : ' (optional)';
        
        if ((value as any).type === 'array') {
          const items = (value as any).items;
          if ((items as any).anyOf) {
            result += `${spaces}- ${key}: array of objects${reqMarker}\n`;
            result += this.describeAnyOfSchema(items, indent + 1);
          } else if ((items as any).type === 'object') {
            result += `${spaces}- ${key}: array of objects${reqMarker}\n`;
            result += this.describeObjectSchema(items, indent + 1);
          } else {
            result += `${spaces}- ${key}: array of ${(items as any).type}${reqMarker}\n`;
          }
        } else if ((value as any).type === 'object') {
          result += `${spaces}- ${key}: object${reqMarker}\n`;
          result += this.describeObjectSchema(value, indent + 1);
        } else if ((value as any).anyOf) {
          result += `${spaces}- ${key}: ${(value as any).anyOf.map((t: any) => t.type).join(' | ')}${reqMarker}\n`;
        } else if ((value as any).const !== undefined) {
          result += `${spaces}- ${key}: "${(value as any).const}" (constant)${reqMarker}\n`;
        } else if ((value as any).enum) {
          result += `${spaces}- ${key}: enum{${(value as any).enum.join(', ')}}${reqMarker}\n`;
        } else {
          result += `${spaces}- ${key}: ${(value as any).type}${reqMarker}\n`;
        }
      }
    }
    
    return result;
  }

  /**
   * Describe an anyOf schema (used for action variants)
   */
  private describeAnyOfSchema(schema: any, indent: number): string {
    const spaces = '  '.repeat(indent);
    let result = '';
    
    if (schema.anyOf) {
      schema.anyOf.forEach((variant: any, index: number) => {
        if (variant.properties?.actionId?.const) {
          const actionId = variant.properties.actionId.const;
          result += `${spaces}Variant ${index + 1} (actionId: "${actionId}"):\n`;
          result += this.describeObjectSchema(variant, indent + 1);
        }
      });
    }
    
    return result;
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
        throw new Error(`Deepseek: No choices returned for model ${request.model}`);
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
          `[DeepseekProvider] API error for model ${request.model}:`,
          error.status,
          error.name,
          error.message
        );
        throw new Error(`Deepseek API error: ${error.status} ${error.name} - ${error.message}`);
      }

      console.error(`[DeepseekProvider] Unexpected error for model ${request.model}:`, error);
      throw new Error(`Unexpected Deepseek API error: ${error.message || error}`);
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
        console.info(`[DeepseekProvider] Stream cancelled for model ${request.model}:`, error);
        throw new Error(`AbortError: Message cancelled`);
      }
      console.error(`[DeepseekProvider] Stream error for model ${request.model}:`, error);
      if (error instanceof OpenAI.APIError) {
        throw new Error(`Deepseek API stream error: ${error.status} ${error.name} - ${error.message}`);
      }
      throw new Error(`Deepseek API stream error: ${error.message || 'Unknown error'}`);
    }
  }

  async testConnection(config: DeepseekConfig): Promise<{success: boolean, error?: string, message?: string}> {
    try {
      const testRequest: ILLMCompletionRequest = {
        model: config.defaultModel || 'deepseek-chat',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 1,
        stream: false,
      };
      
      const response = await (this.chatCompletion(testRequest, config) as Promise<ILLMCompletionResponse>);
      if (response && (response.content || response.id)) {
        return { success: true, message: `Successfully connected to Deepseek. Received response ID: ${response.id}` };
      }
      return { success: false, error: 'Test connection to Deepseek failed to get a valid response.' };
    } catch (e: any) {
      console.error('Deepseek testConnection error:', e);
      return { success: false, error: e.message || 'Unknown error during Deepseek test connection.' };
    }
  }
}

// Register this provider with the registry
providerRegistry.register('deepseek', DeepseekProvider);
