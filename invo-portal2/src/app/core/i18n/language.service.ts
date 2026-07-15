import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

export type Lang = string;

export interface LangMeta {
  code: Lang;
  /** English name (e.g. "French"). */
  label: string;
  /** Autonym — name in its own language (e.g. "Français", "العربية"). */
  nativeLabel: string;
}

const STORAGE_KEY = 'app_lang';
/** Right-to-left languages (base primary subtag). Drives dashboard `dir`. */
const RTL_LANGS = new Set(['ar', 'fa', 'ur', 'ps', 'sd', 'ug', 'dv', 'ku']);
/** Shown before the site's supported languages load (both always exist). */
const FALLBACK_LANGS: Lang[] = ['en', 'ar'];

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private translate = inject(TranslateService);
  private http      = inject(HttpClient);

  /**
   * Languages the dashboard offers in its switcher — the site's `supported`
   * set (see {@link setUiLanguages}). Any of them renders: its shipped
   * `public/i18n/<code>.json` bundle if present, otherwise English fallback
   * plus the DB UI-string overrides (which can be auto-translated on the
   * Multilingual page). Seeded with en/ar until `supported` loads.
   */
  private _available = signal<LangMeta[]>(FALLBACK_LANGS.map(c => this.metaFor(c)));
  get available(): LangMeta[] { return this._available(); }

  current = signal<Lang>(this.getSaved());
  isRtl   = computed(() => RTL_LANGS.has(this.current()));

  /** Local cache of merged translations per lang */
  private translationCache = new Map<string, Record<string, unknown>>();

  /** Tracks which feature namespaces have been loaded per lang */
  private loaded = new Map<string, Set<string>>();

  /**
   * Every dotted leaf key shipped in the static JSON (base + every loaded
   * feature), per lang. This is the authoritative "which keys exist" set:
   * DB overrides are only applied for keys present here, so a stale override
   * left over after a rename/restructure can never inject dead text — it is
   * simply ignored until pruned. Grows as features load; never includes
   * override-only keys.
   */
  private staticKeys = new Map<string, Set<string>>();

  /**
   * Raw DB-sourced UI overrides per lang, shaped flat `{ 'A.B.C': 'text' }`
   * — mirrors the inline `translation` attribute pattern used for entity
   * fields, but keyed by i18n key. Re-applied after each feature load so
   * lazily-loaded keys still pick up their override.
   */
  private overrides = new Map<string, Record<string, string>>();

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

  /**
   * Set the dashboard's offered languages to the site's supported set
   * (called once the tenant/settings are known). English is always kept.
   * Labels are derived, so no per-language code change is needed.
   */
  setUiLanguages(codes: string[]): void {
    const list = Array.from(new Set(['en', ...codes.filter(Boolean).map(String)]));
    const metas = list.map(c => this.metaFor(c));
    this._available.set(metas);
    this.translate.addLangs(metas.map(m => m.code));
  }

  private metaFor(code: Lang): LangMeta {
    return {
      code,
      label: this.displayName(code, 'en'),
      nativeLabel: this.displayName(code, code),
    };
  }

  /** Language `code`'s name written in `inLocale` (autonym when they match). */
  private displayName(code: Lang, inLocale: string): string {
    try {
      const name = new Intl.DisplayNames([inLocale], { type: 'language' }).of(code);
      if (name && name.toLowerCase() !== code.toLowerCase()) {
        return name.charAt(0).toLocaleUpperCase(inLocale) + name.slice(1);
      }
    } catch { /* Intl.DisplayNames unsupported for this code */ }
    return code.toUpperCase();
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
    // Static keys + feature JSON are back in place for the new lang — layer
    // this lang's DB overrides on top of them.
    this.applyOverrides(lang);
  }

  async loadFeature(feature: string): Promise<void> {
    await this.baseLoaded;
    await this.load(feature, this.current());
  }

  instant(key: string, params?: object): string {
    return this.translate.instant(key, params);
  }

  // ─── DB overrides (runtime, per-tenant) ──────────────────────────────────────

  /**
   * Layer DB-sourced UI overrides for `lang` on top of the static JSON.
   * Shape is flat, keyed by i18n key: `{ 'TRANSLATIONS.TITLE': 'My title' }`
   * — the UI-string analogue of an entity row's `translation` attribute.
   *
   * Merges (does not replace) with any overrides already set for the lang,
   * so callers can push incrementally. Only keys that exist in the shipped
   * JSON are applied — see {@link staticKeys}. Call this after the app's
   * base translations have loaded (e.g. once the tenant is known).
   */
  setOverrides(lang: Lang, overrides: Record<string, string>): void {
    const merged = { ...(this.overrides.get(lang) ?? {}), ...overrides };
    this.overrides.set(lang, merged);
    this.applyOverrides(lang);
  }

  /**
   * Replace (not merge) this lang's overrides with `overrides` and re-render
   * the live app immediately — no page refresh. Used after an editor save so
   * both new values AND cleared ones take effect: when `lang` is the active
   * language we reload its base + feature JSON (so a removed override reverts
   * to its shipped default) then re-layer the current overrides on top.
   */
  async replaceOverrides(lang: Lang, overrides: Record<string, string>): Promise<void> {
    this.overrides.set(lang, { ...overrides });
    if (lang !== this.current()) {
      // Not on screen — additive apply is enough; nothing to visibly revert.
      this.applyOverrides(lang);
      return;
    }
    // Rebuild the active lang so a removed override reverts to its default.
    // ngx-translate caches the base, so re-fetch the file ourselves and
    // hard-replace, then re-merge each loaded feature and re-layer overrides.
    try {
      const base = await firstValueFrom(
        this.http.get<Record<string, unknown>>(`i18n/${lang}.json`),
      );
      this.translationCache.delete(lang);
      this.registerStaticKeys(lang, base ?? {});
      this.translate.setTranslation(lang, (base ?? {}) as any, false);
      for (const ns of this.allLoadedNamespaces()) {
        await this.load(ns, lang, true);
      }
    } catch {
      // Network hiccup — fall back to an additive apply (cleared overrides
      // then revert on the next full refresh rather than immediately).
    }
    this.applyOverrides(lang);
  }

  /**
   * Override keys that no longer exist in the shipped JSON for `lang` —
   * i.e. orphans left behind by a rename/restructure. Best-effort: a key is
   * only certainly an orphan once every feature that could define it has
   * loaded, so treat this as the prune candidate set to reconcile against
   * the full static keyset (build-time / backend), not a hard delete list.
   */
  orphanOverrideKeys(lang: Lang): string[] {
    const known = this.staticKeys.get(lang);
    const ov = this.overrides.get(lang);
    if (!ov) return [];
    return Object.keys(ov).filter(k => !known?.has(k));
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async load(feature: string, lang: Lang, force = false): Promise<void> {
    if (!force && this.loaded.get(lang)?.has(feature)) return;

    // Always keep the English copy of the feature loaded as fallback content.
    // A language with no shipped bundle (e.g. merchant-added `fr`) then shows
    // English for any key it hasn't overridden — never the raw i18n key.
    // Never FORCE the English reload though: once it's loaded it never changes,
    // so switching en → fr must not re-fetch every `en.json` again.
    if (lang !== 'en') {
      await this.load(feature, 'en', false);
    }

    // No shipped bundle for this language → don't fetch `<feature>/<lang>.json`
    // (it would 404). It renders from the English fallback + DB overrides.
    if (!this.hasBundle(lang)) {
      if (!this.loaded.has(lang)) this.loaded.set(lang, new Set());
      this.loaded.get(lang)!.add(feature);
      this.applyOverrides(lang);
      return;
    }

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

      // Record this feature's leaf keys as valid override targets.
      this.registerStaticKeys(lang, incoming ?? {});

      // Merge into local cache
      const existing = this.translationCache.get(lang) ?? {};
      const merged   = this.deepMerge(existing, incoming);
      this.translationCache.set(lang, merged);

      // Push to TranslateService — true = merge with existing translations.
      this.translate.setTranslation(lang, merged as any, true);

      // A lazily-loaded feature may be the target of an existing override —
      // re-apply so those keys pick it up now that they exist.
      this.applyOverrides(lang);

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

  /** Add every dotted leaf key of `tree` to the static keyset for `lang`. */
  private registerStaticKeys(lang: Lang, tree: Record<string, unknown>): void {
    const set = this.staticKeys.get(lang) ?? new Set<string>();
    this.collectLeafKeys(tree, '', set);
    this.staticKeys.set(lang, set);
  }

  private collectLeafKeys(
    node: Record<string, unknown>,
    prefix: string,
    out: Set<string>,
  ): void {
    for (const key of Object.keys(node)) {
      const value = node[key];
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.collectLeafKeys(value as Record<string, unknown>, path, out);
      } else {
        out.add(path);
      }
    }
  }

  /**
   * Merge this lang's DB overrides into the translation set. Applied
   * unconditionally: an override for a key that no longer exists in the
   * shipped JSON is harmless — no component reads it, so it never renders —
   * whereas gating on a keyset snapshot is racy (the snapshot can be empty
   * when overrides arrive first) and silently drops valid overrides. Stale
   * keys are surfaced via {@link orphanOverrideKeys} for pruning instead.
   * Idempotent; re-run after every base/feature (re)load so the override
   * survives ngx-translate replacing the base translations.
   */
  private applyOverrides(lang: Lang): void {
    const ov = this.overrides.get(lang);
    if (!ov || Object.keys(ov).length === 0) return;

    const nested = this.nest(ov);
    const existing = this.translationCache.get(lang) ?? {};
    const merged = this.deepMerge(existing, nested);
    this.translationCache.set(lang, merged);
    this.translate.setTranslation(lang, merged as any, true);
    console.info(`[i18n] applied ${Object.keys(ov).length} DB override(s) for "${lang}"`);
  }

  /** Expand a flat dotted map (`{ 'A.B': 'x' }`) into a nested object. */
  private nest(flat: Record<string, string>): Record<string, unknown> {
    const root: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(flat)) {
      const parts = key.split('.');
      let cur = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
        cur = cur[p] as Record<string, unknown>;
      }
      cur[parts[parts.length - 1]] = value;
    }
    return root;
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
          // Base file has landed — snapshot its keys as valid override
          // targets before any DB overrides are layered on.
          const base = (this.translate as any).translations?.[lang] ?? {};
          this.registerStaticKeys(lang, base);
          this.applyOverrides(lang);
          sub.unsubscribe();
          resolve();
        }
      });
      // No shipped bundle → seed an empty base so ngx-translate treats the
      // language as "loaded" and DOESN'T fetch `<lang>.json` (which 404s).
      // Every key then falls back to the default language (English) + any DB
      // overrides applied above.
      if (!this.hasBundle(lang)) {
        this.translate.setTranslation(lang, {}, false);
      }
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

  /** True when this language ships a static `public/i18n/<lang>.json` bundle
   *  (and feature files). Others render from English + DB overrides only, so
   *  we never fetch their JSON. */
  private hasBundle(lang: Lang): boolean {
    return FALLBACK_LANGS.includes(lang.split('-')[0]);
  }

  private getSaved(): Lang {
    return localStorage.getItem(STORAGE_KEY) ?? 'en';
  }
}
