import { ILLMProvider, ProviderType, LLMProviderConfig } from './types';

export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<ProviderType, new () => ILLMProvider> = new Map();

  private constructor() {}

  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  /**
   * Register a provider class with the registry
   * @param providerType The provider type identifier
   * @param providerClass The provider class constructor
   */
  register(providerType: ProviderType, providerClass: new () => ILLMProvider): void {
    if (this.providers.has(providerType)) {
      console.warn(`Provider type '${providerType}' is already registered. Overwriting.`);
    }
    this.providers.set(providerType, providerClass);
    console.log(`Provider '${providerType}' registered successfully.`);
  }

  /**
   * Create a provider instance for the given configuration
   * @param config The provider configuration
   * @returns An instance of the appropriate provider
   * @throws Error if provider type is not registered
   */
  createProvider(config: LLMProviderConfig): ILLMProvider {
    const providerClass = this.providers.get(config.providerType);
    if (!providerClass) {
      const availableTypes = Array.from(this.providers.keys()).join(', ');
      throw new Error(
        `Provider type '${config.providerType}' is not registered. Available types: ${availableTypes}`
      );
    }

    try {
      const provider = new providerClass();
      return provider;
    } catch (error) {
      throw new Error(`Failed to instantiate provider '${config.providerType}': ${error}`);
    }
  }

  /**
   * Get all registered provider types
   * @returns Array of registered provider types
   */
  getRegisteredTypes(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider type is registered
   * @param providerType The provider type to check
   * @returns True if registered, false otherwise
   */
  isRegistered(providerType: ProviderType): boolean {
    return this.providers.has(providerType);
  }
}

// Export singleton instance
export const providerRegistry = ProviderRegistry.getInstance();