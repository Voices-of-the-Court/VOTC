import { contextBridge, ipcRenderer } from 'electron';
import type { LLMProviderConfig, AppSettings, ILLMModel } from '../main/llmProviders/types'; // Adjusted import path

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Sends a message to the main process to set the window's mouse event ignoring state.
   * @param ignore True to ignore mouse events (click-through), false to capture them.
   */
  setIgnoreMouseEvents: (ignore: boolean): void => {
    ipcRenderer.send('set-ignore-mouse-events', ignore);
  },
  toggleConfigPanel: (): Promise<void> => ipcRenderer.invoke('toggle-config-panel'),
  hideWindow: (): void => ipcRenderer.send('chat-hide'),
  onChatReset: (callback: () => void) => {
    ipcRenderer.on('chat-reset', callback);
    return () => ipcRenderer.removeListener('chat-reset', callback);
  },
  onToggleSettings: (callback: () => void) => {
    ipcRenderer.on('toggle-settings', callback);
    return () => ipcRenderer.removeListener('toggle-settings', callback);
  },
  onHideChat: (callback: () => void) => {
    ipcRenderer.on('chat-hide', callback);
    return () => ipcRenderer.removeListener('chat-hide', callback);
  },
  onToggleMinimize: (callback: () => void) => {
    ipcRenderer.on('toggle-minimize', callback);
    return () => ipcRenderer.removeListener('toggle-minimize', callback);
  },
  // Auto-updater methods
  updaterCheckForUpdates: (): Promise<boolean> => ipcRenderer.invoke('updater:checkForUpdates'),
  updaterDownloadUpdate: (): Promise<boolean> => ipcRenderer.invoke('updater:downloadUpdate'),
  updaterInstallUpdate: (): Promise<boolean> => ipcRenderer.invoke('updater:installUpdate'),
  onUpdaterStatus: (callback: (event: any, status: string) => void) => {
    ipcRenderer.on('updater-status', callback);
    return () => ipcRenderer.removeListener('updater-status', callback);
  },
  removeUpdaterStatusListener: (callback: (event: any, status: string) => void) => {
    ipcRenderer.removeListener('updater-status', callback);
  },
  openExternal: (url: string): Promise<{ success: boolean; error?: string }> => 
    ipcRenderer.invoke('shell:openExternal', url),
  collectAndOpenLogs: (): Promise<{ success: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('logs:collectAndOpen'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  onOverlayVisibilityChange: (callback) => {
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on('overlay-visibility-change', subscription);
    // Return a function to remove the listener
    return () => ipcRenderer.removeListener('overlay-visibility-change', subscription);
  },

});

contextBridge.exposeInMainWorld('llmConfigAPI', {
  getAppSettings: (): Promise<AppSettings> => ipcRenderer.invoke('llm:getAppSettings'),
  saveProviderConfig: (config: LLMProviderConfig): Promise<LLMProviderConfig> => ipcRenderer.invoke('llm:saveProviderConfig', config),
  deletePreset: (instanceId: string): Promise<void> => ipcRenderer.invoke('llm:deletePreset', instanceId), // Renamed
  setActiveProvider: (instanceId: string | null): Promise<void> => ipcRenderer.invoke('llm:setActiveProvider', instanceId),
  listModels: (): Promise<ILLMModel[] | { error: string }> => ipcRenderer.invoke('llm:listModels'),
  testConnection: (): Promise<{success: boolean, error?: string, message?: string}> => ipcRenderer.invoke('llm:testConnection'),
  setCK3Folder: (path: string | null): Promise<void> => ipcRenderer.invoke('llm:setCK3Folder', path),
  setModLocationPath: (path: string | null): Promise<void> => ipcRenderer.invoke('llm:setModLocationPath', path),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder'),
  saveGlobalStreamSetting: (enabled: boolean): Promise<void> => ipcRenderer.invoke('llm:saveGlobalStreamSetting', enabled),
  savePauseOnRegenerationSetting: (enabled: boolean): Promise<void> => ipcRenderer.invoke('llm:savePauseOnRegenerationSetting', enabled),
  saveGenerateFollowingMessagesSetting: (enabled: boolean): Promise<void> => ipcRenderer.invoke('llm:saveGenerateFollowingMessagesSetting', enabled),
  saveMessageFontSize: (fontSize: number): Promise<void> => ipcRenderer.invoke('llm:saveMessageFontSize', fontSize),
  saveShowSettingsOnStartupSetting: (enabled: boolean): Promise<void> => ipcRenderer.invoke('llm:saveShowSettingsOnStartupSetting', enabled),
  getLanguage: (): Promise<string> => ipcRenderer.invoke('llm:getLanguage'),
  saveLanguage: (language: string): Promise<void> => ipcRenderer.invoke('llm:saveLanguage', language),
  getCurrentContextLength: (): Promise<number> => ipcRenderer.invoke('llm:getCurrentContextLength'),
  getMaxContextLength: (): Promise<number> => ipcRenderer.invoke('llm:getMaxContextLength'),
  setCustomContextLength: (contextLength: number): Promise<void> => ipcRenderer.invoke('llm:setCustomContextLength', contextLength),
  clearCustomContextLength: (): Promise<void> => ipcRenderer.invoke('llm:clearCustomContextLength'),
  importLegacySummaries: (): Promise<{success: boolean, message: string, filesCopied?: number, errors?: string[]}> => ipcRenderer.invoke('llm:importLegacySummaries'),
  // Provider override methods
  getActionsProviderId: (): Promise<string | null> => ipcRenderer.invoke('llm:getActionsProviderId'),
  setActionsProviderId: (instanceId: string | null): Promise<void> => ipcRenderer.invoke('llm:setActionsProviderId', instanceId),
  getSummaryProviderId: (): Promise<string | null> => ipcRenderer.invoke('llm:getSummaryProviderId'),
  setSummaryProviderId: (instanceId: string | null): Promise<void> => ipcRenderer.invoke('llm:setSummaryProviderId', instanceId),
  getActionApprovalSettings: (): Promise<any> => ipcRenderer.invoke('llm:getActionApprovalSettings'),
  saveActionApprovalSettings: (settings: any): Promise<void> => ipcRenderer.invoke('llm:saveActionApprovalSettings', settings),
  getSummaryPromptSettings: (): Promise<{ rollingPrompt: string; finalPrompt: string; letterSummaryPrompt: string }> => ipcRenderer.invoke('llm:getSummaryPromptSettings'),
  saveSummaryPromptSettings: (settings: { rollingPrompt: string; finalPrompt: string; letterSummaryPrompt: string }): Promise<void> => ipcRenderer.invoke('llm:saveSummaryPromptSettings', settings),
});

