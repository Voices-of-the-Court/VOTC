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
});

contextBridge.exposeInMainWorld('llmConfigAPI', {
  getAppSettings: (): Promise<AppSettings> => ipcRenderer.invoke('llm:getAppSettings'),
  saveProviderConfig: (config: LLMProviderConfig): Promise<LLMProviderConfig> => ipcRenderer.invoke('llm:saveProviderConfig', config),
  deletePreset: (instanceId: string): Promise<void> => ipcRenderer.invoke('llm:deletePreset', instanceId), // Renamed
  setActiveProvider: (instanceId: string | null): Promise<void> => ipcRenderer.invoke('llm:setActiveProvider', instanceId),
  listModels: (): Promise<ILLMModel[] | { error: string }> => ipcRenderer.invoke('llm:listModels'),
  testConnection: (): Promise<{success: boolean, error?: string, message?: string}> => ipcRenderer.invoke('llm:testConnection'),
  setCK3Folder: (path: string | null): Promise<void> => ipcRenderer.invoke('llm:setCK3Folder', path),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder'),
  saveGlobalStreamSetting: (enabled: boolean): Promise<void> => ipcRenderer.invoke('llm:saveGlobalStreamSetting', enabled),
  savePauseOnRegenerationSetting: (enabled: boolean): Promise<void> => ipcRenderer.invoke('llm:savePauseOnRegenerationSetting', enabled),
  saveGenerateFollowingMessagesSetting: (enabled: boolean): Promise<void> => ipcRenderer.invoke('llm:saveGenerateFollowingMessagesSetting', enabled),
  getCurrentContextLength: (): Promise<number> => ipcRenderer.invoke('llm:getCurrentContextLength'),
  getMaxContextLength: (): Promise<number> => ipcRenderer.invoke('llm:getMaxContextLength'),
  setCustomContextLength: (contextLength: number): Promise<void> => ipcRenderer.invoke('llm:setCustomContextLength', contextLength),
  clearCustomContextLength: (): Promise<void> => ipcRenderer.invoke('llm:clearCustomContextLength'),
  importLegacySummaries: (): Promise<{success: boolean, message: string, filesCopied?: number, errors?: string[]}> => ipcRenderer.invoke('llm:importLegacySummaries'),
});

contextBridge.exposeInMainWorld('conversationAPI', {
  sendMessage: (userMessage: string): Promise<{streamStarted?: boolean, message?: any, error?: string}> => {
    return ipcRenderer.invoke('conversation:sendMessage', { message: userMessage });
  },
  getHistory: (): Promise<any[]> => {
    return ipcRenderer.invoke('conversation:getHistory');
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
});
