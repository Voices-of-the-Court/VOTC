/**
 * Single source of truth for the languages the app supports.
 *
 * Consumed by:
 *   - {@link LanguageSelector} (UI list)
 *   - {@link ../utils/promptFileGroups} (locale suffix parsing)
 *   - prompt-locale reconciliation / notifications
 *
 * If you add or remove a language here, every consumer updates automatically.
 */

export interface SupportedLanguage {
  /** Lowercase ISO-ish code, e.g. 'en'. */
  code: string;
  /** English name, e.g. 'English'. */
  name: string;
  /** Native name, e.g. 'English', 'Русский'. */
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
];

/** Set of supported codes (lowercase) — mirrors {@link SUPPORTED_LANGUAGES}. */
export const KNOWN_LOCALES: ReadonlySet<string> = new Set(
  SUPPORTED_LANGUAGES.map((l) => l.code),
);

/** Map of lowercase code -> native name. */
export const LOCALE_NAMES: Record<string, string> = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((l) => [l.code, l.nativeName]),
);

/** Human-readable name for a code, falling back to the uppercased code. */
export function localeDisplayName(code: string): string {
  return LOCALE_NAMES[code] ?? code.toUpperCase();
}
