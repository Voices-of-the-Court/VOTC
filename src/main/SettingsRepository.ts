import Store, { Schema } from 'electron-store';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs for provider configs
import path from 'path';
import {
  AppSettings,
  LLMSettings,
  LLMProviderConfig,
  ActionSettings,
  PromptSettings,
  ActionApprovalSettings,
  SummaryPromptSettings,
  PROVIDER_TYPES,
  DEFAULT_PROVIDER_CONFIGS,
  DEFAULT_ACTIVE_PROVIDER,
} from './llmProviders/types';
import { promptConfigManager } from './conversation/PromptConfigManager';

// Define the schema for electron-store for type safety
// Note: We don't use enum validation here to avoid breaking existing settings during refactoring
// TypeScript still enforces type safety through the ProviderType type
const baseProviderConfigSchema = {
  type: 'object' as const,
  properties: {
    instanceId: { type: 'string' as const },
    providerType: { type: 'string' as const },
    customName: { type: 'string' as const },
    apiKey: { type: 'string' as const },
    baseUrl: { type: 'string' as const },
    defaultModel: { type: 'string' as const },
    defaultParameters: { type: 'object' as const },
    customContextLength: { type: 'number' as const },
    useMinimizedActionsSchema: { type: 'boolean' as const },
  },
  required: ['instanceId', 'providerType']
};

const schema: Schema<AppSettings> = {
	llmSettings: {
		type: 'object',
    default: {
      providers: [], // Will be initialized with 3 base configs
      presets: [],
      activeProviderInstanceId: null,
    } as LLMSettings,
		properties: {
			providers: { // Stores the 3 base configurations
				type: 'array',
        default: [],
        items: baseProviderConfigSchema
			},
      presets: { // Stores user-created presets
        type: 'array',
        default: [],
        items: baseProviderConfigSchema
      },
			activeProviderInstanceId: {
			     type: ['string', 'null'],
			     default: null
			   },
			   actionsProviderInstanceId: {
			     type: ['string', 'null'],
			     default: null
			   },
			   summaryProviderInstanceId: {
			     type: ['string', 'null'],
			     default: null
			   }
		}
	},
  ck3UserFolderPath: {
    type: ['string', 'null'],
    default: null
  },
  modLocationPath: {
    type: ['string', 'null'],
    default: null
  },
  globalStreamEnabled: {
    type: 'boolean',
    default: true
  },
  pauseOnRegeneration: {
    type: 'boolean',
    default: true
  },
  generateFollowingMessages: {
    type: 'boolean',
    default: true
  },
  messageFontSize: {
    type: 'number',
    default: 1.1
  },
  showSettingsOnStartup: {
    type: 'boolean',
    default: true
  },
  language: {
    type: 'string',
    default: 'en'
  },
  promptSettings: {
    type: 'object',
    default: {} as PromptSettings,
    properties: {
      mainTemplate: { type: 'string', default: '' },
      defaultMainTemplatePath: { type: 'string', default: 'system/default.hbs' },
      blocks: { type: 'array', default: [] },
      suffix: {
        type: 'object',
        default: { enabled: false, template: '', label: 'Suffix' },
        properties: {
          enabled: { type: 'boolean', default: false },
          template: { type: 'string', default: '' },
          label: { type: 'string', default: 'Suffix' }
        }
      }
    }
  },
  letterPromptSettings: {
    type: 'object',
    default: {} as PromptSettings,
    properties: {
      mainTemplate: { type: 'string', default: '' },
      defaultMainTemplatePath: { type: 'string', default: 'system/letter.hbs' },
      blocks: { type: 'array', default: [] },
      suffix: {
        type: 'object',
        default: { enabled: false, template: '', label: 'Suffix' },
        properties: {
          enabled: { type: 'boolean', default: false },
          template: { type: 'string', default: '' },
          label: { type: 'string', default: 'Suffix' }
        }
      }
    }
  },
  actionSettings: {
    type: 'object',
    default: { disabledActions: [], validation: {} } as any,
    properties: {
      disabledActions: {
        type: 'array',
        default: [],
        items: { type: 'string' }
      },
      validation: {
        type: 'object',
        default: {}
      }
    }
  },
  actionApprovalSettings: {
    type: 'object',
    default: { approvalMode: 'none', pauseOnApproval: true },
    properties: {
      approvalMode: {
        type: 'string',
        enum: ['none', 'non-destructive', 'all'],
        default: 'none'
      },
      pauseOnApproval: {
        type: 'boolean',
        default: true
      }
    }
  },
  summaryPromptSettings: {
    type: 'object',
    default: { rollingPrompt: '', finalPrompt: '', letterSummaryPrompt: '' },
    properties: {
      rollingPrompt: { type: 'string', default: '' },
      finalPrompt: { type: 'string', default: '' },
      letterSummaryPrompt: { type: 'string', default: '' }
    }
  }
};

