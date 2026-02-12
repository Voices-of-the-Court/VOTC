import type { I18nString } from './types';

/**
 * Resolve an I18nString to a specific language, with fallback to English
 * @param value - The I18nString to resolve (string or object with language codes)
 * @param lang - The language code to resolve to (e.g., 'en', 'ru', 'fr')
 * @returns The resolved string in the requested language, or English fallback
 */
export function resolveI18nString(value: I18nString, lang?: string): string {
  // If it's already a plain string, return it
  if (typeof value === 'string') {
    return value;
  }

  // If it's an object with language codes
  if (typeof value === 'object' && value !== null) {
    // Try to get the requested language
    if (lang && value[lang]) {
      return value[lang];
    }

    // Fallback to English
    if (value['en']) {
      return value['en'];
    }

    // If no English, return the first available language
    const keys = Object.keys(value);
    if (keys.length > 0) {
      return value[keys[0]];
    }
  }

  // Ultimate fallback
  return '';
}

/**
 * Check if an I18nString has a translation for a specific language
 * @param value - The I18nString to check
 * @param lang - The language code to check for
 * @returns True if the language is available
 */
export function hasI18nLanguage(value: I18nString, lang: string): boolean {
  if (typeof value === 'string') {
    return true; // Plain strings are considered available in all languages
  }

  if (typeof value === 'object' && value !== null) {
    return lang in value;
  }

  return false;
}
