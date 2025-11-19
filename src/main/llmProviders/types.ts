// src/main/llmProviders/types.ts

export interface ILLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string; // Optional: for identifying the source of a tool call or message
  tool_calls?: Array<{ // For when the assistant requests a tool call
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string; // JSON string of arguments
    };
  }>;
  tool_call_id?: string; // For messages that are responses from a tool
}

export interface ILLMModel {
  id: string; // Provider-specific model ID, e.g., "openai/gpt-4o", "ollama/llama3"
  name: string; // User-friendly name
  isFree?: boolean;
  contextLength?: number;
  // Other relevant properties like pricing, provider, etc. can be added as needed
}

export interface ILLMCompletionRequest {
  model: string;
  messages: ILLMMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  signal?: AbortSignal; // For cancelling requests
  // Provider-specific parameters can be handled within each implementation
  // or by adding an optional 'options?: Record<string, any>' field
}

// For streaming responses, each chunk might look like this
export interface ILLMStreamChunk {
  id?: string; // Stream chunk ID
  delta?: {
    content?: string | null;
    role?: 'assistant';
    tool_calls?: Array<{
      index: number;
      id?: string;
      type?: 'function';
      function?: {
        name?: string;
        arguments?: string;
      };
    }>;
  };
  finish_reason?: string | null;
  // Potentially usage stats in the final chunk if supported by provider & streaming
}

// For non-streaming or aggregated streaming response
export interface ILLMCompletionResponse {
  id?: string; // Completion ID
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  finish_reason?: string | null;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

// Unified type for LLM outputs, whether streamed or non-streamed
export type ILLMOutput = Promise<ILLMCompletionResponse> | AsyncGenerator<ILLMStreamChunk>;

export interface ILLMProvider {
  readonly providerId: string; // e.g., 'openrouter', 'openai-compatible', 'ollama'
  readonly name: string; // User-friendly name, e.g., "OpenRouter", "Custom OpenAI API", "Ollama"

  chatCompletion(
    request: ILLMCompletionRequest,
    config: LLMProviderConfig
  ): ILLMOutput;

  listModels?(config: LLMProviderConfig): Promise<ILLMModel[]>;

  testConnection?(config: LLMProviderConfig): Promise<{success: boolean, error?: string, message?: string}>;
}

// --- Provider Configurations ---
export type ProviderType = 'openrouter' | 'openai-compatible' | 'ollama';

export interface ProviderConfigBase {
  instanceId: string; // For base configs: 'openrouter', 'ollama', 'openai-compatible'. For presets: UUID.
  providerType: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  defaultParameters?: Partial<Omit<ILLMCompletionRequest, 'messages' | 'model' | 'stream'>>; // Parameters like temperature, max_tokens. Stream is global.
  // customName is now part of LLMProviderConfig for presets
  // isEnabled is removed
}

export type OpenRouterConfig = ProviderConfigBase & { providerType: 'openrouter'; };
export type OpenAICompatibleConfig = ProviderConfigBase & { providerType: 'openai-compatible'; };
export type OllamaConfig = ProviderConfigBase & { providerType: 'ollama'; baseUrl: string; }; // baseUrl is mandatory for Ollama

// LLMProviderConfig can be a base provider config or a preset.
// Presets will have a customName. Base configs can derive their name from providerType.
export type LLMProviderConfig = (OpenRouterConfig | OpenAICompatibleConfig | OllamaConfig) & {
  customName?: string; // User-defined name, primarily for presets.
};

export interface LLMSettings {
  providers: LLMProviderConfig[]; // Stores the 3 base configurations (one for each providerType)
  presets: LLMProviderConfig[];   // Stores user-created presets
  activeProviderInstanceId?: string | null; // instanceId of the active base config or preset
}

// General application settings
export interface AppSettings {
  llmSettings: LLMSettings;
  ck3UserFolderPath?: string | null;
  globalStreamEnabled?: boolean; // Global toggle for streaming
}


//////////

export type OpenRouterErrorResponse = {
	error: {
		message: string
		code: number
		metadata?: OpenRouterProviderErrorMetadata | OpenRouterModerationErrorMetadata | Record<string, unknown>
	}
}

export type OpenRouterProviderErrorMetadata = {
	provider_name: string // The name of the provider that encountered the error
	raw: unknown // The raw error from the provider
}

export type OpenRouterModerationErrorMetadata = {
	reasons: string[] // Why your input was flagged
	flagged_input: string // The text segment that was flagged, limited to 100 characters. If the flagged input is longer than 100 characters, it will be truncated in the middle and replaced with ...
	provider_name: string // The name of the provider that requested moderation
	model_slug: string
}

export function isOpenRouterErrorResponse(e: unknown): e is OpenRouterErrorResponse {
  return (
    typeof e === "object" &&
    e !== null &&
    "error" in e &&
    typeof (e as any).error === "object" &&
    typeof (e as any).error.message === "string" &&
    typeof (e as any).error.code === "number"
  )
}
