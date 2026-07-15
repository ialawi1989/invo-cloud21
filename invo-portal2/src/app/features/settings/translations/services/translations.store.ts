import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

import { TranslationItemRef } from './translation-api';

/**
 * Feature-scoped state shared between the persistent shell (header +
 * toolbar) and the active group grid. Provided at the `translations`
 * route so it is a single instance for the whole manager, torn down when
 * the user leaves the feature.
 *
 * The shell owns the target language and fires toolbar actions; the grid
 * publishes its item list + progress back up so the header/toolbar can
 * render them without knowing about the grid's data.
 */

export interface TranslationLang {
  code: string;
  label: string;
  nativeLabel: string;
}

export type TranslationAction = 'export' | 'import' | 'auto-translate' | 'reset-all';

/** The source language all translations are based on. */
export const ORIGINAL_LANG = 'en';

/**
 * Placeholder set of target languages. Swap for a company-languages
 * endpoint when available — the shell only depends on `languages()`.
 * English is the source, so it is not offered as a target.
 */
const DEFAULT_LANGS: TranslationLang[] = [
  // RTL languages
  { code: 'ar', label: 'Arabic',      nativeLabel: 'العربية' },
  { code: 'fa', label: 'Persian',     nativeLabel: 'فارسی' },
  { code: 'ur', label: 'Urdu',        nativeLabel: 'اردو' },
  // LTR languages
  { code: 'fr', label: 'French',      nativeLabel: 'Français' },
  { code: 'es', label: 'Spanish',     nativeLabel: 'Español' },
  { code: 'de', label: 'German',      nativeLabel: 'Deutsch' },
  { code: 'it', label: 'Italian',     nativeLabel: 'Italiano' },
  { code: 'pt', label: 'Portuguese',  nativeLabel: 'Português' },
  { code: 'nl', label: 'Dutch',       nativeLabel: 'Nederlands' },
  { code: 'tr', label: 'Turkish',     nativeLabel: 'Türkçe' },
  { code: 'ru', label: 'Russian',     nativeLabel: 'Русский' },
  { code: 'zh', label: 'Chinese',     nativeLabel: '中文' },
  { code: 'ja', label: 'Japanese',    nativeLabel: '日本語' },
  { code: 'ko', label: 'Korean',      nativeLabel: '한국어' },
  { code: 'hi', label: 'Hindi',       nativeLabel: 'हिन्दी' },
  { code: 'id', label: 'Indonesian',  nativeLabel: 'Bahasa Indonesia' },
  { code: 'pl', label: 'Polish',      nativeLabel: 'Polski' },
  { code: 'sv', label: 'Swedish',     nativeLabel: 'Svenska' },
  { code: 'uk', label: 'Ukrainian',   nativeLabel: 'Українська' },
];

@Injectable()
export class TranslationsStore {
  /** Full catalogue of languages that can be added as translation targets. */
  readonly languages = signal<TranslationLang[]>(DEFAULT_LANGS);

  /**
   * Languages the site is translated into (the "additional languages" on the
   * landing page). Persisted in-session only until a company-languages
   * backend exists. English is the source and never appears here.
   */
  readonly additionalLanguages = signal<string[]>(['ar']);

  /** Currently selected target language code (the editor's `:lang`). */
  readonly targetLang = signal<string>(DEFAULT_LANGS[0].code);

  /** Whole-entity word progress for the active group. */
  readonly progress = signal<{ translated: number; total: number }>({ translated: 0, total: 0 });

  /** Records of the active group, for the "All items" toolbar filter. */
  readonly items = signal<TranslationItemRef[]>([]);

  /** True when the active grid has unsaved edits. */
  readonly dirty = signal<boolean>(false);

  /** True while the active grid is loading (disables toolbar actions). */
  readonly busy = signal<boolean>(false);

  /** True once Content AI is linked (enabled + keyed) — gates every
   *  auto-translate affordance. Set by the shell. */
  readonly aiAvailable = signal<boolean>(false);

  /** True only for the fixed-size UI-strings entity, where "translate
   *  everything" is bounded. Other entities (products, …) can hold thousands
   *  of rows, so they offer "auto-translate selected" instead. Set by the grid. */
  readonly canAutoTranslateAll = signal<boolean>(false);

  /** Toolbar action bus — shell fires, active grid handles. */
  private readonly action = new Subject<TranslationAction>();
  readonly action$ = this.action.asObservable();

  emit(action: TranslationAction): void {
    this.action.next(action);
  }

  setTargetLang(code: string): void {
    this.targetLang.set(code);
  }

  addLanguage(code: string): void {
    if (code === ORIGINAL_LANG) return;
    this.additionalLanguages.update(list => (list.includes(code) ? list : [...list, code]));
  }

  removeLanguage(code: string): void {
    this.additionalLanguages.update(list => list.filter(c => c !== code));
  }

  /** Replace the additional-language list — e.g. seeded from the backend
   *  `supported` set on load. English is the source and never included. */
  setAdditionalLanguages(codes: string[]): void {
    const unique = Array.from(new Set(codes.filter(c => c && c !== ORIGINAL_LANG)));
    this.additionalLanguages.set(unique);
  }

  /** Languages that can still be added (catalogue minus source minus added). */
  languagesToAdd(): TranslationLang[] {
    const added = new Set(this.additionalLanguages());
    return this.languages().filter(l => l.code !== ORIGINAL_LANG && !added.has(l.code));
  }

  lang(code: string): TranslationLang | undefined {
    return this.languages().find(x => x.code === code);
  }

  langLabel(code: string): string {
    return this.lang(code)?.nativeLabel ?? code;
  }
}
