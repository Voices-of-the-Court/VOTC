import type { LLMProviderConfig, AppSettings, ILLMModel } from '../main/llmProviders/types';

declare global {
  interface Window {
    conversationAPI: {
      sendMessage: (userMessage: string) => Promise<{streamStarted?: boolean, message?: any, error?: string}>;
      getHistory: () => Promise<any[]>;
      reset: () => Promise<boolean>;
      getPlayerInfo: () => Promise<any>;
      getConversationEntries: () => Promise<any[]>;
      onConversationUpdate: (callback: (entries: any[]) => void) => () => void;
    };
    electronAPI: {
      setIgnoreMouseEvents: (ignore: boolean) => void;
      toggleConfigPanel: () => Promise<void>;
      hideWindow: () => void;
      onChatReset: (callback: () => void) => () => void;
      onToggleSettings: (callback: () => void) => () => void;
      onHideChat: (callback: () => void) => () => void;
      onToggleMinimize: (callback: () => void) => () => void;
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
    };
  }
}
// For now, using 'any' to get the structure in place.
export {};