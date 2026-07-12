import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import {
  DEFAULT_MULTILINGUAL_SETTINGS,
  MultilingualSettings,
} from './multilingual-settings.types';

/**
 * Reads / writes the company-wide multilingual settings.
 *
 * There is ONE source of truth for the site's language config — the site
 * settings' `languages` object (`type: 'BlogSettings'`, historically named but
 * used site-wide): the Blog Settings page, the post composer, taxonomies, and
 * the storefront all read it. This service edits the SAME object so nothing is
 * duplicated:
 *   • `defaultLanguage` ⇄ `languages.default`
 *   • `autoSwitch`      ⇄ `languages.autoSwitch`
 *   • `urlStructure`    ⇄ `languages.urlStructure`
 *   • `rtlLanguages`    ⇄ `languages.rtlLanguages`
 *   • `supported`       ⇄ `languages.supported` (read-only here)
 *
 * Save is load-modify-save so `supported` and every other blog setting are
 * preserved untouched.
 */
@Injectable({ providedIn: 'root' })
export class MultilingualSettingsService {
  private api = inject(ApiService);
  private readonly TYPE = 'BlogSettings';

  private async loadRow(): Promise<any | null> {
    const res = await this.api.request<any>(this.api.post('company/getThemeByType', { type: this.TYPE }));
    return res?.data?.list?.[0] ?? null;
  }

  async get(): Promise<MultilingualSettings> {
    try {
      const langs = (await this.loadRow())?.template?.languages ?? {};
      return {
        autoSwitch: !!langs.autoSwitch,
        defaultLanguage: langs.default || DEFAULT_MULTILINGUAL_SETTINGS.defaultLanguage,
        urlStructure: langs.urlStructure || DEFAULT_MULTILINGUAL_SETTINGS.urlStructure,
        rtlLanguages: Array.isArray(langs.rtlLanguages)
          ? langs.rtlLanguages.map(String)
          : [...DEFAULT_MULTILINGUAL_SETTINGS.rtlLanguages],
        supported: Array.isArray(langs.supported) && langs.supported.length
          ? langs.supported.map(String)
          : [...DEFAULT_MULTILINGUAL_SETTINGS.supported],
      };
    } catch {
      return {
        ...DEFAULT_MULTILINGUAL_SETTINGS,
        rtlLanguages: [...DEFAULT_MULTILINGUAL_SETTINGS.rtlLanguages],
        supported: [...DEFAULT_MULTILINGUAL_SETTINGS.supported],
      };
    }
  }

  async save(settings: MultilingualSettings): Promise<void> {
    // Load-modify-save so `supported` + the rest of the site settings survive.
    const row = (await this.loadRow()) ?? {};
    const template = row.template ?? {};
    const languages = {
      ...(template.languages ?? {}),
      default: settings.defaultLanguage,
      autoSwitch: settings.autoSwitch,
      urlStructure: settings.urlStructure,
      rtlLanguages: settings.rtlLanguages,
    };
    const payload = { ...row, type: this.TYPE, template: { ...template, languages } };

    const res = await this.api.request<any>(this.api.post('company/saveWebsiteTheme', payload));
    if (res?.success === false) {
      throw new Error(res?.msg || res?.message || 'Failed to save multilingual settings');
    }
  }
}
