import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '@core/http';
import { LanguageService } from '@core/i18n/language.service';

import { findTranslationEntity } from '../translations.config';
import {
  TranslationChange,
  TranslationDataSource,
  TranslationListResult,
  TranslationQuery,
  TranslationRow,
  countWords,
  statusFromTarget,
} from './translation-api';

/**
 * Data source for the "Site text" entity — the app's own UI strings.
 *
 * Unlike the API-backed entities (whose source text is a DB column), the
 * *source* here is the shipped static i18n JSON: we fetch the configured
 * English namespace(s), flatten to dotted keys, and each key becomes a row.
 * The *target* is the per-tenant override stored in the theme settings
 * (`template.uiTranslation`), read/written through the generic UI-translation
 * endpoints. Saving also layers the change onto the live app via
 * {@link LanguageService.setOverrides} so the edit is visible immediately.
 *
 * A row's `recordId` is the key's parent path and `field` its leaf segment,
 * so the full i18n key is `recordId + '.' + field` — this keeps the "All
 * items" filter grouped by section instead of listing every key.
 */
@Injectable({ providedIn: 'root' })
export class UiTextTranslationService implements TranslationDataSource {
  private http = inject(HttpClient);
  private api  = inject(ApiService);
  private lang = inject(LanguageService);

  /** Cache of flattened English source maps per namespace list (joined). */
  private sourceCache = new Map<string, Record<string, string>>();

  async getTranslations(
    entityId: string,
    lang: string,
    query: TranslationQuery,
  ): Promise<TranslationListResult> {
    const source = await this.sourceMap(entityId);
    const overrides = await this.fetchOverrides();

    const search = (query.search ?? '').trim().toLowerCase();
    const allKeys = Object.keys(source).sort((a, b) => a.localeCompare(b));

    // Build the full (unfiltered) row set once — needed for word totals and
    // the item list — then apply filters/paging over it.
    const all: TranslationRow[] = allKeys.map(key => {
      const { parent, leaf } = this.split(key);
      const target = overrides[key]?.[lang] ?? '';
      return {
        id: `${parent}:${leaf}`,
        recordId: parent,
        recordLabel: parent || '•',
        field: leaf,
        fieldLabel: leaf,
        source: source[key] ?? '',
        target,
        status: statusFromTarget(target),
      };
    });

    // Item list (distinct sections) from the unfiltered set.
    const seen = new Set<string>();
    const items = all
      .filter(r => (seen.has(r.recordId) ? false : (seen.add(r.recordId), true)))
      .map(r => ({ id: r.recordId, label: r.recordLabel }));

    // Whole-entity progress in source words.
    let translatedWords = 0;
    let totalWords = 0;
    for (const r of all) {
      const w = countWords(r.source);
      totalWords += w;
      if (r.status === 'translated') translatedWords += w;
    }

    const filtered = all.filter(r => {
      if (query.item && r.recordId !== query.item) return false;
      if (query.status !== 'all' && r.status !== query.status) return false;
      if (search) {
        const hay = `${r.id} ${r.source} ${r.target}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    const total = filtered.length;
    const pageCount = total > 0 ? Math.ceil(total / query.limit) : 1;
    const start = (query.page - 1) * query.limit;
    const rows = filtered.slice(start, start + query.limit);

    return {
      rows,
      total,
      pageCount,
      items,
      words: { translated: translatedWords, total: totalWords },
    };
  }

  async saveTranslations(
    entityId: string,
    lang: string,
    changes: TranslationChange[],
  ): Promise<{ success: boolean; msg?: string }> {
    const payload = changes.map(c => ({
      key: this.join(c.recordId, c.field),
      lang,
      value: c.target,
    }));

    const res = await this.api.request<any>(
      this.api.post('translations/saveUiTranslations', { changes: payload }),
    );
    const ok = !!res?.success;

    if (ok) {
      // Reflect the saved state on the live app immediately (no refresh).
      // The backend echoes the full, post-save override map, so we replace
      // this lang's overrides with it — new values apply and cleared ones
      // revert to their shipped default.
      const fullMap = res?.data?.translations ?? {};
      await this.lang.replaceOverrides(lang, this.flattenForLang(fullMap, lang));
    }

    return { success: ok, msg: res?.msg };
  }

  // ─── Source (static JSON) ─────────────────────────────────────────────
  /** Flattened English source map for the entity's configured namespaces. */
  private async sourceMap(entityId: string): Promise<Record<string, string>> {
    const namespaces = findTranslationEntity(entityId)?.uiNamespaces ?? [''];
    const cacheKey = namespaces.join('|');
    const cached = this.sourceCache.get(cacheKey);
    if (cached) return cached;

    const map: Record<string, string> = {};
    for (const ns of namespaces) {
      try {
        const json = await firstValueFrom(
          this.http.get<Record<string, unknown>>(this.urlFor(ns)),
        );
        this.flatten(json ?? {}, '', map);
      } catch {
        // Missing namespace file → contributes no keys.
      }
    }
    this.sourceCache.set(cacheKey, map);
    return map;
  }

  private urlFor(ns: string): string {
    return ns ? `i18n/features/${ns}/i18n/en.json` : `i18n/en.json`;
  }

  private flatten(node: Record<string, unknown>, prefix: string, out: Record<string, string>): void {
    for (const key of Object.keys(node)) {
      const value = node[key];
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.flatten(value as Record<string, unknown>, path, out);
      } else if (typeof value === 'string') {
        out[path] = value;
      }
    }
  }

  // ─── Target (DB overrides) ────────────────────────────────────────────
  private async fetchOverrides(): Promise<Record<string, Record<string, string>>> {
    try {
      const res = await this.api.request<any>(
        this.api.post('translations/getUiTranslations', {}),
      );
      return res?.data?.translations ?? {};
    } catch {
      return {};
    }
  }

  /** `{ key: { lang: text } }` → `{ key: text }` for one language. */
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

  // ─── Key <-> (recordId, field) ────────────────────────────────────────
  private split(key: string): { parent: string; leaf: string } {
    const i = key.lastIndexOf('.');
    return i < 0
      ? { parent: '', leaf: key }
      : { parent: key.slice(0, i), leaf: key.slice(i + 1) };
  }

  private join(parent: string, leaf: string): string {
    return parent ? `${parent}.${leaf}` : leaf;
  }
}
