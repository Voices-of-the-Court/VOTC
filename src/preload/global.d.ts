import type { LLMProviderConfig, AppSettings, ILLMModel, PromptSettings, ActionApprovalSettings } from '../main/llmProviders/types';

// Types for summaries manager
export interface ConversationSummary {
  date: string;
  totalDays: number;
  content: string;
  characterName?: string; // Optional for backward compatibility
}

export interface SummaryMetadata {
  playerId: string;
  playerName?: string; // If we can derive it
  characterId: string;
  characterName: string; // From file or fallback to ID
  summaries: ConversationSummary[];
  filePath: string;
}

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
      regenerateError: (messageId: number) => Promise<{success: boolean, error?: string}>;
      acceptSummaryImport: (characterId: number, sourcePlayerId: string) => Promise<{success: boolean, error?: string}>;
      declineSummaryImport: (characterId: number, sourcePlayerId: string) => Promise<{success: boolean, error?: string}>;
      openSummaryFile: (filePath: string) => Promise<{success: boolean, error?: string}>;
      getActiveConversationData: () => Promise<any>;
      approveActions: (approvalEntryId: number) => Promise<void>;
      declineActions: (approvalEntryId: number) => Promise<void>;
      getPromptPreview: (characterId: number) => Promise<any>;
      openSummariesFolder: () => Promise<{success: boolean, error?: string}>;
      clearSummaries: () => Promise<{success: boolean, error?: string}>;
      // Summaries manager methods
      listAllSummaries: () => Promise<SummaryMetadata[]>;
      getSummariesForCharacter: (playerId: string, characterId: string) => Promise<ConversationSummary[]>;
      updateSummary: (playerId: string, characterId: string, summaryIndex: number, newContent: string) => Promise<{success: boolean, error?: string}>;
      deleteSummary: (playerId: string, characterId: string, summaryIndex: number) => Promise<{success: boolean, error?: string}>;
      deleteCharacterSummaries: (playerId: string, characterId: string) => Promise<{success: boolean, error?: string}>;
    };
    electronAPI: {
      setIgnoreMouseEvents: (ignore: boolean) => void;
      toggleConfigPanel: () => Promise<void>;
      hideWindow: () => void;
      onChatReset: (callback: () => void) => () => void;
      onToggleSettings: (callback: () => void) => () => void;
      onHideChat: (callback: () => void) => () => void;
      onToggleMinimize: (callback: () => void) => () => void;
      // Auto-updater methods
      updaterCheckForUpdates: () => Promise<boolean>;
      updaterDownloadUpdate: () => Promise<boolean>;
      updaterInstallUpdate: () => Promise<boolean>;
      onUpdaterStatus: (callback: (event: any, status: string) => void) => () => void;
      removeUpdaterStatusListener: (callback: (event: any, status: string) => void) => void;
      openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
      collectAndOpenLogs: () => Promise<{ success: boolean; path?: string; error?: string }>;
      getAppVersion: () => Promise<string>;
      onOverlayVisibilityChange: (callback: (isVisible: boolean) => void) => () => void;
    };
    llmConfigAPI: {
      getAppSettings: () => Promise<AppSettings>;
      saveProviderConfig: (config: LLMProviderConfig) => Promise<LLMProviderConfig>;
      deletePreset: (instanceId: string) => Promise<void>; // Renamed
      setActiveProvider: (instanceId: string | null) => Promise<void>;
      listModels: () => Promise<ILLMModel[] | { error: string }>;
      testConnection: () => Promise<{success: boolean, error?: string, message?: string}>;
      setCK3Folder: (path: string | null) => Promise<void>;
      setModLocationPath: (path: string | null) => Promise<void>;
      selectFolder: () => Promise<string | null>;
      saveGlobalStreamSetting: (enabled: boolean) => Promise<void>;
      savePauseOnRegenerationSetting: (enabled: boolean) => Promise<void>;
      saveGenerateFollowingMessagesSetting: (enabled: boolean) => Promise<void>;
      saveMessageFontSize: (fontSize: number) => Promise<void>;
      saveShowSettingsOnStartupSetting: (enabled: boolean) => Promise<void>;
      importLegacySummaries: () => Promise<{success: boolean, message: string, filesCopied?: number, errors?: string[]}>;
      // Provider override methods
      getActionsProviderId: () => Promise<string | null>;
      setActionsProviderId: (instanceId: string | null) => Promise<void>;
      getSummaryProviderId: () => Promise<string | null>;
      setSummaryProviderId: (instanceId: string | null) => Promise<void>;
      getActionApprovalSettings: () => Promise<ActionApprovalSettings>;
      saveActionApprovalSettings: (settings: ActionApprovalSettings) => Promise<void>;
      getSummaryPromptSettings: () => Promise<{ rollingPrompt: string; finalPrompt: string }>;
      saveSummaryPromptSettings: (settings: { rollingPrompt: string; finalPrompt: string }) => Promise<void>;
    };
    promptsAPI: {
      getSettings: () => Promise<PromptSettings>;
      saveSettings: (settings: PromptSettings) => Promise<void>;
      getLetterSettings: () => Promise<PromptSettings>;
      saveLetterSettings: (settings: PromptSettings) => Promise<void>;
      listFiles: (category: 'system' | 'character_description' | 'example_messages' | 'helpers') => Promise<string[]>;
      readFile: (relativePath: string) => Promise<string>;
      saveFile: (relativePath: string, content: string) => Promise<void>;
      getDefaultMain: () => Promise<string>;
      getDefaultLetterMain: () => Promise<string>;
      listPresets: () => Promise<any[]>;
      savePreset: (preset: any) => Promise<any>;
      deletePreset: (id: string) => Promise<void>;
      openPromptsFolder: () => Promise<void>;
      openPromptFile: (relativePath: string) => Promise<void>;
      exportZip: (payload: { settings?: any, path?: string }) => Promise<{ success?: boolean; cancelled?: boolean; path?: string }>;
    };
    lettersAPI: {
      getPromptPreview: () => Promise<string | null>;
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
