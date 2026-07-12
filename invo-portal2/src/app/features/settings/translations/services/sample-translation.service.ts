import { Injectable } from '@angular/core';

import { findTranslationEntity } from '../translations.config';
import {
  TranslationChange,
  TranslationDataSource,
  TranslationListResult,
  TranslationQuery,
  TranslationRow,
  TranslationSaveResult,
  countWords,
  statusFromTarget,
} from './translation-api';

interface SampleRecord {
  id: string;
  label: string;
  /** field key → English source text */
  fields: Record<string, string>;
}

/**
 * In-memory data source so the whole manager is demoable before the real
 * translation endpoints exist. Edits persist for the session (a save
 * round-trips into `targets`), which lets Save / CSV import / export all
 * behave exactly as they will against a backend. Groups flagged
 * `source: 'api'` use {@link ApiTranslationService} instead.
 */
@Injectable({ providedIn: 'root' })
export class SampleTranslationService implements TranslationDataSource {
  /** entityId → sample source records. */
  private readonly records: Record<string, SampleRecord[]> = {
    'page-content': [
      {
        id: 'home',
        label: 'Home',
        fields: {
          title: 'Welcome to our store',
          subtitle: 'Fresh finds, delivered fast',
          body: 'Browse our latest collection and enjoy free delivery on your first order.',
        },
      },
      {
        id: 'about',
        label: 'About',
        fields: {
          title: 'Our story',
          subtitle: 'Built by locals, for locals',
          body: 'We started in a small shop and grew into a community you can trust.',
        },
      },
      {
        id: 'contact',
        label: 'Contact',
        fields: {
          title: 'Get in touch',
          subtitle: 'We would love to hear from you',
          body: 'Reach our support team any day of the week — we usually reply within an hour.',
        },
      },
    ],
    'business-info': [
      {
        id: 'business',
        label: 'Business',
        fields: {
          name: 'Invo Market',
          description: 'A neighbourhood grocery bringing quality produce to your door.',
          address: '12 Marina Street, Manama',
        },
      },
    ],
  };

  /** entityId → lang → rowId → target text (session-persisted edits). */
  private readonly targets: Record<string, Record<string, Record<string, string>>> = {};

  async getTranslations(
    entityId: string,
    lang: string,
    query: TranslationQuery,
  ): Promise<TranslationListResult> {
    const entity = findTranslationEntity(entityId);
    const records = this.records[entityId] ?? [];
    const langTargets = this.targets[entityId]?.[lang] ?? {};

    // Build every (record, field) row from the config's field list.
    const all: TranslationRow[] = [];
    for (const rec of records) {
      for (const f of entity?.fields ?? []) {
        const id = `${rec.id}:${f.key}`;
        const source = rec.fields[f.key] ?? '';
        const target = langTargets[id] ?? '';
        all.push({
          id,
          recordId: rec.id,
          recordLabel: rec.label,
          field: f.key,
          fieldLabel: f.labelKey,
          source,
          target,
          status: statusFromTarget(target),
        });
      }
    }

    // Whole-entity progress in words (before filtering).
    const words = all.reduce(
      (acc, r) => {
        const w = countWords(r.source);
        acc.total += w;
        if (r.status === 'translated') acc.translated += w;
        return acc;
      },
      { translated: 0, total: 0 },
    );

    const items = records.map(r => ({ id: r.id, label: r.label }));

    // Apply toolbar filters.
    const term = query.search.trim().toLowerCase();
    const filtered = all.filter(r => {
      if (query.item && r.recordId !== query.item) return false;
      if (query.status !== 'all' && r.status !== query.status) return false;
      if (term && !r.source.toLowerCase().includes(term) && !r.target.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });

    const total = filtered.length;
    const pageCount = total > 0 ? Math.ceil(total / query.limit) : 1;
    const start = (query.page - 1) * query.limit;
    const rows = filtered.slice(start, start + query.limit);

    return { rows, total, pageCount, items, words };
  }

  async saveTranslations(
    entityId: string,
    lang: string,
    changes: TranslationChange[],
  ): Promise<TranslationSaveResult> {
    const byEntity = (this.targets[entityId] ??= {});
    const byLang = (byEntity[lang] ??= {});
    for (const c of changes) {
      byLang[c.id] = c.target;
    }
    return { success: true };
  }
}