export class SettingsRepository {
  private store: Store<AppSettings>;

  constructor() {
    this.store = new Store<AppSettings>({ schema, name: 'votc-llm-config' });
    console.log('SettingsRepository initialized. Settings path:', this.store.path);
    this.initializeDefaultSettings();
  }

  private initializeDefaultSettings(): void {
    const currentSettings = this.store.get('llmSettings', { providers: [], presets: [], activeProviderInstanceId: null });
    const currentAppSettings = this.store.store;

    let updatedProviders = [...currentSettings.providers];
    let settingsChanged = false;

    PROVIDER_TYPES.forEach(type => {
      if (!updatedProviders.some(p => p.providerType === type && p.instanceId === type)) {
        updatedProviders.push({
          instanceId: type,
          providerType: type,
          // customName: type.charAt(0).toUpperCase() + type.slice(1), // No customName for base configs
          ...DEFAULT_PROVIDER_CONFIGS[type],
          // customContextLength is intentionally omitted to use default
        } as LLMProviderConfig);
        settingsChanged = true;
      }
    });
    // Ensure providers only contains one of each base type
    updatedProviders = PROVIDER_TYPES.map(type => {
        const existing = updatedProviders.find(p => p.providerType === type && p.instanceId === type);
        return existing || { // Should not happen if logic above is correct, but as a fallback
            instanceId: type, providerType: type,
            ...DEFAULT_PROVIDER_CONFIGS[type]
            // customContextLength is intentionally omitted to use default
        } as LLMProviderConfig;
    }).filter(p => PROVIDER_TYPES.includes(p.instanceId as any));


    if (settingsChanged) {
      currentSettings.providers = updatedProviders;
    }

    // Initialize presets if not present
    if (!currentSettings.presets) {
      currentSettings.presets = [];
      settingsChanged = true;
    }

    // If no active provider is set, default to the default active provider
    if (currentSettings.activeProviderInstanceId === null && updatedProviders.some(p => p.instanceId === DEFAULT_ACTIVE_PROVIDER)) {
      currentSettings.activeProviderInstanceId = DEFAULT_ACTIVE_PROVIDER;
      settingsChanged = true; // Ensure this change is part of what might be saved
    }

    this.store.set('llmSettings', currentSettings);

    if (currentAppSettings.globalStreamEnabled === undefined) {
        this.store.set('globalStreamEnabled', true); // Default global stream to true
    }
    if (currentAppSettings.ck3UserFolderPath === undefined) {
        this.store.set('ck3UserFolderPath', null);
    }
    if ((currentAppSettings as any).actionSettings === undefined) {
        this.store.set('actionSettings', { disabledActions: [], validation: {} } as any);
    }
    if ((currentAppSettings as any).promptSettings === undefined) {
        this.store.set('promptSettings', this.getDefaultPromptSettings());
    }
    if ((currentAppSettings as any).letterPromptSettings === undefined) {
        this.store.set('letterPromptSettings', this.getDefaultLetterPromptSettings());
    }
    if (currentAppSettings.messageFontSize === undefined) {
        this.store.set('messageFontSize', 1.1); // Default font size
    }
    if (currentAppSettings.showSettingsOnStartup === undefined) {
        this.store.set('showSettingsOnStartup', true); // Default to showing settings on startup
    }
    if ((currentAppSettings as any).actionApprovalSettings === undefined) {
        this.store.set('actionApprovalSettings', {
            approvalMode: 'none',
            pauseOnApproval: true
        });
    }
    if ((currentAppSettings as any).summaryPromptSettings === undefined) {
        this.store.set('summaryPromptSettings', {
            rollingPrompt: '',
            finalPrompt: '',
            letterSummaryPrompt: ''
        });
    }
  }

