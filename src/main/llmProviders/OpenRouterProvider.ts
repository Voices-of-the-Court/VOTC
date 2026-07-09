import { providerRegistry } from './ProviderRegistry';
import {
  ILLMCompletionRequest,
  ILLMCompletionResponse,
  ILLMModel,
  ILLMStreamChunk,
  OpenRouterConfig,
  LLMProviderConfig,
  ILLMOutput,
  ConnectionTestResult,
  isOpenRouterErrorResponse
} from './types';
import { BaseProvider } from './BaseProvider';
import { runConnectionTests } from './connectionTest';
import OpenAI from 'openai'; // Import OpenAI SDK

const isAnthropicModel = (model: string): boolean => typeof model === 'string' && model.startsWith('anthropic/');

// Helper to identify OpenRouter free models
const isOpenRouterFreeModel = (modelData: any): boolean => {
  return modelData.id.endsWith(':free') ||
         (modelData.pricing?.prompt === '0.000000' && modelData.pricing?.completion === '0.000000');
};

/**
 * Extract cache-related usage fields from an OpenRouter/OpenAI usage object.
 * OpenRouter exposes cache stats under `prompt_tokens_details`:
 *   - cached_tokens     = tokens read from cache (cache hit)
 *   - cache_write_tokens = tokens written to cache on this request
 * For Anthropic-direct responses the native fields may also be present, so we fall
 * back to them for robustness.
 */
function extractCacheUsage(usage: any): {
  prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
  cache_discount?: number;
} {
  if (!usage || typeof usage !== 'object') return {};
  const details = usage.prompt_tokens_details;
  const cached = details?.cached_tokens ?? usage.cache_read_input_tokens;
  const written = details?.cache_write_tokens ?? usage.cache_creation_input_tokens;
  const discount = usage.cache_discount;
  const out: any = {};
  if (cached !== undefined || written !== undefined) {
    out.prompt_tokens_details = {
      cached_tokens: cached ?? 0,
      cache_write_tokens: written ?? 0,
    };
  }
  if (discount !== undefined) out.cache_discount = discount;
  return out;
}

/**
 * Convert a message's content to the array form and attach `cache_control` to its
 * last text block (Anthropic-native format, passed through by OpenRouter).
 * Skips tiny contents (< 50 chars) so we never waste a breakpoint on a trivial block.
 */
function markMessageForCache(message: any, ttl: '1h' | undefined): boolean {
  const cacheControl = ttl ? { type: 'ephemeral', ttl } : { type: 'ephemeral' };
  if (typeof message.content === 'string') {
    message.content = [{ type: 'text', text: message.content, cache_control: cacheControl }];
    return true;
  } else if (Array.isArray(message.content) && message.content.length > 0) {
    for (let i = message.content.length - 1; i >= 0; i--) {
      const block = message.content[i];
      if (block && (block.type === 'text' || !block.type)) {
        block.cache_control = cacheControl;
        return true;
      }
    }
  }
  return false;
}

export function injectCacheBreakpoint( // for an Anthropic chat request
  messages: any[],
  ttl: '1h' | undefined,
  historyEndIndex?: number
): void {
  if (!Array.isArray(messages) || messages.length === 0) return;

  if (historyEndIndex == null || historyEndIndex < 0 || historyEndIndex >= messages.length) {
    console.log('[OpenRouter][cache] no breakpoint (history boundary missing or out of range)');
    return;
  }

  const target = messages[historyEndIndex];
  if (!target || target.role !== 'user') {
    console.log(
      `[OpenRouter][cache] no breakpoint (idx=${historyEndIndex} role=${target?.role ?? 'n/a'}, wanted user)`
    );
    return;
  }

  if (markMessageForCache(target, ttl)) {
    console.log(`[OpenRouter][cache] breakpoint idx=${historyEndIndex} role=user (history)`);
  } else {
    console.log(`[OpenRouter][cache] no breakpoint (idx=${historyEndIndex} content below 50-char threshold)`);
  }
}


export class OpenRouterProvider extends BaseProvider {
  providerId = 'openrouter';
  name = 'OpenRouter';

