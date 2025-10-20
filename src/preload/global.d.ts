import type { LLMProviderConfig, AppSettings, ILLMModel } from '../main/llmProviders/types';

declare global {
  interface Window {
    conversationAPI: {
      sendMessage: (userMessage: string) => Promise<{streamStarted?: boolean, message?: any, error?: string}>;
      getHistory: () => Promise<any[]>;
      reset: () => Promise<boolean>;
      getConversationEntries: () => Promise<any[]>;
      onConversationUpdate: (callback: (entries: any[]) => void) => () => void;
      cancelStream: () => Promise<void>;
      pauseConversation: () => Promise<void>;
      resumeConversation: () => Promise<void>;
      getConversationState: () => Promise<{ isPaused: boolean; queueLength: number }>;
      regenerateMessage: (messageId: number) => Promise<{success: boolean, error?: string}>;
      editUserMessage: (messageId: number, newContent: string) => Promise<{success: boolean, error?: string}>;
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
      listModels: () => Promise<ILLMModel[] | { error: string }>;
      testConnection: () => Promise<{success: boolean, error?: string, message?: string}>;
      setCK3Folder: (path: string | null) => Promise<void>;
      selectFolder: () => Promise<string | null>;
      saveGlobalStreamSetting: (enabled: boolean) => Promise<void>;
      savePauseOnRegenerationSetting: (enabled: boolean) => Promise<void>;
      saveGenerateFollowingMessagesSetting: (enabled: boolean) => Promise<void>;
      importLegacySummaries: () => Promise<{success: boolean, message: string, filesCopied?: number, errors?: string[]}>
    };
  }
}
// For now, using 'any' to get the structure in place.
export {};