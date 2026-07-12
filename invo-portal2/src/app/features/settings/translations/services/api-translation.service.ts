import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';

import { findTranslationEntity } from '../translations.config';
import {
  TranslationChange,
  TranslationDataSource,
  TranslationListResult,
  TranslationQuery,
  TranslationRow,
  TranslationSaveResult,
  TranslationSummary,
  countWords,
  statusFromTarget,
} from './translation-api';

/**
 * Generic API-backed data source. Reads the entity's `endpoints` from the
 * central config, so a single service serves every `source: 'api'` group.
 * Endpoints are expected to speak the same enveloped shape as the rest of
 * the app (`ApiService.request` → `{ success, data }`).
 *
 * Wire format assumed (adjust the normaliser when the backend firms up):
 *   POST <list> { lang, page, limit, searchTerm, status, item }
 *        → { rows: [{ recordId, recordLabel, field, fieldLabel,
 *                     source, target, status }], count, pageCount,
 *            items: [{ id, label }], words: { translated, total } }
 *   POST <save> { lang, changes: [{ recordId, field, target }] }
 *        → { success }
 */
@Injectable({ providedIn: 'root' })
export class ApiTranslationService implements TranslationDataSource {
  private api = inject(ApiService);

  /** Site-wide overview for the Multilingual landing — per-language word
   *  progress summed across every entity. */
  async getSummary(langs: string[]): Promise<TranslationSummary> {
    const res = await this.api.request<any>(
      this.api.post('translations/getSummary', { langs }),
    );
    const data = res?.data ?? {};
    return {
      original: {
        lang: String(data?.original?.lang ?? 'en'),
        words: Number(data?.original?.words ?? 0) || 0,
      },
      languages: Array.isArray(data?.languages)
        ? data.languages.map((l: any) => ({
            lang: String(l?.lang ?? ''),
            translated: Number(l?.translated ?? 0) || 0,
            total: Number(l?.total ?? 0) || 0,
          }))
        : [],
    };
  }

  async getTranslations(
    entityId: string,
    lang: string,
    query: TranslationQuery,
  ): Promise<TranslationListResult> {
    const entity = findTranslationEntity(entityId);
    const endpoint = entity?.endpoints?.list;
    if (!endpoint) {
      return { rows: [], total: 0, pageCount: 1, items: [], words: { translated: 0, total: 0 } };
    }

    const res = await this.api.request<any>(
      this.api.post(endpoint, {
        entity: entityId,
        lang,
        page: query.page,
        limit: query.limit,
        searchTerm: query.search.trim(),
        status: query.status,
        item: query.item,
      }),
    );
    const data = res?.data ?? {};
    const rawRows: any[] = Array.isArray(data?.rows) ? data.rows : [];

    // Map the entity's field keys to their localised labels from config.
    const fieldLabels = new Map((entity?.fields ?? []).map(f => [f.key, f.labelKey]));

    const rows: TranslationRow[] = rawRows.map(raw => {
      const recordId = String(raw?.recordId ?? '');
      const field = String(raw?.field ?? '');
      const target = String(raw?.target ?? '');
      return {
        id: raw?.id ? String(raw.id) : `${recordId}:${field}`,
        recordId,
        recordLabel: String(raw?.recordLabel ?? recordId),
        field,
        fieldLabel: fieldLabels.get(field) ?? String(raw?.fieldLabel ?? field),
        source: String(raw?.source ?? ''),
        target,
        status: raw?.status ?? statusFromTarget(target),
      };
    });

    const items = Array.isArray(data?.items)
      ? data.items.map((i: any) => ({ id: String(i?.id ?? ''), label: String(i?.label ?? i?.id ?? '') }))
      : [];

    const total = Number(data?.count ?? rows.length) || 0;
    const pageCount = Number(data?.pageCount ?? Math.ceil(total / (query.limit || 25))) || 1;

    const words = data?.words
      ? {
          translated: Number(data.words.translated ?? 0) || 0,
          total: Number(data.words.total ?? 0) || 0,
        }
      : rows.reduce(
          (acc, r) => {
            const w = countWords(r.source);
            acc.total += w;
            if (r.status === 'translated') acc.translated += w;
            return acc;
          },
          { translated: 0, total: 0 },
        );

    return { rows, total, pageCount, items, words };
  }

  async saveTranslations(
    entityId: string,
    lang: string,
    changes: TranslationChange[],
  ): Promise<TranslationSaveResult> {
    const entity = findTranslationEntity(entityId);
    const endpoint = entity?.endpoints?.save;
    if (!endpoint) return { success: false, msg: 'No save endpoint configured' };

    const res = await this.api.request<any>(
      this.api.post(endpoint, {
        entity: entityId,
        lang,
        changes: changes.map(c => ({ recordId: c.recordId, field: c.field, target: c.target })),
      }),
    );
    return { success: !!res?.success, msg: res?.msg };
  }
}