  private getDefaultPromptSettings(): PromptSettings {
    return promptConfigManager.normalizeSettings(
      {
        mainTemplate: promptConfigManager.getDefaultMainTemplateContent(),
        defaultMainTemplatePath: 'system/default.hbs',
        blocks: promptConfigManager.getDefaultBlocks(),
        suffix: { enabled: false, template: '', label: 'Suffix' }
      },
      {
        defaultBlocks: promptConfigManager.getDefaultBlocks(),
        defaultMainTemplatePath: 'system/default.hbs',
        fallbackMainTemplate: promptConfigManager.getDefaultMainTemplateContent()
      }
    );
  }

  private getDefaultLetterPromptSettings(): PromptSettings {
    return promptConfigManager.normalizeSettings(
      {
        mainTemplate: promptConfigManager.getDefaultLetterMainTemplateContent(),
        defaultMainTemplatePath: 'system/letter.hbs',
        blocks: promptConfigManager.getDefaultLetterBlocks(),
        suffix: { enabled: false, template: '', label: 'Suffix' }
      },
      {
        defaultBlocks: promptConfigManager.getDefaultLetterBlocks(),
        defaultMainTemplatePath: 'system/letter.hbs',
        fallbackMainTemplate: promptConfigManager.getDefaultLetterMainTemplateContent()
      }
    );
  }

  // --- Settings Management ---

  getAppSettings(): AppSettings {
    return {
      llmSettings: this.getLLMSettings(),
      ck3UserFolderPath: this.getCK3UserFolderPath(),
      modLocationPath: this.getModLocationPath(),
      globalStreamEnabled: this.getGlobalStreamSetting(),
      pauseOnRegeneration: this.getPauseOnRegenerationSetting(),
      generateFollowingMessages: this.getGenerateFollowingMessagesSetting(),
      messageFontSize: this.getMessageFontSize(),
      showSettingsOnStartup: this.getShowSettingsOnStartup(),
      promptSettings: this.getPromptSettings(),
      letterPromptSettings: this.getLetterPromptSettings(),
      actionSettings: this.getActionSettings(),
      actionApprovalSettings: this.getActionApprovalSettings(),
      summaryPromptSettings: this.getSummaryPromptSettings(),
      language: this.getLanguage()
    };
  }

  getLLMSettings(): LLMSettings {
    // Defaults are handled by initializeDefaultSettings and schema
    return this.store.get('llmSettings');
  }

  saveLLMSettings(settings: LLMSettings): void {
    this.store.set('llmSettings', settings);
    console.log('LLM Settings saved.');
  }

  getGlobalStreamSetting(): boolean {
    return this.store.get('globalStreamEnabled', true); // Default to true if not set
  }

  saveGlobalStreamSetting(enabled: boolean): void {
    this.store.set('globalStreamEnabled', enabled);
    console.log('Global stream setting saved:', enabled);
  }

  getCK3UserFolderPath(): string | null | undefined {
     const path = this.store.get('ck3UserFolderPath');
     console.log(`SettingsRepository.getCK3UserFolderPath: Returning ${path}`);
     return path;
  }

