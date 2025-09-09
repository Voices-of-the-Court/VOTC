import type { LLMProviderConfig, AppSettings, ILLMModel } from '../main/llmProviders/types';

declare global {
  interface Window {
    conversationAPI: {
      sendMessage: (userMessage: string, streaming?: boolean, requestId?: string) => Promise<{streamStarted?: boolean, requestId?: string, message?: any, error?: string}>;
      getHistory: () => Promise<any[]>;
      reset: () => Promise<boolean>;
      getPlayerInfo: () => Promise<any>;
      onChatChunk: (callback: (args: { requestId: string, chunk: any }) => void) => () => void;
      onChatStreamComplete: (callback: (args: { requestId: string, finalResponse?: any }) => void) => () => void;
      onChatError: (callback: (args: { requestId: string, error: string }) => void) => () => void;
    };
    electronAPI: {
      setIgnoreMouseEvents: (ignore: boolean) => void;
      toggleConfigPanel: () => Promise<void>;
      hideWindow: () => void;
      onChatReset: (callback: () => void) => () => void;
      onToggleSettings: (callback: () => void) => () => void;
      onHideChat: (callback: () => void) => () => void;
    };
    llmConfigAPI: {
      getAppSettings: () => Promise<AppSettings>;
      saveProviderConfig: (config: LLMProviderConfig) => Promise<LLMProviderConfig>;
      deletePreset: (instanceId: string) => Promise<void>; // Renamed
      setActiveProvider: (instanceId: string | null) => Promise<void>;
      listModels: (config: LLMProviderConfig) => Promise<ILLMModel[] | { error: string }>;
      testConnection: (config: LLMProviderConfig) => Promise<{success: boolean, error?: string, message?: string}>;
      setCK3Folder: (path: string | null) => Promise<void>;
      selectFolder: () => Promise<string | null>;
      saveGlobalStreamSetting: (enabled: boolean) => Promise<void>;
      sendChat: (requestArgs: {
        messages: any[], // Replace 'any' with actual message type from types.ts
        params?: any, // Replace 'any'
        forceStream?: boolean,
        requestId: string
      }) => Promise<{ streamStarted: boolean, requestId: string, data?: any, error?: string }>; // Replace 'any'
      
      // Listener types
      onChatChunk: (callback: (args: { requestId: string, chunk: any /* ILLMStreamChunk */ }) => void) => () => void;
      onChatStreamComplete: (callback: (args: { requestId: string, finalResponse?: any /* ILLMCompletionResponse */ }) => void) => () => void;
      onChatError: (callback: (args: { requestId: string, error: string }) => void) => () => void;
    };
  }
}
// For now, using 'any' to get the structure in place.
