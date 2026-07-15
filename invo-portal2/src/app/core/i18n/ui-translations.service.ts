import { Injectable, effect, inject, untracked } from '@angular/core';
import { ApiService } from '@core/http';
import { CompanyService } from '@core/auth/company.service';
import { LanguageService } from './language.service';

/**
 * Loads the tenant's per-company UI-string overrides and layers them over
 * the shipped static JSON via {@link LanguageService.setOverrides}.
 *
 * Backend stores them inside the theme settings (the ThemeSettings row's
 * `template.uiTranslation`), shaped `{ "<i18n.key>": { "en": "...", "ar": "..." } }`
 * — the UI-string analogue of an entity's `translation` attribute. We fetch that map once the company
 * is known (and again whenever the tenant switches), flatten it per language,
 * and hand it to LanguageService, which only applies keys that still exist in
 * the JSON (stale keys are ignored). Static defaults remain the fallback.
 *
 * Instantiated eagerly at bootstrap (see app.config) so its effect is live.
 */
@Injectable({ providedIn: 'root' })
export class UiTranslationsService {
  private api      = inject(ApiService);
  private company  = inject(CompanyService);
  private lang     = inject(LanguageService);

  /** Company ids we've already loaded, so the effect doesn't refetch on
   *  unrelated company-signal writes. */
  private loadedFor = new Set<string>();

  constructor() {
    effect(() => {
      const id = this.company.currentCompany()?.id;
      if (!id || this.loadedFor.has(String(id))) return;
      this.loadedFor.add(String(id));
      // Read/apply outside the reactive context — we only want to react to
      // the company id, not to anything touched during the fetch.
      untracked(() => void this.load());
    });
  }

  /** Expand the offered languages to the site's supported set, then apply
   *  the tenant's UI-string overrides for each of them. */
  async load(): Promise<void> {
    await this.loadSupportedLanguages();
    await this.loadOverrides();
  }

  /** Read the site's `supported` languages and offer them in the dashboard
   *  switcher — merchants can render any of them (English fallback + their
   *  DB overrides), even without a shipped bundle. */
  private async loadSupportedLanguages(): Promise<void> {
    try {
      const res = await this.api.request<any>(
        this.api.post('company/getThemeByType', { type: 'BlogSettings' }),
      );
      const supported = res?.data?.list?.[0]?.template?.languages?.supported;
      if (Array.isArray(supported) && supported.length) {
        this.lang.setUiLanguages(supported.map(String));
      }
    } catch {
      // Keep the en/ar default on failure.
    }
  }

  private async loadOverrides(): Promise<void> {
    try {
      const res = await this.api.request<any>(
        this.api.post('translations/getUiTranslations', {}),
      );
      const map = res?.data?.translations ?? {};
      // `available` now includes every supported language, so overrides for
      // merchant-added languages get applied too.
      for (const l of this.lang.available) {
        this.lang.setOverrides(l.code, this.flattenForLang(map, l.code));
      }
    } catch {
      // Overrides are best-effort — a failure just leaves the static
      // defaults in place, so swallow and carry on.
    }
  }

  /** `{ key: { lang: text } }` → `{ key: text }` for a single language. */
  private flattenForLang(
    map: Record<string, Record<string, string>>,
    lang: string,
  ): Record<string, string> {
    const flat: Record<string, string> = {};
    for (const key of Object.keys(map ?? {})) {
      const value = map[key]?.[lang];
      if (typeof value === 'string' && value.trim() !== '') flat[key] = value;
    }
    return flat;
  }
}
