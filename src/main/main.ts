import { app, BrowserWindow, screen, ipcMain, dialog, Tray, Menu, globalShortcut, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { llmManager } from './LLMManager';
import { settingsRepository } from './SettingsRepository';
import { conversationManager } from './conversation/ConversationManager';
import { LLMProviderConfig, PromptPreset, PromptSettings } from './llmProviders/types';
import { ClipboardListener } from './ClipboardListener';
import { initLogger, clearLog } from './utils/logger';
import { importLegacySummaries } from './utils/importLegacySummaries';
import { VOTC_ACTIONS_DIR, VOTC_PROMPTS_DIR } from './utils/paths';
import { actionRegistry } from './actions/ActionRegistry';
import { promptConfigManager } from './conversation/PromptConfigManager';
import { appUpdater } from './AutoUpdater';
// @ts-ignore
import appIcon from '../../build/icon.ico?asset';
import './llmProviders/OpenRouterProvider';
import './llmProviders/OpenAICompatibleProvider';
import './llmProviders/OllamaProvider';
import { letterManager } from './letter/LetterManager';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';

initLogger();
// Keep a reference to the config window, managed globally
let chatWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}
Menu.setApplicationMenu(null)

const exportPromptsZip = (destination: string, settings: PromptSettings, presets: PromptPreset[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const output = fs.createWriteStream(destination);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      output.on('error', reject);
      archive.on('error', reject);

      archive.pipe(output);

      // Include prompts directory (pList, aliChat, helpers, etc.)
      archive.directory(VOTC_PROMPTS_DIR, 'prompts');

      // Include current prompt settings and presets
      archive.append(JSON.stringify(settings, null, 2), { name: 'prompt-settings.json' });
      archive.append(JSON.stringify(presets, null, 2), { name: 'prompt-presets.json' });

      archive.finalize();
    } catch (error) {
      reject(error);
    }
  });
};

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
    alwaysOnTop: true, // Keep window on top
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
  chatWindow.setAlwaysOnTop(true, 'screen-saver');
  chatWindow.setIgnoreMouseEvents(true, { forward: true });

  // Set fullscreen (optional, might conflict with alwaysOnTop/transparency goals depending on OS/WM)
  chatWindow.setFullScreen(true); // Consider if truly needed, as size is already set to screen dimensions

  // and load the index.html of the app.
