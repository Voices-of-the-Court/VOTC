import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { AppSettings, LLMProviderConfig, ProviderType, ILLMModel, PromptSettings, PromptPreset } from '@llmTypes';

const DEFAULT_PARAMETERS = { temperature: 0.7, max_tokens: 2048 };

interface ConfigStore {
  // Settings state
  appSettings: AppSettings | null;
  
  // Model cache (session-only)
  modelCache: Map<string, ILLMModel[]>;
  isLoadingModels: boolean;
  
  // Selection state
  selectedProviderType: ProviderType | null;
  selectedPresetId: string | null;
  editingConfig: Partial<LLMProviderConfig>;
  initialConfig: Partial<LLMProviderConfig>;
  
  // Provider override state
  actionsProviderInstanceId: string | null;
  summaryProviderInstanceId: string | null;
  
  // UI state
  testResult: { success: boolean; message?: string; error?: string } | null;
  
  // Auto-save
  autoSaveTimer: NodeJS.Timeout | null;

  // Prompt config
  promptSettings: PromptSettings | null;
  letterPromptSettings: PromptSettings | null;
  promptFiles: {
    system: string[];
    descriptions: string[];
    examples: string[];
  };
  promptPresets: PromptPreset[];
  
  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (settings: AppSettings) => void;
  
  fetchModels: (config: Partial<LLMProviderConfig>) => Promise<void>;
  getCachedModels: (cacheKey: string) => ILLMModel[];
  
  selectProvider: (type: ProviderType) => Promise<void>;
  selectPreset: (id: string) => Promise<void>;
  updateEditingConfig: (updates: Partial<LLMProviderConfig>) => void;
  
  saveConfigDebounced: () => void;
  saveConfigImmediate: () => Promise<void>;
  
  testConnection: () => Promise<void>;
  setTestResult: (result: ConfigStore['testResult']) => void;
  
  createPreset: (name: string) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
  
  // Provider override actions
  setActionsProvider: (instanceId: string | null) => Promise<void>;
  setSummaryProvider: (instanceId: string | null) => Promise<void>;

  // Settings actions
  updateGlobalStreamSetting: (enabled: boolean) => Promise<void>;
  updatePauseOnRegeneration: (enabled: boolean) => Promise<void>;
  updateGenerateFollowingMessages: (enabled: boolean) => Promise<void>;
  updateMessageFontSize: (fontSize: number) => Promise<void>;
  updateShowSettingsOnStartup: (enabled: boolean) => Promise<void>;
  updateCK3Folder: (path: string) => Promise<void>;
  selectCK3Folder: () => Promise<void>;
  updateModLocationPath: (path: string) => Promise<void>;
  selectModLocationPath: () => Promise<void>;
  importLegacySummaries: () => Promise<{success: boolean, message: string, filesCopied?: number, errors?: string[]}>;
  openSummariesFolder: () => Promise<{success: boolean, error?: string}>;
  clearSummaries: () => Promise<{success: boolean, error?: string}>;
  
  // Action approval settings
  getActionApprovalSettings: () => Promise<any>;
  saveActionApprovalSettings: (settings: any) => Promise<void>;

  // Prompt actions
  loadPromptSettings: () => Promise<void>;
  savePromptSettings: (settings: PromptSettings) => Promise<void>;
  loadLetterPromptSettings: () => Promise<void>;
  saveLetterPromptSettings: (settings: PromptSettings) => Promise<void>;
  refreshPromptFiles: () => Promise<void>;
  readPromptFile: (relativePath: string) => Promise<string>;
  savePromptFile: (relativePath: string, content: string) => Promise<void>;
  loadPromptPresets: () => Promise<void>;
  savePromptPreset: (preset: PromptPreset) => Promise<PromptPreset>;
  deletePromptPreset: (id: string) => Promise<void>;
  exportPromptsZip: (settings?: PromptSettings) => Promise<{ success?: boolean; cancelled?: boolean; path?: string }>;
  openPromptsFolder: () => Promise<void>;
  openPromptFile: (relativePath: string) => Promise<void>;
}

const getCacheKey = (config: Partial<LLMProviderConfig>): string => {
  // All OpenRouter configs (base + presets) share one cache
  if (config.providerType === 'openrouter') return 'openrouter';
  
  // OpenAI-compatible and Ollama use instanceId (each has own cache)
  return config.instanceId || '';
};

