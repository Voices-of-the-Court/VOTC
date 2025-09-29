import { app, BrowserWindow, screen, ipcMain, dialog, Tray, Menu, globalShortcut } from 'electron';
import path from 'path';
import fs from 'fs';
import { llmManager } from './LLMManager';
import { settingsRepository } from './SettingsRepository';
import { conversationManager } from './conversation/ConversationManager';
import { LLMProviderConfig, ILLMStreamChunk } from './llmProviders/types'; // Added more types
import { ClipboardListener } from './ClipboardListener'; // Add missing import
// Import providers to ensure they register themselves
import './llmProviders/OpenRouterProvider';
import './llmProviders/OpenAICompatibleProvider';
import './llmProviders/OllamaProvider';

// Keep a reference to the config window, managed globally
let chatWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = (): BrowserWindow => {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Create the browser window.
  const chatWindow = new BrowserWindow({
    width,
    height,
    show: true, // Start hidden
    transparent: true, // Enable transparency
    frame: false, // Remove window frame
    alwaysOnTop: false, // Keep window on top
    // skipTaskbar: true, // Don't show in taskbar
    fullscreen: true,
    webPreferences: {
      partition: 'persist:chat',
      preload: path.join(__dirname, '../preload/preload.js'), // Adjusted path for Vite output
      nodeIntegration: false, // Best practice: disable nodeIntegration
      contextIsolation: true, // Best practice: enable contextIsolation
    },
  });

  // Make the window initially click-through
  // chatWindow.setAlwaysOnTop(true, 'screen-saver');
  chatWindow.setIgnoreMouseEvents(true, { forward: true });

  // Set fullscreen (optional, might conflict with alwaysOnTop/transparency goals depending on OS/WM)
  // mainWindow.setFullScreen(true); // Consider if truly needed, as size is already set to screen dimensions

  // and load the index.html of the app.
if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
  chatWindow.loadURL(process.env['ELECTRON_RENDERER_URL']); 
} else {
  chatWindow.loadFile(
    path.join(__dirname, '../renderer/index.html') // see below for prod
  );
}

  // Open the DevTools.
  chatWindow.webContents.openDevTools(
    { mode: 'detach' }
  );

  // Listen for messages from the renderer to toggle mouse events
  ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setIgnoreMouseEvents(ignore, { forward: true });
    }
  });

  return chatWindow;
};