if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
  chatWindow.loadURL(process.env['ELECTRON_RENDERER_URL']); 
} else {
  chatWindow.loadFile(
    path.join(__dirname, '../renderer/index.html') // see below for prod
  );
}

  // // Open the DevTools.
  // chatWindow.webContents.openDevTools(
  //   { mode: 'detach' }
  // );

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

  // Prompt configuration IPC
  ipcMain.handle('prompts:getSettings', () => {
    return settingsRepository.getPromptSettings();
  });

  ipcMain.handle('prompts:saveSettings', (_event, settings) => {
    settingsRepository.savePromptSettings(settings);
    return true;
  });

  ipcMain.handle('prompts:getLetterSettings', () => {
    return settingsRepository.getLetterPromptSettings();
  });

  ipcMain.handle('prompts:saveLetterSettings', (_event, settings) => {
    settingsRepository.saveLetterPromptSettings(settings);
    return true;
  });

  ipcMain.handle('prompts:list', (_event, category: 'system' | 'character_description' | 'example_messages' | 'helpers') => {
    try {
      return promptConfigManager.listFiles(category);
    } catch (error: any) {
      console.error('Failed to list prompt files:', error);
      return [];
    }
  });

  ipcMain.handle('prompts:readFile', (_event, relativePath: string) => {
    try {
      return promptConfigManager.readPromptFile(relativePath);
    } catch (error: any) {
      console.error('Failed to read prompt file:', error);
      throw error;
    }
  });

  ipcMain.handle('prompts:saveFile', (_event, relativePath: string, content: string) => {
    try {
      promptConfigManager.savePromptFile(relativePath, content);
      return true;
    } catch (error: any) {
      console.error('Failed to save prompt file:', error);
      throw error;
    }
  });

  ipcMain.handle('prompts:getDefaultMain', () => {
    return promptConfigManager.getDefaultMainTemplateContent();
  });
  ipcMain.handle('prompts:getDefaultLetterMain', () => {
    return promptConfigManager.getDefaultLetterMainTemplateContent();
  });

  ipcMain.handle('prompts:listPresets', () => {
    return promptConfigManager.getPresets();
  });

  ipcMain.handle('prompts:savePreset', (_event, preset: PromptPreset) => {
    const normalizedSettings = promptConfigManager.normalizeSettings(preset.settings);
    const now = new Date().toISOString();
    const toSave: PromptPreset = {
      id: preset.id || uuidv4(),
      name: preset.name || 'Prompt Preset',
      createdAt: preset.createdAt || now,
      updatedAt: now,
      settings: normalizedSettings,
    };
    return promptConfigManager.savePreset(toSave);
  });

  ipcMain.handle('prompts:deletePreset', (_event, id: string) => {
    promptConfigManager.deletePreset(id);
    return true;
  });

  ipcMain.handle('prompts:openPromptsFolder', async () => {
    await shell.openPath(VOTC_PROMPTS_DIR);
    return true;
  });

  ipcMain.handle('prompts:openPromptFile', async (_event, relativePath: string) => {
    const full = promptConfigManager.resolvePath(relativePath);
    await shell.openPath(full);
    return true;
  });

  ipcMain.handle('prompts:exportZip', async (_event, payload: { settings?: PromptSettings, path?: string }) => {
    promptConfigManager.ensurePromptDirs();
    const normalizedSettings = promptConfigManager.normalizeSettings(payload?.settings || settingsRepository.getPromptSettings());
    const presets = promptConfigManager.getPresets();

    let targetPath = payload?.path;
    if (!targetPath) {
      const result = await dialog.showSaveDialog({
        title: 'Export prompt configuration',
        defaultPath: 'prompts-export.zip',
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
      });
      if (result.canceled || !result.filePath) {
        return { cancelled: true };
      }
      targetPath = result.filePath;
    }

    await exportPromptsZip(targetPath, normalizedSettings, presets);
    return { success: true, path: targetPath };
  });

  ipcMain.handle('letter:getPromptPreview', async () => {
    try {
      return await letterManager.buildPromptPreview();
    } catch (error: any) {
      console.error('Failed to build letter prompt preview:', error);
      return null;
    }
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

  ipcMain.handle('llm:listModels', async () => {
    try {
      return await llmManager.listModelsForProvider();
    } catch (error: any) {
      console.error('IPC llm:listModels error:', error);
      // Return error information to the renderer
      return { error: error.message || 'Failed to list models' };
    }
  });

  ipcMain.handle('llm:testConnection', async () => {
     return await llmManager.testProviderConnection();
     // Errors are caught within testProviderConnection and returned in the result object
  });

  ipcMain.handle('llm:setCK3Folder', (_, path: string | null) => {
    settingsRepository.setCK3UserFolderPath(path);
  });

  ipcMain.handle('llm:setModLocationPath', (_, path: string | null) => {
    settingsRepository.setModLocationPath(path);
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

  ipcMain.handle('llm:saveMessageFontSize', (_, fontSize: number) => {
    settingsRepository.saveMessageFontSize(fontSize);
  });

  ipcMain.handle('llm:saveShowSettingsOnStartupSetting', (_, enabled: boolean) => {
    settingsRepository.saveShowSettingsOnStartupSetting(enabled);
  });

  ipcMain.handle('llm:getCurrentContextLength', async () => {
    try {
      return await llmManager.getCurrentContextLength();
    } catch (error: any) {
      console.error('IPC llm:getCurrentContextLength error:', error);
      return 90000; // Fallback value
    }
  });

  ipcMain.handle('llm:getMaxContextLength', async () => {
    try {
      return await llmManager.getMaxContextLength();
    } catch (error: any) {
      console.error('IPC llm:getMaxContextLength error:', error);
      return 90000; // Fallback value
    }
  });

  ipcMain.handle('llm:setCustomContextLength', (_, contextLength: number) => {
    try {
      llmManager.setCustomContextLength(contextLength);
    } catch (error: any) {
      console.error('IPC llm:setCustomContextLength error:', error);
      throw error;
    }
  });

  ipcMain.handle('llm:clearCustomContextLength', () => {
    try {
      llmManager.clearCustomContextLength();
    } catch (error: any) {
      console.error('IPC llm:clearCustomContextLength error:', error);
      throw error;
    }
  });

  // --- Provider Override IPC Handlers ---
  ipcMain.handle('llm:getActionsProviderId', () => {
    return settingsRepository.getActionsProviderInstanceId();
  });

  ipcMain.handle('llm:setActionsProviderId', (_, instanceId: string | null) => {
    settingsRepository.setActionsProviderInstanceId(instanceId);
  });

  ipcMain.handle('llm:getSummaryProviderId', () => {
    return settingsRepository.getSummaryProviderInstanceId();
  });

  ipcMain.handle('llm:setSummaryProviderId', (_, instanceId: string | null) => {
    settingsRepository.setSummaryProviderInstanceId(instanceId);
  });

  ipcMain.handle('llm:importLegacySummaries', async () => {
  try {
    return await importLegacySummaries();
  } catch (error) {
    console.error('Import legacy summaries error:', error);
    return {
      success: false,
      message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
});


  console.log('Setting up action system IPC handlers...');

  // --- Action System IPC Handlers ---
  ipcMain.handle('actions:reload', async () => {
    try {
      await actionRegistry.reloadActions();
      return { success: true };
    } catch (error: any) {
      console.error('Failed to reload actions:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  });

  ipcMain.handle('actions:getAll', async () => {
    try {
      const actions = actionRegistry.getAllActions(/* includeDisabled = */ true);
      return actions.map(a => ({
        id: a.id,
        title: a.definition.title || a.id,
        scope: a.scope,
        filePath: a.filePath,
        validation: a.validation,
        disabled: actionRegistry.isActionDisabled(a.id)
      }));
    } catch (error: any) {
      console.error('Failed to get actions:', error);
      return [];
    }
  });

  ipcMain.handle('actions:setDisabled', async (_, { actionId, disabled }: { actionId: string; disabled: boolean }) => {
    try {
      actionRegistry.setActionDisabled(actionId, disabled);
      const settings = actionRegistry.getSettings();
      settingsRepository.saveActionSettings(settings);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to set action disabled state:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  });

  ipcMain.handle('actions:getSettings', async () => {
    try {
      return settingsRepository.getActionSettings();
    } catch (error: any) {
      console.error('Failed to get action settings:', error);
      return { disabledActions: [], validation: {} };
    }
  });

  ipcMain.handle('actions:openFolder', async () => {
    try {
      await shell.openPath(VOTC_ACTIONS_DIR);
      return;
    } catch (error: any) {
      console.error('Failed to open actions folder:', error);
      throw error;
    }
  });

  // Auto-updater IPC handlers
  ipcMain.handle('updater:checkForUpdates', () => {
    appUpdater.checkForUpdates();
    return true;
  });

  ipcMain.handle('updater:downloadUpdate', () => {
    appUpdater.downloadUpdate();
    return true;
  });

  ipcMain.handle('updater:installUpdate', () => {
    appUpdater.installUpdate();
    return true;
  });

  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to open external URL:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  });

  console.log('Setting up conversation IPC handlers...');

  // --- Conversation Management IPC Handlers ---

  ipcMain.handle('conversation:sendMessage', async (_, requestArgs: {
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

  ipcMain.handle('conversation:reset', () => {
    conversationManager.endCurrentConversation();
    // conversationManager.createConversation();
    return true;
  });

  ipcMain.handle('conversation:getEntries', () => {
    return conversationManager.getConversationEntries();
  });

  ipcMain.handle('conversation:cancelStream', () => {
    conversationManager.cancelCurrentStream();
  });

  ipcMain.handle('conversation:pause', () => {
    conversationManager.pauseConversation();
  });

  ipcMain.handle('conversation:resume', () => {
    conversationManager.resumeConversation();
  });

  ipcMain.handle('conversation:getState', () => {
    return conversationManager.getConversationState();
  });

  ipcMain.handle('conversation:regenerateMessage', async (_, requestArgs: {
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

  ipcMain.handle('conversation:editUserMessage', async (_, requestArgs: {
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

  ipcMain.handle('conversation:regenerateError', async (_, requestArgs: {
    messageId: number
  }) => {
    const { messageId } = requestArgs;

    try {
      console.log('IPC: Regenerating error:', messageId);
      const conversation = conversationManager.getCurrentConversation();
      if (!conversation) {
        throw new Error('No active conversation');
      }
      await conversationManager.regenerateError(messageId);
      return { success: true };
    } catch (error) {
      console.error('IPC: Failed to regenerate error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Set up conversation update listener
  const conversationUpdateCallback = (entries: any[]) => {
      if (chatWindow && !chatWindow.isDestroyed()) {
          chatWindow.webContents.send('conversation:updated', entries);
      }
  };

  // Subscribe to conversation updates
  conversationManager.onConversationUpdate(conversationUpdateCallback);

  console.log('Conversation IPC handlers registered successfully');
};

app.on('ready', () => {
  console.log(app.getPath('userData'));
  clearLog();
  promptConfigManager.seedDefaults();
  setupIpcHandlers(); // Setup handlers first
  chatWindow = createWindow(); // Create the main chat window and assign to global
  
  // Set up auto-updater
  appUpdater.setMainWindow(chatWindow);
  
  // Check for updates on startup
  if (app.isPackaged) {
    appUpdater.checkForUpdates();
  }
  
  // Initialize actions registry with saved settings and preload actions
  actionRegistry.setSettings(settingsRepository.getActionSettings());
  actionRegistry.reloadActions().catch(err => console.error('Failed to reload actions on startup:', err));

  console.log('Current __dirname:', __dirname);
  console.log('Process resources:', process.resourcesPath);
  console.log('App path:', app.getAppPath());

  try {
    tray = new Tray(appIcon);
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

  clipboardListener.on('VOTC:LETTER', async () => {
    console.log('VOTC:LETTER detected - generating reply');
    try {
      await letterManager.processLatestLetter();
    } catch (error) {
      console.error('Failed to process letter:', error);
    }
  });

  clipboardListener.on('VOTC:LETTER_ACCEPTED', () => {
    console.log('VOTC:LETTER_ACCEPTED detected - clearing letters.txt');
    try {
      letterManager.clearLettersFile();
    } catch (error) {
      console.error('Failed to clear letters file:', error);
    }
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

  const reta = globalShortcut.register('Control+Shift+H', () => {
    if (chatWindow && !chatWindow.isDestroyed()) {
      console.log('Ctrl+Shift+H pressed - toggling settings');
      chatWindow.webContents.send('toggle-settings');
    }
  });

  if (!reta) {
    console.log('Failed to register Ctrl+Shift+H global shortcut');
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
  // Stop letter manager log tailing
  letterManager.stopLogTailing();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();  }
});