contextBridge.exposeInMainWorld('promptsAPI', {
  getSettings: (): Promise<any> => ipcRenderer.invoke('prompts:getSettings'),
  saveSettings: (settings: any): Promise<void> => ipcRenderer.invoke('prompts:saveSettings', settings),
  getLetterSettings: (): Promise<any> => ipcRenderer.invoke('prompts:getLetterSettings'),
  saveLetterSettings: (settings: any): Promise<void> => ipcRenderer.invoke('prompts:saveLetterSettings', settings),
  listFiles: (category: 'system' | 'character_description' | 'example_messages' | 'helpers'): Promise<string[]> =>
    ipcRenderer.invoke('prompts:list', category),
  readFile: (relativePath: string): Promise<string> => ipcRenderer.invoke('prompts:readFile', relativePath),
  saveFile: (relativePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke('prompts:saveFile', relativePath, content),
  getDefaultMain: (): Promise<string> => ipcRenderer.invoke('prompts:getDefaultMain'),
  getDefaultLetterMain: (): Promise<string> => ipcRenderer.invoke('prompts:getDefaultLetterMain'),
  listPresets: (): Promise<any[]> => ipcRenderer.invoke('prompts:listPresets'),
  savePreset: (preset: any): Promise<any> => ipcRenderer.invoke('prompts:savePreset', preset),
  deletePreset: (id: string): Promise<void> => ipcRenderer.invoke('prompts:deletePreset', id),
  openPromptsFolder: (): Promise<void> => ipcRenderer.invoke('prompts:openPromptsFolder'),
  openPromptFile: (relativePath: string): Promise<void> => ipcRenderer.invoke('prompts:openPromptFile', relativePath),
  exportZip: (payload: { settings?: any, path?: string }): Promise<{ success?: boolean; cancelled?: boolean; path?: string }> =>
    ipcRenderer.invoke('prompts:exportZip', payload),
  validateTemplate: (templateString: string): Promise<{ valid: boolean; error?: string; line?: number; column?: number }> =>
    ipcRenderer.invoke('prompts:validateTemplate', templateString),
});

contextBridge.exposeInMainWorld('lettersAPI', {
  getPromptPreview: (): Promise<string | null> =>
    ipcRenderer.invoke('letter:getPromptPreview'),
  getStatuses: (): Promise<any> =>
    ipcRenderer.invoke('letters:getStatuses'),
  getLetterDetails: (letterId: string): Promise<any | null> =>
    ipcRenderer.invoke('letters:getLetterDetails', letterId),
  clearOldStatuses: (daysThreshold: number): Promise<{success: boolean, error?: string}> =>
    ipcRenderer.invoke('letters:clearOldStatuses', daysThreshold),
});
contextBridge.exposeInMainWorld('conversationAPI', {
  sendMessage: (userMessage: string): Promise<{streamStarted?: boolean, message?: any, error?: string}> => {
    return ipcRenderer.invoke('conversation:sendMessage', { message: userMessage });
  },
  reset: (): Promise<boolean> => {
    return ipcRenderer.invoke('conversation:reset');
  },
  getConversationEntries: (): Promise<any[]> => {
    return ipcRenderer.invoke('conversation:getEntries');
  },
  onConversationUpdate: (callback: (entries: any[]) => void) => {
    const handler = (_event: any, entries: any[]) => callback(entries);
    ipcRenderer.on('conversation:updated', handler);
    return () => ipcRenderer.removeListener('conversation:updated', handler);
  },
  cancelStream: (): Promise<void> => {
    return ipcRenderer.invoke('conversation:cancelStream');
  },
  pauseConversation: (): Promise<void> => {
    return ipcRenderer.invoke('conversation:pause');
  },
  resumeConversation: (): Promise<void> => {
    return ipcRenderer.invoke('conversation:resume');
  },
  getConversationState: (): Promise<{ isPaused: boolean; queueLength: number }> => {
    return ipcRenderer.invoke('conversation:getState');
  },
  regenerateMessage: (messageId: number): Promise<{success: boolean, error?: string}> => {
    return ipcRenderer.invoke('conversation:regenerateMessage', { messageId });
  },
  editUserMessage: (messageId: number, newContent: string): Promise<{success: boolean, error?: string}> => {
    return ipcRenderer.invoke('conversation:editUserMessage', { messageId, newContent });
  },
  regenerateError: (messageId: number): Promise<{success: boolean, error?: string}> => {
    return ipcRenderer.invoke('conversation:regenerateError', { messageId });
  },
  acceptSummaryImport: (characterId: number, sourcePlayerId: string): Promise<{success: boolean, error?: string}> =>
    ipcRenderer.invoke('conversation:acceptSummaryImport', { characterId, sourcePlayerId }),
  declineSummaryImport: (characterId: number, sourcePlayerId: string): Promise<{success: boolean, error?: string}> =>
    ipcRenderer.invoke('conversation:declineSummaryImport', { characterId, sourcePlayerId }),
  openSummaryFile: (filePath: string): Promise<{success: boolean, error?: string}> =>
    ipcRenderer.invoke('conversation:openSummaryFile', { filePath }),
  getActiveConversationData: (): Promise<any> =>
    ipcRenderer.invoke('conversation:getActiveConversationData'),
  getPromptPreview: (characterId: number): Promise<any> =>
    ipcRenderer.invoke('conversation:getPromptPreview', { characterId }),
  openSummariesFolder: (): Promise<{success: boolean, error?: string}> =>
    ipcRenderer.invoke('conversation:openSummariesFolder'),
  clearSummaries: (): Promise<{success: boolean, error?: string}> =>
    ipcRenderer.invoke('conversation:clearSummaries'),
  approveActions: (approvalEntryId: number): Promise<void> =>
    ipcRenderer.invoke('conversation:approveActions', { approvalEntryId }),
  declineActions: (approvalEntryId: number): Promise<void> =>
    ipcRenderer.invoke('conversation:declineActions', { approvalEntryId }),
  // Summaries manager methods
  listAllSummaries: (): Promise<any[]> =>
    ipcRenderer.invoke('conversation:listAllSummaries'),
  getSummariesForCharacter: (playerId: string, characterId: string): Promise<any[]> =>
    ipcRenderer.invoke('conversation:getSummariesForCharacter', { playerId, characterId }),
  updateSummary: (playerId: string, characterId: string, summaryIndex: number, newContent: string): Promise<{success: boolean, error?: string}> =>
    ipcRenderer.invoke('conversation:updateSummary', { playerId, characterId, summaryIndex, newContent }),
  deleteSummary: (playerId: string, characterId: string, summaryIndex: number): Promise<{success: boolean, error?: string}> =>
    ipcRenderer.invoke('conversation:deleteSummary', { playerId, characterId, summaryIndex }),
  deleteCharacterSummaries: (playerId: string, characterId: string): Promise<{success: boolean, error?: string}> =>
    ipcRenderer.invoke('conversation:deleteCharacterSummaries', { playerId, characterId }),
 });
 
 // Actions API exposed to renderer
 // Appends to existing preload bridges
 
 contextBridge.exposeInMainWorld('actionsAPI', {
   reload: (): Promise<{ success: boolean; error?: string }> =>
     ipcRenderer.invoke('actions:reload'),
   getAll: (): Promise<Array<{
     id: string;
     title: string;
     scope: 'standard' | 'custom';
     filePath: string;
     validation: { valid: boolean; message?: string };
     disabled: boolean;
     isDestructive: boolean;
     hasDestructiveOverride: boolean;
   }>> => ipcRenderer.invoke('actions:getAll'),
   setDisabled: (actionId: string, disabled: boolean): Promise<{ success: boolean; error?: string }> =>
     ipcRenderer.invoke('actions:setDisabled', { actionId, disabled }),
   setDestructiveOverride: (actionId: string, isDestructive: boolean | null): Promise<{ success: boolean; error?: string }> =>
     ipcRenderer.invoke('actions:setDestructiveOverride', { actionId, isDestructive }),
   getSettings: (): Promise<{ disabledActions: string[]; validation: Record<string, { valid: boolean; message?: string }> }> =>
     ipcRenderer.invoke('actions:getSettings'),
   openFolder: (): Promise<void> =>
     ipcRenderer.invoke('actions:openFolder'),
   openFile: (filePath: string): Promise<{ success: boolean; error?: string }> =>
     ipcRenderer.invoke('actions:openFile', { filePath }),
 });
