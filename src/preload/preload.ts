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
});

contextBridge.exposeInMainWorld('lettersAPI', {
  getPromptPreview: (): Promise<string | null> => ipcRenderer.invoke('letter:getPromptPreview'),
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
   }>> => ipcRenderer.invoke('actions:getAll'),
   setDisabled: (actionId: string, disabled: boolean): Promise<{ success: boolean; error?: string }> =>
     ipcRenderer.invoke('actions:setDisabled', { actionId, disabled }),
   getSettings: (): Promise<{ disabledActions: string[]; validation: Record<string, { valid: boolean; message?: string }> }> =>
     ipcRenderer.invoke('actions:getSettings'),
   openFolder: (): Promise<void> =>
     ipcRenderer.invoke('actions:openFolder'),
 });
