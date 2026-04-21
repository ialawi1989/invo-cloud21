import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

export type Lang = string;

const STORAGE_KEY = 'app_lang';
const RTL_LANGS   = new Set(['ar']);

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private translate = inject(TranslateService);
  private http      = inject(HttpClient);

  readonly available: { code: Lang; label: string; nativeLabel: string }[] = [
    { code: 'en', label: 'English', nativeLabel: 'English' },
    { code: 'ar', label: 'Arabic',  nativeLabel: 'العربية' },
  ];

  current = signal<Lang>(this.getSaved());
  isRtl   = computed(() => RTL_LANGS.has(this.current()));

  /** Local cache of merged translations per lang */
  private translationCache = new Map<string, Record<string, unknown>>();

  /** Tracks which feature namespaces have been loaded per lang */
  private loaded = new Map<string, Set<string>>();

  /** Promise that resolves when the base `i18n/<lang>.json` is loaded.
   *  Feature loads wait for this — otherwise ngx-translate's `use(lang)`
   *  fetch would land AFTER feature translations and overwrite them
   *  (default `setTranslation` replaces; it does not merge). */
  private baseLoaded!: Promise<void>;

  constructor() {
    this.translate.addLangs(this.available.map(l => l.code));
    this.translate.setDefaultLang('en');
    this.apply(this.current());
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async use(lang: Lang): Promise<void> {
    this.current.set(lang);
    this.apply(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    // Reload all previously loaded feature namespaces for the new lang —
    // wait for the base load to finish first so the feature JSON isn't
    // overwritten when ngx-translate's loader returns.
    await this.baseLoaded;
    await Promise.all(this.allLoadedNamespaces().map(ns => this.load(ns, lang, true)));
  }

  async loadFeature(feature: string): Promise<void> {
    await this.baseLoaded;
    await this.load(feature, this.current());
  }

  instant(key: string, params?: object): string {
    return this.translate.instant(key, params);
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async load(feature: string, lang: Lang, force = false): Promise<void> {
    if (!force && this.loaded.get(lang)?.has(feature)) return;

    const url = `i18n/features/${feature}/i18n/${lang}.json`;
    const t0 = performance.now();
    console.info(`[i18n] → loading feature "${feature}" for "${lang}" (${url})`);
    try {
      const incoming = await firstValueFrom(
        this.http.get<Record<string, unknown>>(url)
      );
      const incomingKeys = Object.keys(incoming ?? {});
      console.info(
        `[i18n] ← fetched "${feature}" (${(performance.now() - t0).toFixed(0)}ms) — top-level keys:`,
        incomingKeys,
      );

      // Merge into local cache
      const existing = this.translationCache.get(lang) ?? {};
      const merged   = this.deepMerge(existing, incoming);
      this.translationCache.set(lang, merged);

      // Push to TranslateService — true = merge with existing translations.
      this.translate.setTranslation(lang, merged as any, true);

      // Verify the merge stuck (helps catch race where base overwrites).
      const stored = (this.translate as any).translations?.[lang] ?? {};
      const storedKeys = Object.keys(stored);
      console.info(`[i18n] ✓ merged "${feature}"; translations[${lang}] top-level keys now:`, storedKeys);
    } catch (err) {
      console.warn(`[i18n] ✗ failed to load "${url}":`, err);
    }

    if (!this.loaded.has(lang)) this.loaded.set(lang, new Set());
    this.loaded.get(lang)!.add(feature);
  }

  private deepMerge(
    base: Record<string, unknown>,
    override: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...base };
    for (const key of Object.keys(override)) {
      const bv = base[key];
      const ov = override[key];
      if (ov && typeof ov === 'object' && !Array.isArray(ov) &&
          bv && typeof bv === 'object') {
        result[key] = this.deepMerge(
          bv as Record<string, unknown>,
          ov as Record<string, unknown>,
        );
      } else {
        result[key] = ov;
      }
    }
    return result;
  }

  private allLoadedNamespaces(): string[] {
    const all = new Set<string>();
    this.loaded.forEach(set => set.forEach(ns => all.add(ns)));
    return [...all];
  }

  private apply(lang: Lang): void {
    // Kick off the base fetch via ngx-translate's loader and expose a
    // promise that resolves once it lands, so `loadFeature()` can hold
    // until then.
    console.info(`[i18n] apply(${lang}) — triggering base load…`);
    this.baseLoaded = new Promise<void>((resolve) => {
      const sub = this.translate.onLangChange.subscribe((e) => {
        console.info(`[i18n] onLangChange fired for "${e.lang}"`);
        if (e.lang === lang) {
          sub.unsubscribe();
          resolve();
        }
      });
      this.translate.use(lang).subscribe({
        next: () => console.info(`[i18n] use("${lang}") observable emitted`),
        error: (err) => console.warn(`[i18n] use("${lang}") error:`, err),
      });
    });

    const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', dir);
    document.body.setAttribute('dir', dir);
  }

  private getSaved(): Lang {
    return localStorage.getItem(STORAGE_KEY) ?? 'en';
  }
}