  getCK3DebugLogPath(): string | null {
     const ck3Folder = this.getCK3UserFolderPath();
     const debugPath = ck3Folder ? path.join(ck3Folder, 'logs', 'debug.log') : null;
     console.log(`SettingsRepository.getCK3DebugLogPath: ck3Folder=${ck3Folder}, debugPath=${debugPath}`);
     return debugPath;
  }

  setCK3UserFolderPath(path: string | null): void {
    console.log(`SettingsRepository.setCK3UserFolderPath: Setting path to ${path}`);
    this.store.set('ck3UserFolderPath', path);
    console.log('CK3 User Folder Path saved:', path);
  }

  getModLocationPath(): string | null | undefined {
    return this.store.get('modLocationPath');
  }

  setModLocationPath(modPath: string | null): void {
    this.store.set('modLocationPath', modPath);
    console.log('VOTC Mod Path saved:', modPath);
  }

  getPauseOnRegenerationSetting(): boolean {
    return this.store.get('pauseOnRegeneration', true); // Default to true
  }

  savePauseOnRegenerationSetting(enabled: boolean): void {
    this.store.set('pauseOnRegeneration', enabled);
    console.log('Pause on regeneration setting saved:', enabled);
  }

  getGenerateFollowingMessagesSetting(): boolean {
    return this.store.get('generateFollowingMessages', true); // Default to true
  }

  saveGenerateFollowingMessagesSetting(enabled: boolean): void {
    this.store.set('generateFollowingMessages', enabled);
    console.log('Generate following messages setting saved:', enabled);
  }

  getMessageFontSize(): number {
    return this.store.get('messageFontSize', 1.1); // Default to 1.1rem
  }

  saveMessageFontSize(fontSize: number): void {
    this.store.set('messageFontSize', fontSize);
    console.log('Message font size saved:', fontSize);
  }

  getShowSettingsOnStartup(): boolean {
    return this.store.get('showSettingsOnStartup', true); // Default to true
  }

  saveShowSettingsOnStartupSetting(enabled: boolean): void {
    this.store.set('showSettingsOnStartup', enabled);
    console.log('Show settings on startup setting saved:', enabled);
  }

  getLanguage(): string {
    return this.store.get('language', 'en'); // Default to English
  }

  saveLanguage(language: string): void {
    this.store.set('language', language);
    console.log('Language setting saved:', language);
  }

  // --- Prompt settings ---
  getPromptSettings(): PromptSettings {
    const stored = this.store.get('promptSettings', this.getDefaultPromptSettings());
    return promptConfigManager.normalizeSettings(stored, {
      defaultBlocks: promptConfigManager.getDefaultBlocks(),
      defaultMainTemplatePath: 'system/default.hbs',
      fallbackMainTemplate: promptConfigManager.getDefaultMainTemplateContent()
    });
  }

  savePromptSettings(settings: PromptSettings): void {
    this.store.set(
      'promptSettings',
      promptConfigManager.normalizeSettings(settings, {
        defaultBlocks: promptConfigManager.getDefaultBlocks(),
        defaultMainTemplatePath: 'system/default.hbs',
        fallbackMainTemplate: promptConfigManager.getDefaultMainTemplateContent()
      })
    );
    console.log('Prompt settings saved.');
  }

  getLetterPromptSettings(): PromptSettings {
    const stored = this.store.get('letterPromptSettings', this.getDefaultLetterPromptSettings());
    return promptConfigManager.normalizeSettings(stored, {
      defaultBlocks: promptConfigManager.getDefaultLetterBlocks(),
      defaultMainTemplatePath: 'system/letter.hbs',
      fallbackMainTemplate: promptConfigManager.getDefaultLetterMainTemplateContent()
    });
  }

