import { app, BrowserWindow, screen, ipcMain, dialog } from 'electron'; // Added dialog
import path from 'path';
import { llmManager } from './LLMManager'; // Import LLMManager instance
import { LLMProviderConfig } from './llmProviders/types'; // Import necessary types

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
    skipTaskbar: true, // Don't show in taskbar
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

  // The 'open-config-window' handler will be moved to setupIpcHandlers.
  // The 'set-ignore-mouse-events' handler below is the one that needs to be updated.
  // Note: There are two 'set-ignore-mouse-events' handlers in the original file.
  // The first one (around line 48) is general.
  // The second one (around line 75, after the 'open-config-window' handler) is specific to the chat window.
  // We need to be careful to only modify the second one if it's the one causing issues with 'configWindow'.
  // However, the error messages point to lines 70, 71, 81.
  // Line 70 & 71 are inside 'open-config-window'.
  // Line 81 is inside the second 'set-ignore-mouse-events'.

  // This specific 'set-ignore-mouse-events' is inside createWindow, let's update it.
  // ipcMain.on('set-ignore-mouse-events', (event, ignore: boolean) => {
  //   const win = BrowserWindow.fromWebContents(event.sender);
  //   // Ensure we only affect the chat window, not the config window
  //   if (win && win !== configWindowInstance) { // Use global instance
  //     win.setIgnoreMouseEvents(ignore, { forward: true });
  //   }
  // });

  // The second chatWindow.once('ready-to-show') seems redundant, will be removed by deleting the block.
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

  // Example handler for sending a chat request (might be called from chat window)
  // ipcMain.handle('llm:sendChat', async (_, messages, params, forceStream) => {
  //   try {
  //     const response = await llmManager.sendChatRequest(messages, params, forceStream);
  //     // Handling both stream and non-stream responses via IPC needs careful design
  //     // For streams, might need to send chunks back via event.sender.send
  //     // For non-stream, just return the result
  //     if (typeof response[Symbol.asyncIterator] === 'function') {
  //        // Handle stream - complex via single handle call, better to use webContents.send
  //        return { stream: true, error: 'Streaming response handling not fully implemented via invoke.' };
  //     } else {
  //        return { stream: false, data: response };
  //     }
  //   } catch (error: any) {
  //     return { error: error.message || 'Failed to send chat request' };
  //   }
  // });

  console.log('IPC Handlers Setup');
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  setupIpcHandlers(); // Setup handlers first
  createWindow(); // Create the main chat window
  createConfigWindow(); // Create config window on startup
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    createConfigWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// Example: Add a menu item or IPC call to open the config window if needed
// (See ipcMain.handle('open-config-window', ...) added earlier)
