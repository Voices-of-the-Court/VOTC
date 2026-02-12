import { providerRegistry } from './ProviderRegistry';
import {
  ILLMCompletionRequest,
  ILLMCompletionResponse,
  ILLMStreamChunk,
  ILLMOutput,
} from './types';
import { BaseProvider } from './BaseProvider';
import OpenAI from 'openai'; // Import OpenAI SDK

export class Player2Provider extends BaseProvider {
  providerId = 'player2';
  name = 'Player2';

  /**
   * Override validateConfig to skip API key requirement for Player2
   * Player2 runs locally and doesn't need a real API key
   */
  protected validateConfig(config: any): void {
    // Player2 doesn't require API key validation since it uses a dummy key
    // Just validate that we have a model
    if (!config.defaultModel) {
      throw new Error(`Default model is required for ${this.name}`);
    }
  }

  /**
   * Override listModels to return empty array since Player2 doesn't support model listing
   */
  async listModels(): Promise<any[]> {
    // Player2 doesn't support dynamic model listing
    return [];
  }

  /**
   * Determine if an error should trigger a retry
   * @param error The error to check
   * @returns true if the error is retryable
   */
  private shouldRetryPlayer2(error: any): boolean {
    if (error instanceof OpenAI.APIError) {
      const status = error.status;
      // Retry on rate limiting (429) or server errors (5xx)
      return status === 429 || (status >= 500 && status < 600);
    }
    // Retry on network errors or other transient issues
    // OpenAI SDK typically wraps these in APIError, but as fallback
    return error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND';
  }

  chatCompletion(
      request: ILLMCompletionRequest,
    ): ILLMOutput {
      const openAIClient = new OpenAI({
        apiKey: "sk-dummy-key",
        baseURL: 'http://127.0.0.1:4315/v1',
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
        ...(request.response_format ? { response_format: request.response_format as any } : {}),
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
      this.shouldRetryPlayer2.bind(this)
    );

    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error(`Player2 SDK: No choices returned for model ${request.model}`);
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
    // OpenAI SDK provides a rich APIError type
    if (error instanceof OpenAI.APIError) {
      console.error(
        `[Player2Provider] API error for model ${request.model}:`,
        error.status,
        error.name,
        error.message
      );
      throw new Error(`Player2 API error via SDK: ${error.status} ${error.name} - ${error.message}`);
    }

    console.error(`[Player2Provider] Unexpected error for model ${request.model}:`, error);
    throw new Error(`Unexpected Player2 SDK error: ${error.message || error}`);
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
        this.shouldRetryPlayer2.bind(this)
      );
      const contentParts: string[] = [];
      const toolCallsMap: Record<string, any> = {};
      let finalUsage = undefined;
      let finalFinishReason: string | null | undefined = null;
      let firstChunkId = '';

      for await (const chunk of stream) {
        const choice = chunk.choices[0];

        if ((choice?.finish_reason as string) === "error") {
          // Use type assertion since Player2 adds non-standard error property
          const choiceWithError = choice as any
          if (choiceWithError.error) {
            const error = choiceWithError.error
            console.error(
              `Player2 Mid-Stream Error: ${error?.code || "Unknown"} - ${error?.message || "Unknown error"}`,
            )
            // Format error details
            const errorDetails = typeof error === "object" ? JSON.stringify(error, null, 2) : String(error)
            throw new Error(`Player2 Mid-Stream Error: ${errorDetails}`)
          } else {
            // Fallback if error details are not available
            throw new Error(
              `Player2 Mid-Stream Error: Stream terminated with error status but no error details provided`,
            )
          }
        }
        
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
        console.info(`[Player2Provider] OpenAI SDK stream cancelled for model ${request.model}:`, error);
        throw new Error(`AbortError: Message cancelled`);
      }
      console.error(`[Player2Provider] OpenAI SDK stream error for model ${request.model}:`, error);
      if (error instanceof OpenAI.APIError) {
        throw new Error(`Player2 API stream error via SDK: ${error.status} ${error.name} - ${error.message}`);
      }
      throw new Error(`Player2 API stream error via SDK: ${error.message || 'Unknown error'}`);
    }
  }

  async testConnection(): Promise<{success: boolean, error?: string, message?: string}> {
    try {
      const testRequest: ILLMCompletionRequest = {
        model: 'gpt-oss-120b', // Use a known cheap/fast model or user's default
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 1,
        stream: false,
      };
      
      const response = await (this.chatCompletion(testRequest) as Promise<ILLMCompletionResponse>);
      if (response && (response.content || response.id)) {
        return { success: true, message: `Successfully connected to Player2. Received response ID: ${response.id}` };
      }
      return { success: false, error: 'Test connection to Player2 failed to get a valid response.' };
    } catch (e: any) {
      console.error('Player2 testConnection error:', e);
      return { success: false, error: e.message || 'Unknown error during Player2 test connection.' };
    }
  }
}


// Register this provider with the registry
providerRegistry.register('player2', Player2Provider);