export const useConfigStore = create<ConfigStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      appSettings: null,
      modelCache: new Map(),
      isLoadingModels: false,
      selectedProviderType: null,
      selectedPresetId: null,
      editingConfig: {},
      initialConfig: {},
      actionsProviderInstanceId: null,
      summaryProviderInstanceId: null,
      testResult: null,
      autoSaveTimer: null,
      promptSettings: null,
      letterPromptSettings: null,
      promptFiles: { system: [], descriptions: [], examples: [] },
      promptPresets: [],

      // Load settings from backend
      loadSettings: async () => {
        const settings = await window.llmConfigAPI.getAppSettings();
        const actionsProviderId = await window.llmConfigAPI.getActionsProviderId();
        const summaryProviderId = await window.llmConfigAPI.getSummaryProviderId();
        const promptSettings = await window.promptsAPI.getSettings();
        const letterPromptSettings = await window.promptsAPI.getLetterSettings();
        const systemFiles = await window.promptsAPI.listFiles('system');
        const descFiles = await window.promptsAPI.listFiles('character_description');
        const exampleFiles = await window.promptsAPI.listFiles('example_messages');
        const promptPresets = await window.promptsAPI.listPresets();
        
        set({
          appSettings: settings,
          actionsProviderInstanceId: actionsProviderId,
          summaryProviderInstanceId: summaryProviderId,
          promptSettings,
          letterPromptSettings,
          promptFiles: {
            system: systemFiles,
            descriptions: descFiles,
            examples: exampleFiles,
          },
          promptPresets,
        });
        
        // Initialize selection based on active provider
        const activeId = settings.llmSettings.activeProviderInstanceId;
        if (activeId) {
          const isBaseProvider = ['openrouter', 'ollama', 'openai-compatible'].includes(activeId);
          
          if (isBaseProvider) {
            get().selectProvider(activeId as ProviderType);
          } else {
            get().selectPreset(activeId);
          }
        } else {
          // Default to openrouter
          get().selectProvider('openrouter');
        }
      },

      updateSettings: (settings) => {
        set({ appSettings: settings });
      },

      // Fetch and cache models
      fetchModels: async (config) => {
        if (!config.providerType) return;
        
        const cacheKey = getCacheKey(config);
        const { modelCache } = get();
        
        // Return cached if available
        if (modelCache.has(cacheKey)) {
          console.log(`Using cached models for ${cacheKey}`);
          return;
        }
        
        // Validation checks
        if (config.providerType === 'openrouter' && !config.apiKey) {
          return;
        }
        if ((config.providerType === 'ollama' || config.providerType === 'openai-compatible') && !config.baseUrl) {
          return;
        }
        
        set({ isLoadingModels: true });
        
        try {
          const result = await window.llmConfigAPI.listModels();
          
          if ('error' in result) {
            console.error('Error listing models:', result.error);
          } else {
            const newCache = new Map(modelCache);
            newCache.set(cacheKey, result);
            set({ modelCache: newCache });
            console.log(`Cached ${result.length} models for ${cacheKey}`);
          }
        } catch (error) {
          console.error('Failed to fetch models:', error);
        } finally {
          set({ isLoadingModels: false });
        }
      },

      getCachedModels: (cacheKey) => {
        return get().modelCache.get(cacheKey) || [];
      },

      // Select provider
      selectProvider: async (type) => {
        const { appSettings } = get();
        if (!appSettings) return;
        
        // Get config
        const config = appSettings.llmSettings.providers.find(p => p.providerType === type) || {
          instanceId: type,
          providerType: type,
          apiKey: '',
          baseUrl: type === 'ollama' ? 'http://localhost:11434' : '',
          defaultModel: '',
          defaultParameters: { ...DEFAULT_PARAMETERS },
        };
        
        set({
          selectedProviderType: type,
          selectedPresetId: null,
          editingConfig: config,
          initialConfig: config,
          testResult: null,
        });
        
        // Set active provider
        await window.llmConfigAPI.setActiveProvider(type);
        
        // Fetch models if not cached
        get().fetchModels(config);
      },

      // Select preset
      selectPreset: async (id) => {
        const { appSettings } = get();
        if (!appSettings) return;
        
        const preset = appSettings.llmSettings.presets.find(p => p.instanceId === id);
        if (!preset) return;
        
        set({
          selectedProviderType: null,
          selectedPresetId: id,
          editingConfig: preset,
          initialConfig: preset,
          testResult: null,
        });
        
        // Set active provider
        await window.llmConfigAPI.setActiveProvider(id);
        
        // Fetch models if not cached
        get().fetchModels(preset);
      },

      // Update editing config (no auto-save here)
      updateEditingConfig: (updates) => {
        set((state) => ({
          editingConfig: { ...state.editingConfig, ...updates },
        }));
        
        // Trigger debounced save
        get().saveConfigDebounced();
      },

      // Debounced save
      saveConfigDebounced: () => {
        const { autoSaveTimer } = get();
        
        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer);
        }
        
        const timer = setTimeout(() => {
          get().saveConfigImmediate();
        }, 1000);
        
        set({ autoSaveTimer: timer });
      },

      // Immediate save
      saveConfigImmediate: async () => {
        const { editingConfig, initialConfig, appSettings } = get();
        
        // Validate
        if (!editingConfig.providerType || !editingConfig.instanceId) {
          return;
        }
        
        // Check if changed
        if (JSON.stringify(editingConfig) === JSON.stringify(initialConfig)) {
          return;
        }
        
        const configToSave: LLMProviderConfig = {
          instanceId: editingConfig.instanceId!,
          providerType: editingConfig.providerType!,
          customName: editingConfig.customName,
          apiKey: editingConfig.apiKey || '',
          baseUrl: editingConfig.baseUrl || '',
          defaultModel: editingConfig.defaultModel || '',
          defaultParameters: editingConfig.defaultParameters || { ...DEFAULT_PARAMETERS },
          customContextLength: editingConfig.customContextLength,
        };
        
        try {
          const saved = await window.llmConfigAPI.saveProviderConfig(configToSave);
          
          if (!appSettings) return;
          
          const baseProviderTypes = ['openrouter', 'ollama', 'openai-compatible'];
          let newProviders = [...appSettings.llmSettings.providers];
          let newPresets = [...appSettings.llmSettings.presets];
          
          if (baseProviderTypes.includes(saved.instanceId)) {
            const index = newProviders.findIndex(p => p.instanceId === saved.instanceId);
            if (index > -1) {
              newProviders[index] = saved;
            } else {
              newProviders.push(saved);
            }
          } else {
            const index = newPresets.findIndex(p => p.instanceId === saved.instanceId);
            if (index > -1) {
              newPresets[index] = saved;
            } else {
              newPresets.push(saved);
            }
          }
          
          const updatedSettings = {
            ...appSettings,
            llmSettings: {
              ...appSettings.llmSettings,
              providers: newProviders,
              presets: newPresets,
            },
          };
          
          set({
            appSettings: updatedSettings,
            initialConfig: saved,
          });
          
          console.log(`Auto-saved: ${saved.customName || saved.providerType}`);
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      },

      // Test connection
      testConnection: async () => {
        set({ testResult: null });
        const result = await window.llmConfigAPI.testConnection();
        set({ testResult: result });
      },

      setTestResult: (result) => {
        set({ testResult: result });
      },

      // Create preset
      createPreset: async (name) => {
        const { editingConfig, appSettings } = get();
        
        if (!editingConfig.providerType || !appSettings) {
          alert('Cannot create preset from incomplete configuration.');
          return;
        }
        
        const newPreset: LLMProviderConfig = {
          instanceId: crypto.randomUUID(),
          providerType: editingConfig.providerType,
          customName: name,
          apiKey: editingConfig.apiKey || '',
          baseUrl: editingConfig.baseUrl || (editingConfig.providerType === 'ollama' ? 'http://localhost:11434' : ''),
          defaultModel: editingConfig.defaultModel || '',
          defaultParameters: editingConfig.defaultParameters || { ...DEFAULT_PARAMETERS },
          customContextLength: editingConfig.customContextLength,
        };
        
        try {
          const saved = await window.llmConfigAPI.saveProviderConfig(newPreset);
          
          const updatedSettings = {
            ...appSettings,
            llmSettings: {
              ...appSettings.llmSettings,
              presets: [...appSettings.llmSettings.presets, saved],
              activeProviderInstanceId: saved.instanceId,
            },
          };
          
          set({ appSettings: updatedSettings });
          
          // Select the new preset
          get().selectPreset(saved.instanceId);
        } catch (error) {
          console.error('Failed to create preset:', error);
          alert('Failed to create preset. See console for details.');
        }
      },

      // Delete preset
      deletePreset: async (id) => {
        const { appSettings, selectedPresetId } = get();
        if (!appSettings) return;
        
        await window.llmConfigAPI.deletePreset(id);
        
        const newPresets = appSettings.llmSettings.presets.filter(p => p.instanceId !== id);
        const wasActive = appSettings.llmSettings.activeProviderInstanceId === id;
        const wasEditing = selectedPresetId === id;
        
        // Determine new active/selected
        let newActiveId: string | null = appSettings.llmSettings.activeProviderInstanceId!;
        
        if (wasActive) {
          if (newPresets.length > 0) {
            newActiveId = newPresets[0].instanceId;
          } else {
            newActiveId = 'openrouter';
          }
        }
        
        const updatedSettings = {
          ...appSettings,
          llmSettings: {
            ...appSettings.llmSettings,
            presets: newPresets,
            activeProviderInstanceId: newActiveId,
          },
        };
        
        set({ appSettings: updatedSettings });
        
        // Update selection if we were editing the deleted preset
        if (wasEditing) {
          if (newActiveId && ['openrouter', 'ollama', 'openai-compatible'].includes(newActiveId)) {
            get().selectProvider(newActiveId as ProviderType);
          } else if (newActiveId) {
            get().selectPreset(newActiveId);
          } else {
            get().selectProvider('openrouter');
          }
        }
      },

      // Settings actions
      updateGlobalStreamSetting: async (enabled) => {
        await window.llmConfigAPI.saveGlobalStreamSetting(enabled);
        set((state) => ({
          appSettings: state.appSettings 
            ? { ...state.appSettings, globalStreamEnabled: enabled }
            : null,
        }));
      },

      updatePauseOnRegeneration: async (enabled) => {
        await window.llmConfigAPI.savePauseOnRegenerationSetting(enabled);
        set((state) => ({
          appSettings: state.appSettings
            ? { ...state.appSettings, pauseOnRegeneration: enabled }
            : null,
        }));
      },

      updateGenerateFollowingMessages: async (enabled) => {
        await window.llmConfigAPI.saveGenerateFollowingMessagesSetting(enabled);
        set((state) => ({
          appSettings: state.appSettings
            ? { ...state.appSettings, generateFollowingMessages: enabled }
            : null,
        }));
      },

      updateCK3Folder: async (path) => {
        await window.llmConfigAPI.setCK3Folder(path);
        set((state) => ({
          appSettings: state.appSettings
            ? { ...state.appSettings, ck3UserFolderPath: path }
            : null,
        }));
      },

      selectCK3Folder: async () => {
        const path = await window.llmConfigAPI.selectFolder();
        if (path) {
          get().updateCK3Folder(path);
        }
      },

      updateModLocationPath: async (path) => {
        await window.llmConfigAPI.setModLocationPath(path);
        set((state) => ({
          appSettings: state.appSettings
            ? { ...state.appSettings, modLocationPath: path }
            : null,
        }));
      },

      selectModLocationPath: async () => {
        const path = await window.llmConfigAPI.selectFolder();
        if (path) {
          get().updateModLocationPath(path);
        }
      },

      importLegacySummaries: async () => {
        const result = await window.llmConfigAPI.importLegacySummaries();
        
        // Show feedback to user (this could be handled via a toast/notification system)
        if (result.success) {
          console.log(`Import successful: ${result.filesCopied} files copied`);
        } else {
          console.error('Import failed:', result.message);
          if (result.errors && result.errors.length > 0) {
            console.error('Import errors:', result.errors);
          }
        }
        
        return result;
        },
        
        openSummariesFolder: async () => {
          try {
            const result = await window.conversationAPI.openSummariesFolder();
            return result;
          } catch (error) {
            console.error('Failed to open summaries folder:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        },
        
        clearSummaries: async () => {
          try {
            const result = await window.conversationAPI.clearSummaries();
            
            // Show feedback to user
            if (result.success) {
              console.log('Summaries cleared successfully');
            } else {
              console.error('Failed to clear summaries:', result.error);
            }
            
            return result;
          } catch (error) {
            console.error('Failed to clear summaries:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        },
  
        updateMessageFontSize: async (fontSize) => {
          await window.llmConfigAPI.saveMessageFontSize(fontSize);
          set((state) => ({
            appSettings: state.appSettings
              ? { ...state.appSettings, messageFontSize: fontSize }
              : null,
          }));
        },
        
        updateShowSettingsOnStartup: async (enabled) => {
        await window.llmConfigAPI.saveShowSettingsOnStartupSetting(enabled);
        set((state) => ({
          appSettings: state.appSettings
            ? { ...state.appSettings, showSettingsOnStartup: enabled }
            : null,
        }));
      },
      
      // Action approval settings
      getActionApprovalSettings: async () => {
        return await window.llmConfigAPI.getActionApprovalSettings();
      },
      
      saveActionApprovalSettings: async (settings) => {
        await window.llmConfigAPI.saveActionApprovalSettings(settings);
        set((state) => ({
          appSettings: state.appSettings
            ? { 
                ...state.appSettings, 
                actionApprovalSettings: settings 
              }
            : null,
        }));
      },
        
        // Prompt settings actions
      loadPromptSettings: async () => {
        const promptSettings = await window.promptsAPI.getSettings();
        const letterPromptSettings = await window.promptsAPI.getLetterSettings();
        const systemFiles = await window.promptsAPI.listFiles('system');
        const descFiles = await window.promptsAPI.listFiles('character_description');
        const exampleFiles = await window.promptsAPI.listFiles('example_messages');
        const promptPresets = await window.promptsAPI.listPresets();
        set({ promptSettings, letterPromptSettings, promptFiles: { system: systemFiles, descriptions: descFiles, examples: exampleFiles }, promptPresets });
      },
      savePromptSettings: async (settings) => {
        await window.promptsAPI.saveSettings(settings);
        set({ promptSettings: settings });
      },
      loadLetterPromptSettings: async () => {
        const letterPromptSettings = await window.promptsAPI.getLetterSettings();
        set({ letterPromptSettings });
      },
      saveLetterPromptSettings: async (settings) => {
        await window.promptsAPI.saveLetterSettings(settings);
        set({ letterPromptSettings: settings });
      },
      refreshPromptFiles: async () => {
        const systemFiles = await window.promptsAPI.listFiles('system');
        const descFiles = await window.promptsAPI.listFiles('character_description');
        const exampleFiles = await window.promptsAPI.listFiles('example_messages');
        set({ promptFiles: { system: systemFiles, descriptions: descFiles, examples: exampleFiles } });
      },
      readPromptFile: async (relativePath) => {
        return window.promptsAPI.readFile(relativePath);
      },
      savePromptFile: async (relativePath, content) => {
        await window.promptsAPI.saveFile(relativePath, content);
        await get().refreshPromptFiles();
      },
      loadPromptPresets: async () => {
        const promptPresets = await window.promptsAPI.listPresets();
        set({ promptPresets });
      },
      savePromptPreset: async (preset) => {
        const saved = await window.promptsAPI.savePreset(preset);
        await get().loadPromptPresets();
        return saved;
      },
      deletePromptPreset: async (id) => {
        await window.promptsAPI.deletePreset(id);
        await get().loadPromptPresets();
      },
      exportPromptsZip: async (settings) => {
        return window.promptsAPI.exportZip({ settings });
      },
      openPromptsFolder: async () => {
        await window.promptsAPI.openPromptsFolder();
      },
      openPromptFile: async (relativePath) => {
        await window.promptsAPI.openPromptFile(relativePath);
      },
      
      // Provider override actions
      setActionsProvider: async (instanceId) => {
        await window.llmConfigAPI.setActionsProviderId(instanceId);
        set({ actionsProviderInstanceId: instanceId });
      },
      
      setSummaryProvider: async (instanceId) => {
        await window.llmConfigAPI.setSummaryProviderId(instanceId);
        set({ summaryProviderInstanceId: instanceId });
      },
    }),
    { name: 'ConfigStore' }
  )
);

// Selectors for granular subscriptions (at the bottom of the file)
// At the bottom of useConfigStore.ts
export const useAppSettings = () => useConfigStore((state) => state.appSettings);
export const useEditingConfig = () => useConfigStore((state) => state.editingConfig);
export const useTestResult = () => useConfigStore((state) => state.testResult);

// Custom hooks for object selectors
export const useSelection = () => {
  const selectedProviderType = useConfigStore((state) => state.selectedProviderType);
  const selectedPresetId = useConfigStore((state) => state.selectedPresetId);
  
  return { selectedProviderType, selectedPresetId };
};

export const useModelState = () => {
  const isLoadingModels = useConfigStore((state) => state.isLoadingModels);
  const getCachedModels = useConfigStore((state) => state.getCachedModels);
  
  return { isLoadingModels, getCachedModels };
};

export const usePromptSettings = () => useConfigStore((state) => state.promptSettings);
export const usePromptFiles = () => useConfigStore((state) => state.promptFiles);
