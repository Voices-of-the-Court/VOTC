/**
 * Centralized provider configuration constants.
 * This is the single source of truth for all provider-related constants.
 * When adding a new provider, update only this file.
 */

// List of all base provider types
// When adding a new provider, add it to this array
export const PROVIDER_TYPES = ['player2', 'openrouter', 'openai-compatible', 'ollama'] as const;

// Type for provider types (derived from PROVIDER_TYPES)
export type ProviderType = (typeof PROVIDER_TYPES)[number];

// Provider-specific default base URLs
export const DEFAULT_BASE_URLS: Record<ProviderType, string> = {
  openrouter: '',
  'openai-compatible': '',
  ollama: 'http://localhost:11434',
  player2: 'http://localhost:4315/v1',
};

// Default provider to use when no active provider is set
export const DEFAULT_ACTIVE_PROVIDER: ProviderType = 'player2';

// Default parameters for all providers
export const DEFAULT_PARAMETERS = {
  temperature: 0.7,
  max_tokens: 2048,
};

// Helper function to check if a provider type is valid
export function isValidProviderType(type: string): type is ProviderType {
  return PROVIDER_TYPES.includes(type as ProviderType);
}

// Helper function to get default base URL for a provider type
export function getDefaultBaseUrl(providerType: ProviderType): string {
  return DEFAULT_BASE_URLS[providerType];
}