// --- IPC Handlers for LLMManager and Dialogs ---
const setupIpcHandlers = () => {
  // TODO:
  ipcMain.handle('toggle-config-panel', () => {
    // Send toggle settings event to renderer
    if (chatWindow) {
      chatWindow.webContents.send('toggle-settings');
    }
    return true;
  });

  ipcMain.handle('llm:getAppSettings', () => {
    return settingsRepository.getAppSettings();
  });

  ipcMain.handle('llm:saveProviderConfig', (_, config: LLMProviderConfig) => {
    return settingsRepository.saveProviderConfig(config);
  });

  // Renamed from deleteProviderConfig as it now specifically deletes presets
  ipcMain.handle('llm:deletePreset', (_, instanceId: string) => {
    settingsRepository.deletePreset(instanceId);
  });

  ipcMain.handle('llm:setActiveProvider', (_, instanceId: string | null) => {
    settingsRepository.setActiveProviderInstanceId(instanceId);
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
    settingsRepository.setCK3UserFolderPath(path);
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
    settingsRepository.saveGlobalStreamSetting(enabled);
    // Consider returning a status
  });

  ipcMain.handle('llm:savePauseOnRegenerationSetting', (_, enabled: boolean) => {
    settingsRepository.savePauseOnRegenerationSetting(enabled);
  });

  ipcMain.handle('llm:saveGenerateFollowingMessagesSetting', (_, enabled: boolean) => {
    settingsRepository.saveGenerateFollowingMessagesSetting(enabled);
  });

  console.log('Setting up conversation IPC handlers...');

  // --- Conversation Management IPC Handlers ---

  ipcMain.handle('conversation:sendMessage', async (event, requestArgs: {
    message: string  }) => {
    const { message } = requestArgs;

    try {
      console.log('IPC: Sending message:', message);
      const result = await conversationManager.sendMessage(message);
      console.log('IPC: Message sent successfully, result type:', typeof result);
      return { streamStarted: false, message: result };
    } catch (error) {
      console.error('IPC: Failed to send message:', error);
      return {
        streamStarted: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('conversation:getHistory', () => {
    console.log('IPC received conversation:getHistory');
    return conversationManager.getConversationHistory();
  });

  ipcMain.handle('conversation:reset', () => {
    console.log('IPC received conversation:reset');
    conversationManager.endCurrentConversation();
    // conversationManager.createConversation();
    return true;
  });

  ipcMain.handle('conversation:getPlayerInfo', () => {
    console.log('IPC received conversation:getPlayerInfo');
    const player = conversationManager.getPlayer();
    return player ? {
      name: player.shortName,
      fullName: player.fullName,
      title: player.primaryTitle,
      personality: player.personality,
      opinion: player.opinionOfPlayer,
      culture: player.culture,
      faith: player.faith
    } : null;
  });

  ipcMain.handle('conversation:getEntries', () => {
    console.log('IPC received conversation:getEntries');
    return conversationManager.getConversationEntries();
  });

  ipcMain.handle('conversation:cancelStream', () => {
    console.log('IPC received conversation:cancelStream');
    conversationManager.cancelCurrentStream();
  });

  ipcMain.handle('conversation:pause', () => {
    console.log('IPC received conversation:pause');
    conversationManager.pauseConversation();
  });

  ipcMain.handle('conversation:resume', () => {
    console.log('IPC received conversation:resume');
    conversationManager.resumeConversation();
  });

  ipcMain.handle('conversation:getState', () => {
    console.log('IPC received conversation:getState');
    return conversationManager.getConversationState();
  });

  ipcMain.handle('conversation:regenerateMessage', async (event, requestArgs: {
    messageId: number
  }) => {
    const { messageId } = requestArgs;

    try {
      console.log('IPC: Regenerating message:', messageId);
      const conversation = conversationManager.getCurrentConversation();
      if (!conversation) {
        throw new Error('No active conversation');
      }
      await conversation.regenerateMessage(messageId);
      return { success: true };
    } catch (error) {
      console.error('IPC: Failed to regenerate message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('conversation:editUserMessage', async (event, requestArgs: {
    messageId: number,
    newContent: string
  }) => {
    const { messageId, newContent } = requestArgs;

    try {
      console.log('IPC: Editing user message:', messageId);
      const conversation = conversationManager.getCurrentConversation();
      if (!conversation) {
        throw new Error('No active conversation');
      }
      await conversation.editUserMessage(messageId, newContent);
      return { success: true };
    } catch (error) {
      console.error('IPC: Failed to edit user message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Set up conversation update listener
  const conversationUpdateCallback = (entries: any[]) => {
    if (chatWindow && !chatWindow.isDestroyed()) {
      console.log('Sending conversation update to renderer:', entries.length, 'entries');
      chatWindow.webContents.send('conversation:updated', entries);
    }
  };

  // Subscribe to conversation updates
  conversationManager.onConversationUpdate(conversationUpdateCallback);

  console.log('Conversation IPC handlers registered successfully');
};

app.on('ready', () => {
  console.log(app.getPath('userData'));
  setupIpcHandlers(); // Setup handlers first
  chatWindow = createWindow(); // Create the main chat window and assign to global

  // Create system tray
  const iconPath = path.join(app.getAppPath(), 'src/renderer/assets/icon.ico');

  console.log('Current __dirname:', __dirname);
  console.log('Process resources:', process.resourcesPath);
  console.log('App path:', app.getAppPath());
  console.log(`Checking path: ${iconPath}, exists: ${fs.existsSync(iconPath)}`);

  if (!fs.existsSync(iconPath)) {
    console.error('Tray icon not found in any expected location');
    // Fallback to a basic icon or skip tray creation
    return;
  }

  try {
    tray = new Tray(iconPath);
    console.log('Tray created successfully');
  } catch (error) {
    console.error('Error creating tray:', error);
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Settings',
      click: () => {
        // Send toggle settings event to renderer
        if (chatWindow) {
          chatWindow.webContents.send('toggle-settings');
        }
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('VOTC Overlay');
  tray.setContextMenu(contextMenu);

  // Create and start clipboard listener
  const clipboardListener = new ClipboardListener();
  clipboardListener.start();
  
  clipboardListener.on('VOTC:IN', () => {
    console.log('VOTC:IN triggered - showing chat interface');

    // Ensure window exists
    if (!chatWindow || chatWindow.isDestroyed()) {
      console.log('Creating new chat window');
      chatWindow = createWindow();
    }

    conversationManager.createConversation();

    // Show window (it might be hidden) and send events to renderer
    chatWindow.show();
    chatWindow.focus();
    chatWindow.webContents.send('chat-reset'); // This will trigger showChat in App.tsx
  });
  
  // Add IPC handler for hiding chat UI (not window - window stays persistent)
  ipcMain.on('chat-hide', () => {
    // Send event to renderer to hide both chat and config panels
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('chat-hide');
    }
  });

  // Register global shortcut for Ctrl+H to toggle minimize
  const ret = globalShortcut.register('Control+H', () => {
    if (chatWindow && !chatWindow.isDestroyed() && conversationManager.hasActiveConversation()) {
      console.log('Ctrl+H pressed - toggling minimize');
      chatWindow.webContents.send('toggle-minimize');
    }
  });

  if (!ret) {
    console.log('Failed to register Ctrl+H global shortcut');
  }

  // Check if a shortcut is registered
  console.log('Ctrl+H shortcut registered:', globalShortcut.isRegistered('Control+H'));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  tray?.destroy();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();  }
});