  saveLetterPromptSettings(settings: PromptSettings): void {
    this.store.set(
      'letterPromptSettings',
      promptConfigManager.normalizeSettings(settings, {
        defaultBlocks: promptConfigManager.getDefaultLetterBlocks(),
        defaultMainTemplatePath: 'system/letter.hbs',
        fallbackMainTemplate: promptConfigManager.getDefaultLetterMainTemplateContent()
      })
    );
    console.log('Letter prompt settings saved.');
  }

  // --- Action Settings (actions toggles and validation cache) ---
  getActionSettings(): ActionSettings {
    // electron-store types are loose; cast for safety
    const def = { disabledActions: [], validation: {} } as any;
    return (this.store.get('actionSettings', def) as unknown) as ActionSettings;
  }

  saveActionSettings(settings: ActionSettings): void {
    this.store.set('actionSettings', settings as any);
    console.log('Action settings saved.');
  }

  // --- Action Approval Settings ---
  getActionApprovalSettings(): ActionApprovalSettings {
    return this.store.get('actionApprovalSettings', {
      approvalMode: 'none',
      pauseOnApproval: true
    });
  }

  saveActionApprovalSettings(settings: ActionApprovalSettings): void {
    this.store.set('actionApprovalSettings', settings);
    console.log('Action approval settings saved:', settings);
  }

  getPauseOnActionApprovalSetting(): boolean {
    const settings = this.getActionApprovalSettings();
    return settings.pauseOnApproval ?? true;
  }

  savePauseOnActionApprovalSetting(enabled: boolean): void {
    const settings = this.getActionApprovalSettings();
    settings.pauseOnApproval = enabled;
    this.saveActionApprovalSettings(settings);
  }

  // --- Provider Configuration and Preset Management ---

  // This method now handles saving both base provider configs and presets
  saveProviderConfig(configToSave: LLMProviderConfig): LLMProviderConfig {
    const settings = this.getLLMSettings();

    if (PROVIDER_TYPES.includes(configToSave.instanceId as any)) { // It's a base provider config
      const index = settings.providers.findIndex(p => p.instanceId === configToSave.instanceId);
      if (index > -1) {
        settings.providers[index] = configToSave;
      } else {
        // This case should ideally be handled by initialization, but as a fallback:
        settings.providers.push(configToSave);
      }
    } else { // It's a preset
      if (!configToSave.instanceId) {
        // Preset must have a unique ID, not a base provider type ID
        configToSave.instanceId = uuidv4();
      }
      const index = settings.presets.findIndex(p => p.instanceId === configToSave.instanceId);
      if (index > -1) {
        settings.presets[index] = configToSave;
      } else {
        settings.presets.push(configToSave);
      }
    }
    this.saveLLMSettings(settings);
    return configToSave;
  }

  // deleteProviderConfig is effectively deletePreset now, as base configs are not deleted
  deletePreset(presetInstanceId: string): void {
    const settings = this.getLLMSettings();
    settings.presets = settings.presets.filter(p => p.instanceId !== presetInstanceId);
    if (settings.activeProviderInstanceId === presetInstanceId) {
      settings.activeProviderInstanceId = null; // Or set to a default base provider
    }
    // Clear overrides if they reference this preset
    if (settings.actionsProviderInstanceId === presetInstanceId) {
      settings.actionsProviderInstanceId = null;
    }
    if (settings.summaryProviderInstanceId === presetInstanceId) {
      settings.summaryProviderInstanceId = null;
    }
    this.saveLLMSettings(settings);
  }

  getActiveProviderInstanceId(): string | null | undefined {
    return this.getLLMSettings().activeProviderInstanceId;
  }

  setActiveProviderInstanceId(instanceId: string | null): void {
    const settings = this.getLLMSettings();
    settings.activeProviderInstanceId = instanceId;
    this.saveLLMSettings(settings);
  }

  getActiveProviderConfig(): LLMProviderConfig | null {
    const activeId = this.getActiveProviderInstanceId();
    if (!activeId) return null;

    // Check base providers first
    let config = this.getLLMSettings().providers.find(p => p.instanceId === activeId);
    if (config) return config;

    // Then check presets
    config = this.getLLMSettings().presets.find(p => p.instanceId === activeId);
    return config || null;
  }

