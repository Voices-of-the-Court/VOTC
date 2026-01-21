import type { LLMProviderConfig, AppSettings, ILLMModel, PromptSettings } from '../main/llmProviders/types';

declare global {
  interface Window {
    conversationAPI: {
      sendMessage: (userMessage: string) => Promise<{streamStarted?: boolean, message?: any, error?: string}>;
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
      saveMessageFontSize: (fontSize: number) => Promise<void>;
      importLegacySummaries: () => Promise<{success: boolean, message: string, filesCopied?: number, errors?: string[]}>;
      // Provider override methods
      getActionsProviderId: () => Promise<string | null>;
      setActionsProviderId: (instanceId: string | null) => Promise<void>;
      getSummaryProviderId: () => Promise<string | null>;
      setSummaryProviderId: (instanceId: string | null) => Promise<void>;
    };
    promptsAPI: {
      getSettings: () => Promise<PromptSettings>;
      saveSettings: (settings: PromptSettings) => Promise<void>;
      listFiles: (category: 'system' | 'character_description' | 'example_messages' | 'helpers') => Promise<string[]>;
      readFile: (relativePath: string) => Promise<string>;
      saveFile: (relativePath: string, content: string) => Promise<void>;
      getDefaultMain: () => Promise<string>;
      listPresets: () => Promise<any[]>;
      savePreset: (preset: any) => Promise<any>;
      deletePreset: (id: string) => Promise<void>;
      openPromptsFolder: () => Promise<void>;
      openPromptFile: (relativePath: string) => Promise<void>;
      exportZip: (payload: { settings?: any, path?: string }) => Promise<{ success?: boolean; cancelled?: boolean; path?: string }>;
    };
    actionsAPI: {
      reload: () => Promise<{ success: boolean; error?: string }>;
      getAll: () => Promise<Array<{
        id: string;
        title: string;
        scope: 'standard' | 'custom';
        filePath: string;
        validation: { valid: boolean; message?: string };
        disabled: boolean;
      }>>;
      setDisabled: (actionId: string, disabled: boolean) => Promise<{ success: boolean; error?: string }>;
      getSettings: () => Promise<{ disabledActions: string[]; validation: Record<string, { valid: boolean; message?: string }> }>;
      openFolder: () => Promise<void>;
    };
  }
}
// For now, using 'any' to get the structure in place.
export {};