  /**
   * Determine if an error should trigger a retry
   * @param error The error to check
   * @returns true if the error is retryable
   */
  private shouldRetryOpenRouter(error: any): boolean {
    if (error instanceof OpenAI.APIError) {
      const status = error.status;
      // Retry on rate limiting (429) or server errors (5xx)
      return status === 429 || (status >= 500 && status < 600);
    }
    // Retry on network errors or other transient issues
    // OpenAI SDK typically wraps these in APIError, but as fallback
    return error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND';
  }

  async listModels(config: LLMProviderConfig): Promise<ILLMModel[]> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAPIKey(config)}`,
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

  chatCompletion(
      request: ILLMCompletionRequest,
      config: OpenRouterConfig
    ): ILLMOutput {
      const openAIClient = new OpenAI({
        apiKey: this.getAPIKey(config),
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://github.com/Voices-of-the-Court/VOTC',
          'X-Title': 'Voices of the Court 2.0',
        },
      });
  
      const requestParams = {
        model: request.model,
        messages: request.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        stream: request.stream,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        top_p: request.top_p,
        presence_penalty: request.presence_penalty,
        frequency_penalty: request.frequency_penalty,
        ...(request.response_format ? { response_format: request.response_format as any } : {}),
        // OpenRouter-specific: exclude reasoning/thinking tokens from the response
        reasoning: {
          exclude: true,
        },
      } as OpenAI.Chat.Completions.ChatCompletionCreateParams;

      const wantsExplicitCacheControl = request.cacheControl?.enabled === true
        && request.requestKind === 'chat'
        && isAnthropicModel(request.model);
      if (wantsExplicitCacheControl) {
        const ttl: '1h' | undefined = request.cacheControl?.ttl === '5m' ? undefined : '1h';
        // Clone messages so cache_control markers don't mutate the caller's request
        // object (which Conversation also logs). structuredClone preserves the
        // array-of-blocks content shape.
        requestParams.messages = structuredClone(requestParams.messages);
        injectCacheBreakpoint(requestParams.messages, ttl, request.cacheHistoryEndIndex);
        (requestParams as any).provider = {
          order: ['Anthropic'],
          allow_fallbacks: true,
        };
      }
      // session_id enables sticky routing for both Anthropic (explicit) and implicitly
      // cached models (OpenAI/DeepSeek/Gemini). Harmless when not caching.
      if (request.sessionId) {
        (requestParams as any).session_id = request.sessionId;
      }
  
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
      this.shouldRetryOpenRouter.bind(this)
    );

    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error(`OpenRouter SDK: No choices returned for model ${request.model}`);
    }

    const usage = data.usage
      ? {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens,
          ...extractCacheUsage(data.usage),
        }
      : undefined;

    // log cache hit/write stats
    if (usage?.prompt_tokens_details) {
      const d = usage.prompt_tokens_details;
      const promptTok = usage.prompt_tokens ?? 0;
      const cached = d.cached_tokens ?? 0;
      const written = d.cache_write_tokens ?? 0;
      const hitPct = promptTok > 0 ? Math.round((cached / promptTok) * 100) : 0;
      console.log(
        `[OpenRouter][cache] model=${request.model} prompt=${promptTok} ` +
        `cached=${cached} (${hitPct}%) written=${written} ` +
        (usage.cache_discount !== undefined ? `discount=${usage.cache_discount}` : '')
      );
    }

    return {
      id: data.id,
      content: choice.message?.content ?? null,
      tool_calls: choice.message?.tool_calls,
      finish_reason: choice.finish_reason ?? null,
      usage,
    };
  } catch (error: any) {
    // OpenAI SDK provides a rich APIError type
    if (error instanceof OpenAI.APIError) {
      console.error(
        `[OpenRouterProvider] API error for model ${request.model}:`,
        error.status,
        error.name,
        error.message,
        (error as any).metadata?.raw
      );
      throw new Error(`OpenRouter API error via SDK: ${error.status} ${error.name} - ${error.message}`);
    }

    console.error(`[OpenRouterProvider] Unexpected error for model ${request.model}:`, error);
    throw new Error(`Unexpected OpenRouter SDK error: ${error.message || error}`);
  }
}

  private async *_streamChatCompletion(
    request: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
    openAIClient: OpenAI,
    signal?: AbortSignal
  ): AsyncGenerator<ILLMStreamChunk> {

    try {
      const stream = await this.retryWithBackoff(
        () => openAIClient.chat.completions.create(request),
        7,
        1000,
        this.shouldRetryOpenRouter.bind(this)
      );
      const contentParts: string[] = [];
      const toolCallsMap: Record<string, any> = {};
      let finalUsage: any = undefined;
      let finalFinishReason: string | null | undefined = null;
      let firstChunkId = '';

      for await (const chunk of stream) {
        const choice = chunk.choices[0];

        if ((choice?.finish_reason as string) === "error") {
          // Use type assertion since OpenRouter adds non-standard error property
          const choiceWithError = choice as any
          if (choiceWithError.error) {
            const error = choiceWithError.error
            console.error(
              `OpenRouter Mid-Stream Error: ${error?.code || "Unknown"} - ${error?.message || "Unknown error"}`,
            )
            // Format error details
            const errorDetails = typeof error === "object" ? JSON.stringify(error, null, 2) : String(error)
            throw new Error(`OpenRouter Mid-Stream Error: ${errorDetails}`)
          } else {
            // Fallback if error details are not available
            throw new Error(
              `OpenRouter Mid-Stream Error: Stream terminated with error status but no error details provided`,
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

      // Normalize usage: OpenRouter's streaming final chunk already carries
      // prompt_tokens_details (cached_tokens / cache_write_tokens) and cache_discount
      // as raw fields. Merge our canonical cache breakdown so callers always see it.
      const normalizedUsage = finalUsage
        ? {
            prompt_tokens: finalUsage.prompt_tokens,
            completion_tokens: finalUsage.completion_tokens,
            total_tokens: finalUsage.total_tokens,
            ...extractCacheUsage(finalUsage),
          }
        : undefined;

      // log cache hit/write stats
      if (normalizedUsage?.prompt_tokens_details) {
        const d = normalizedUsage.prompt_tokens_details;
        const promptTok = normalizedUsage.prompt_tokens ?? 0;
        const cached = d.cached_tokens ?? 0;
        const written = d.cache_write_tokens ?? 0;
        const hitPct = promptTok > 0 ? Math.round((cached / promptTok) * 100) : 0;
        console.log(
          `[OpenRouter][cache] model=${request.model} prompt=${promptTok} ` +
          `cached=${cached} (${hitPct}%) written=${written} ` +
          (normalizedUsage.cache_discount !== undefined ? `discount=${normalizedUsage.cache_discount}` : '')
        );
      }

      return {
        id: firstChunkId,
        content: contentParts.join(''),
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        finish_reason: finalFinishReason,
        usage: normalizedUsage
      };
    } catch (error: any) {
      if (signal?.aborted) {
        console.info(`[OpenRouterProvider] OpenAI SDK stream cancelled for model ${request.model}:`, error);
        throw new Error(`AbortError: Message cancelled`);
      }
      console.error(`[OpenRouterProvider] OpenAI SDK stream error for model ${request.model}:`, error);
      if (isOpenRouterErrorResponse(error)) {
        const openRouterError = error.error
        const metadataStr = openRouterError.metadata ? `\nMetadata: ${JSON.stringify(openRouterError.metadata, null, 2)}` : ""
        console.error(`OpenRouter API stream error via SDK: ${openRouterError.code} - ${openRouterError.message} ${metadataStr}`);
        throw new Error(`OpenRouter API stream error via SDK: ${openRouterError.code} - ${openRouterError.message} ${metadataStr}`);
      }
      if (error instanceof OpenAI.APIError) {
        throw new Error(`OpenRouter API stream error via SDK: ${error.status} ${error.name} - ${error.message}`);
      }
      throw new Error(`OpenRouter API stream error via SDK: ${error.message || 'Unknown error'}`);
    }
  }

  async testConnection(config: OpenRouterConfig): Promise<ConnectionTestResult> {
    try {
      return await runConnectionTests(this, config, { model: config.defaultModel || 'openrouter/auto' });
    } catch (e: any) {
      console.error('OpenRouter testConnection error:', e);
      return { success: false, error: e?.message || 'Unknown error during OpenRouter test connection.' };
    }
  }
}


// Register this provider with the registry
providerRegistry.register('openrouter', OpenRouterProvider);