  // --- Provider Override Management ---

  /**
   * Helper to get any provider config by instanceId (base or preset)
   */
  getProviderConfigById(instanceId: string): LLMProviderConfig | null {
    const settings = this.getLLMSettings();
    
    // Check base providers first
    let config = settings.providers.find(p => p.instanceId === instanceId);
    if (config) return config;
    
    // Then check presets
    config = settings.presets.find(p => p.instanceId === instanceId);
    return config || null;
  }

  getActionsProviderInstanceId(): string | null {
    return this.getLLMSettings().actionsProviderInstanceId ?? null;
  }

  getSummaryProviderInstanceId(): string | null {
    return this.getLLMSettings().summaryProviderInstanceId ?? null;
  }

  /**
   * Get the provider config for Actions.
   * Returns the override if set, otherwise falls back to active provider.
   */
  getActionsProviderConfig(): LLMProviderConfig | null {
    const overrideId = this.getActionsProviderInstanceId();
    if (overrideId) {
      return this.getProviderConfigById(overrideId);
    }
    return this.getActiveProviderConfig();
  }

  /**
   * Get the provider config for Summaries.
   * Returns the override if set, otherwise falls back to active provider.
   */
  getSummaryProviderConfig(): LLMProviderConfig | null {
    const overrideId = this.getSummaryProviderInstanceId();
    if (overrideId) {
      return this.getProviderConfigById(overrideId);
    }
    return this.getActiveProviderConfig();
  }

  setActionsProviderInstanceId(instanceId: string | null): void {
    const settings = this.getLLMSettings();
    settings.actionsProviderInstanceId = instanceId;
    this.saveLLMSettings(settings);
    console.log('Actions provider override set:', instanceId);
  }

  setSummaryProviderInstanceId(instanceId: string | null): void {
    const settings = this.getLLMSettings();
    settings.summaryProviderInstanceId = instanceId;
    this.saveLLMSettings(settings);
    console.log('Summary provider override set:', instanceId);
  }

  // --- Summary Prompt Settings ---
  getDefaultRollingSummaryPrompt(): string {
    return 'Update the previous summary by incorporating the new messages. Create a cohesive summary that includes both the previous events and the new information. Keep it concise but preserve important details like character names, key events, decisions, and emotional moments. Please summarize the conversation into a single paragraph.';
  }

  getDefaultFinalSummaryPrompt(): string {
    return `Create a detailed summary of this conversation. Include:
- Key events and decisions made
- Important character interactions and relationship developments
- Plot developments and revelations
- Emotional moments and conflicts
- Any agreements, promises, or plans made
Please summarize the conversation into only a single paragraph.`;
  }

  getDefaultLetterSummaryPrompt(): string {
    return 'Summarize this one-on-one letter exchange succinctly. Focus on the key topics and tone.';
  }

  getSummaryPromptSettings(): SummaryPromptSettings {
    const stored = this.store.get('summaryPromptSettings', {
      rollingPrompt: '',
      finalPrompt: '',
      letterSummaryPrompt: ''
    });
    
    // Return stored custom prompts if set, otherwise return defaults
    return {
      rollingPrompt: stored.rollingPrompt || this.getDefaultRollingSummaryPrompt(),
      finalPrompt: stored.finalPrompt || this.getDefaultFinalSummaryPrompt(),
      letterSummaryPrompt: stored.letterSummaryPrompt || this.getDefaultLetterSummaryPrompt()
    };
  }

  saveSummaryPromptSettings(settings: SummaryPromptSettings): void {
    // Store the settings as-is (empty strings mean "use default")
    this.store.set('summaryPromptSettings', settings);
    console.log('Summary prompt settings saved:', settings);
  }
}

// Export a singleton instance
export const settingsRepository = new SettingsRepository();
