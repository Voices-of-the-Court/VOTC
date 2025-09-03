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
  toggleConfigPanel: (): Promise<void> => ipcRenderer.invoke('toggle-config-panel'),
  hideWindow: (): void => ipcRenderer.send('chat-hide'),
  onChatReset: (callback: () => void) => {
    ipcRenderer.on('chat-reset', callback);
    return () => ipcRenderer.removeListener('chat-reset', callback);
  },
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
  saveGlobalStreamSetting: (enabled: boolean): Promise<void> => ipcRenderer.invoke('llm:saveGlobalStreamSetting', enabled),
  sendChat: (requestArgs: {
    messages: any[], // Should match ILLMCompletionRequest['messages']
    params?: any, // Should match optional params type
    forceStream?: boolean,
    requestId: string 
  }): Promise<{ streamStarted: boolean, requestId: string, data?: any, error?: string }> => ipcRenderer.invoke('llm:sendChat', requestArgs),
  
  // Listeners for chat stream
  onChatChunk: (callback: (args: { requestId: string, chunk: any }) => void) => {
    const handler = (_event: any, args: { requestId: string, chunk: any }) => callback(args);
    ipcRenderer.on('llm:chatChunk', handler);
    return () => ipcRenderer.removeListener('llm:chatChunk', handler); // Return a cleanup function
  },
  onChatStreamComplete: (callback: (args: { requestId: string, finalResponse?: any /* ILLMCompletionResponse */ }) => void) => {
    const handler = (_event: any, args: { requestId: string, finalResponse?: any }) => callback(args);
    ipcRenderer.on('llm:chatStreamComplete', handler);
    return () => ipcRenderer.removeListener('llm:chatStreamComplete', handler);
  },
  onChatError: (callback: (args: { requestId: string, error: string }) => void) => {
    const handler = (_event: any, args: { requestId: string, error: string }) => callback(args);
    ipcRenderer.on('llm:chatError', handler);
    return () => ipcRenderer.removeListener('llm:chatError', handler);
  }
});

contextBridge.exposeInMainWorld('conversationAPI', {
  sendMessage: (userMessage: string) => {
    console.log('Calling conversation:sendMessage with:', userMessage);
    return ipcRenderer.invoke('conversation:sendMessage', userMessage);
  },
  getHistory: (): Promise<any[]> => {
    console.log('Calling conversation:getHistory');
    return ipcRenderer.invoke('conversation:getHistory');
  },
  reset: (): Promise<boolean> => {
    console.log('Calling conversation:reset');
    return ipcRenderer.invoke('conversation:reset');
  },
  getNPCInfo: (): Promise<any> => {
    console.log('Calling conversation:getNPCInfo');
    return ipcRenderer.invoke('conversation:getNPCInfo');
  },
});

// It's good practice to declare the types for the exposed API
// for TypeScript usage in the renderer process.
declare global {
  interface Window {
    conversationAPI: {
      sendMessage: (userMessage: string) => Promise<any>;
      getHistory: () => Promise<any[]>;
      reset: () => Promise<boolean>;
      getNPCInfo: () => Promise<any>;
    };
    electronAPI: {
      setIgnoreMouseEvents: (ignore: boolean) => void;
      toggleConfigPanel: () => Promise<void>;
      hideWindow: () => void;
      onChatReset: (callback: () => void) => () => void;
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
// Note: The 'any' types above should be replaced with more specific types imported from './main/llmProviders/types'
// For example, ILLMCompletionRequest['messages'] for messages, ILLMStreamChunk for chunk, etc.
// This requires types.ts to be accessible from preload, or duplicating/simplifying types here.
// For now, using 'any' to get the structure in place.
