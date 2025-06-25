import { app, BrowserWindow, screen, ipcMain, dialog } from 'electron';
import path from 'path';
import { llmManager } from './LLMManager';
import { LLMProviderConfig, ILLMCompletionRequest, ILLMStreamChunk, ILLMCompletionResponse } from './llmProviders/types'; // Added more types

// Keep a reference to the config window, managed globally
let configWindowInstance: BrowserWindow | null = null;

// Vite-specific environment variable for development server URL
// const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']; // Handled by vite-plugin-electron

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = (): void => {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Create the browser window.
  const chatWindow = new BrowserWindow({
    width,
    height,
    show: true, // Initially hide the window
    transparent: true, // Enable transparency
    frame: false, // Remove window frame
    alwaysOnTop: true, // Keep window on top
    // skipTaskbar: true, // Don't show in taskbar
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'), // Adjusted path for Vite output
      nodeIntegration: false, // Best practice: disable nodeIntegration
      contextIsolation: true, // Best practice: enable contextIsolation
    },
  });

  // Make the window initially click-through
  chatWindow.setAlwaysOnTop(true, 'screen-saver');
  chatWindow.setIgnoreMouseEvents(true, { forward: true });

  // Set fullscreen (optional, might conflict with alwaysOnTop/transparency goals depending on OS/WM)
  // mainWindow.setFullScreen(true); // Consider if truly needed, as size is already set to screen dimensions

  // and load the index.html of the app.
  if (process.env.VITE_DEV_SERVER_URL) {
    chatWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}src/renderer/chatWindow/chat.html`);
  } else {
    // Load your file
    chatWindow.loadFile(path.join(__dirname, '../../renderer/chat.html'));
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  // Listen for messages from the renderer to toggle mouse events
  ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setIgnoreMouseEvents(ignore, { forward: true });
    }
  });

  chatWindow.once('ready-to-show', () => {
    chatWindow.show();
  });

};

const createConfigWindow = (): void => {
  // Create the config browser window.
  // Assign to the global instance variable
  configWindowInstance = new BrowserWindow({
    width: 800, // Standard size for a config window
    height: 600,
    show: false, // Initially hide the window
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'), // Use common preload, adjusted path
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the config.html of the app.
  if (process.env.VITE_DEV_SERVER_URL) {
    configWindowInstance.loadURL(`${process.env.VITE_DEV_SERVER_URL}src/renderer/configWindow/config.html`);
  } else {
    configWindowInstance.loadFile(path.join(__dirname, '../../renderer/config.html'));
  }

  // Open the DevTools (optional)
  // configWindowInstance.webContents.openDevTools();

  configWindowInstance.once('ready-to-show', () => {
    configWindowInstance?.show();
  });

  // Handle window closed event
  configWindowInstance.on('closed', () => {
    configWindowInstance = null;
  });
};


// --- IPC Handlers for LLMManager and Dialogs ---
const setupIpcHandlers = () => {
  // Moved 'open-config-window' handler here
  ipcMain.handle('open-config-window', () => {
    if (configWindowInstance && !configWindowInstance.isDestroyed()) {
      configWindowInstance.focus();
    } else {
      createConfigWindow(); // This will assign to configWindowInstance
    }
  });

  ipcMain.handle('llm:getAppSettings', () => {
    return llmManager.getAppSettings();
  });

  ipcMain.handle('llm:saveProviderConfig', (_, config: LLMProviderConfig) => {
    return llmManager.saveProviderConfig(config);
  });

  // Renamed from deleteProviderConfig as it now specifically deletes presets
  ipcMain.handle('llm:deletePreset', (_, instanceId: string) => { 
    llmManager.deletePreset(instanceId);
  });

  ipcMain.handle('llm:setActiveProvider', (_, instanceId: string | null) => {
    llmManager.setActiveProviderInstanceId(instanceId);
  });

  ipcMain.handle('llm:listModels', async (_, config: LLMProviderConfig) => {
    try {
      return await llmManager.listModelsForProvider(config);
    } catch (error: any) {
      console.error('IPC llm:listModels error:', error);
      // Return error information to the renderer
      return { error: error.message || 'Failed to list models' };
    }
  });

  ipcMain.handle('llm:testConnection', async (_, config: LLMProviderConfig) => {
     return await llmManager.testProviderConnection(config);
     // Errors are caught within testProviderConnection and returned in the result object
  });

  ipcMain.handle('llm:setCK3Folder', (_, path: string | null) => {
    llmManager.setCK3UserFolderPath(path);
  });

  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null; // Return null if canceled or no path selected
  });

  ipcMain.handle('llm:saveGlobalStreamSetting', (_, enabled: boolean) => {
    llmManager.saveGlobalStreamSetting(enabled);
    // Consider returning a status
  });

  ipcMain.handle('llm:sendChat', async (event, requestArgs: {
    messages: ILLMCompletionRequest['messages'],
    params?: Partial<Omit<ILLMCompletionRequest, 'messages' | 'model' | 'stream'>>,
    forceStream?: boolean,
    requestId: string // For correlating stream chunks
  }) => {
    const { messages, params, forceStream, requestId } = requestArgs;
    try {
      const response = await llmManager.sendChatRequest(messages, params, forceStream);

      if (typeof response[Symbol.asyncIterator] === 'function') {
        // Handle stream
        // The 'handle' itself cannot stream back directly in multiple parts to the original 'invoke' promise.
        // We must use event.sender.send for each chunk.
        // The promise returned by this handler will resolve when the stream is complete.
        (async () => {
          try {
            let finalAggregatedResponse: ILLMCompletionResponse | void;
            for await (const chunk of response as AsyncGenerator<ILLMStreamChunk, ILLMCompletionResponse | void, undefined>) {
              event.sender.send('llm:chatChunk', { requestId, chunk });
            }

            const streamProcessing = async () => {
              let finalResponseData: ILLMCompletionResponse | void;
              try {
                // The `for await...of` loop consumes yielded values.
                // The `response` is the generator.
                // The return value of the async generator function is what we need.
                // This is not directly accessible after a `for await...of` loop.
                // We need to iterate manually or adjust how the generator is called.

                // Simpler: The `_streamChatCompletion` *returns* the aggregated response.
                // The `llmManager.sendChatRequest` returns the generator.
                // The `ipcMain.handle` for `llm:sendChat` returns a promise.
                // The IIFE is already handling the async iteration.
                // The `aggregatedResponse` is built up *inside* the provider's generator.
                // The provider's generator *returns* this `aggregatedResponse`.
                // This return value needs to be passed to `onChatStreamComplete`.

                // The `response` is the generator.
                // We need to get the value it *returns*.
                let current = await (response as AsyncGenerator<ILLMStreamChunk, ILLMCompletionResponse | void, undefined>).next();
                while(!current.done) {
                  event.sender.send('llm:chatChunk', { requestId, chunk: current.value });
                  current = await (response as AsyncGenerator<ILLMStreamChunk, ILLMCompletionResponse | void, undefined>).next();
                }
                // When done, current.value is the return value of the generator
                finalResponseData = current.value;
                event.sender.send('llm:chatStreamComplete', { requestId, finalResponse: finalResponseData });
              } catch (streamError: any) {
                console.error('Error during chat stream:', streamError);
                event.sender.send('llm:chatError', { requestId, error: streamError.message || 'Unknown streaming error' });
              }
            };
            streamProcessing(); // Fire and forget for IPC events, but main handler returns streamStarted

          } catch (streamError: any) { // This catch is for errors *before* stream iteration starts
            console.error('Error setting up chat stream:', streamError);
            event.sender.send('llm:chatError', { requestId, error: streamError.message || 'Unknown streaming setup error' });
          }
        })();
        // Indicate that streaming has started and the client should listen for 'llm:chatChunk' events.
        // The actual final result of the invoke will be minimal, as data is sent via events.
        return { streamStarted: true, requestId };
      } else {
        // Handle non-streamed response
        return { streamStarted: false, requestId, data: response as ILLMCompletionResponse };
      }
    } catch (error: any) {
      console.error('IPC llm:sendChat error:', error);
      // If the error happens before streaming starts, it's caught here and returned by the handle.
      // If it happens during streaming, it's sent via 'llm:chatError' event.
      return { streamStarted: false, requestId, error: error.message || 'Failed to send chat request' };
    }
  });

  console.log('IPC Handlers Setup');
};

app.on('ready', () => {
  setupIpcHandlers(); // Setup handlers first
  createWindow(); // Create the main chat window
  createConfigWindow(); // Create config window on startup
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    createConfigWindow();
  }
});

