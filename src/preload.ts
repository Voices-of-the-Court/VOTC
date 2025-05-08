import { contextBridge, ipcRenderer } from 'electron';
import type { LLMProviderConfig, AppSettings, ILLMModel } from './main/llmProviders/types'; // Adjusted import path

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Sends a message to the main process to set the window's mouse event ignoring state.
   * @param ignore True to ignore mouse events (click-through), false to capture them.
   */
  setIgnoreMouseEvents: (ignore: boolean): void => {
    ipcRenderer.send('set-ignore-mouse-events', ignore);
  },
  openConfigWindow: (): Promise<void> => ipcRenderer.invoke('open-config-window'),
});

contextBridge.exposeInMainWorld('llmConfigAPI', {
  getAppSettings: (): Promise<AppSettings> => ipcRenderer.invoke('llm:getAppSettings'),
  saveProviderConfig: (config: LLMProviderConfig): Promise<LLMProviderConfig> => ipcRenderer.invoke('llm:saveProviderConfig', config),
  deletePreset: (instanceId: string): Promise<void> => ipcRenderer.invoke('llm:deletePreset', instanceId), // Renamed
  setActiveProvider: (instanceId: string | null): Promise<void> => ipcRenderer.invoke('llm:setActiveProvider', instanceId),
  listModels: (config: LLMProviderConfig): Promise<ILLMModel[] | { error: string }> => ipcRenderer.invoke('llm:listModels', config),
  testConnection: (config: LLMProviderConfig): Promise<{success: boolean, error?: string, message?: string}> => ipcRenderer.invoke('llm:testConnection', config),
  setCK3Folder: (path: string | null): Promise<void> => ipcRenderer.invoke('llm:setCK3Folder', path),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder'),
  saveGlobalStreamSetting: (enabled: boolean): Promise<void> => ipcRenderer.invoke('llm:saveGlobalStreamSetting', enabled), // Added
});


// It's good practice to declare the types for the exposed API
// for TypeScript usage in the renderer process.
declare global {
  interface Window {
    electronAPI: {
      setIgnoreMouseEvents: (ignore: boolean) => void;
      openConfigWindow: () => Promise<void>;
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
      saveGlobalStreamSetting: (enabled: boolean) => Promise<void>; // Added
    };
  }
}
