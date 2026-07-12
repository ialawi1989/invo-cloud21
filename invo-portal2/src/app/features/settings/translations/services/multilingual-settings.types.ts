/**
 * Company-wide multilingual settings (Wix "General Settings").
 *
 * Persisted once per company and consumed by BOTH apps:
 *  • the dashboard General Settings page edits them, and
 *  • the storefront reads them to decide the initial language + URL shape.
 */
export type UrlStructure = 'subdirectory' | 'subdomain' | 'parameter';

export interface MultilingualSettings {
  /** Auto-redirect first-time visitors to their browser language when supported. */
  autoSwitch: boolean;
  /** Language a visitor sees first when they arrive (may differ from the original). */
  defaultLanguage: string;
  /** How the language is encoded in the URL on the live site. */
  urlStructure: UrlStructure;
  /** Language codes rendered right-to-left (per-language direction). The
   *  storefront's `dir`/RTL styling is driven by this list. */
  rtlLanguages: string[];
  /** The site's languages (the single source of truth also drives the default
   *  + direction pickers). Read-only here — added/removed on the landing. */
  supported: string[];
}

/** Languages that default to RTL when the user hasn't set a direction. */
export const DEFAULT_RTL_LANGUAGES = ['ar', 'fa', 'ur', 'ps', 'sd', 'ug', 'dv'];

/** Safe defaults when nothing is saved yet. */
export const DEFAULT_MULTILINGUAL_SETTINGS: MultilingualSettings = {
  autoSwitch: false,
  defaultLanguage: 'en',
  urlStructure: 'subdirectory',
  rtlLanguages: ['ar'],
  supported: ['en', 'ar'],
};

/** Whether a language code is RTL by convention (used to seed a new language's
 *  direction before the user overrides it). */
export function isRtlByDefault(code: string): boolean {
  return DEFAULT_RTL_LANGUAGES.includes(code.toLowerCase().split('-')[0]);
}
