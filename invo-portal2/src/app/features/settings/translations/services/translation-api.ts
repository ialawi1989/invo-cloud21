import {
  ParamDef,
  IntCodec,
  intCodec,
  StringCodec,
  enumCodec,
} from '@shared/services/query-params.service';

/**
 * Data contract + query model shared by the Translation Manager.
 *
 * Every entity group ("Page Content", "Products", …) exposes its
 * translatable strings through a `TranslationDataSource`. The grid is
 * config-driven: it looks the entity up in `TRANSLATION_ENTITIES`, picks
 * the matching data source, and renders one row per translatable field.
 *
 * A "row" is a single (record, field) pair — e.g. the *title* of the
 * *Home* page, or the *name* of a given product. `recordId`/`recordLabel`
 * group rows so the "All items" filter can narrow to one record.
 */

export type TranslationStatus = 'translated' | 'not-translated' | 'needs-update';

/** Value used by the "All statuses" toolbar filter (adds an `all` option). */
export type TranslationStatusFilter = TranslationStatus | 'all';

export const TRANSLATION_STATUSES: readonly TranslationStatus[] = [
  'not-translated',
  'translated',
  'needs-update',
];

export interface TranslationRow {
  /** Stable unique id — `${recordId}:${field}`. Used as the CSV key. */
  id: string;
  /** Record this row belongs to (page id, product id, …). */
  recordId: string;
  /** Human label for the record (page name, product name, …). */
  recordLabel: string;
  /** Field key within the record (title, body, name, …). */
  field: string;
  /** i18n key (or literal) describing the field, shown in the row. */
  fieldLabel: string;
  /** Read-only English source text. */
  source: string;
  /** Editable target-language text. */
  target: string;
  status: TranslationStatus;
}

export interface TranslationQuery {
  page: number;
  limit: number;
  search: string;
  status: TranslationStatusFilter;
  /** `recordId` to narrow to a single item; `''` = all items. */
  item: string;
}

export interface TranslationItemRef {
  id: string;
  label: string;
}

export interface TranslationListResult {
  /** Rows for the current page, already filtered/sorted server-side. */
  rows: TranslationRow[];
  /** Total rows matching the filters (drives pagination). */
  total: number;
  pageCount: number;
  /** Every selectable record for the "All items" filter (unfiltered). */
  items: TranslationItemRef[];
  /** Whole-entity progress, counted in words (not just the page). */
  words: { translated: number; total: number };
}

export interface TranslationChange {
  id: string;
  recordId: string;
  field: string;
  target: string;
}

export interface TranslationSaveResult {
  success: boolean;
  msg?: string;
}

export interface TranslationLangSummary {
  lang: string;
  translated: number;
  total: number;
}

/** Site-wide translation overview shown on the Multilingual landing. */
export interface TranslationSummary {
  /** Source language + its total word count (language-independent). */
  original: { lang: string; words: number };
  /** Per additional-language progress across all entities. */
  languages: TranslationLangSummary[];
}

/**
 * Contract every entity group's data access implements. The `entityId`
 * selects the group so a single service can back several groups (the
 * sample source and the generic API source both do this); real backends
 * can equally ship one implementation per entity.
 */
export interface TranslationDataSource {
  getTranslations(
    entityId: string,
    lang: string,
    query: TranslationQuery,
  ): Promise<TranslationListResult>;

  saveTranslations(
    entityId: string,
    lang: string,
    changes: TranslationChange[],
  ): Promise<TranslationSaveResult>;
}

// ─── URL-synced toolbar query params ─────────────────────────────────────────
// Shared by the shell (writes on filter change) and the grid (reads on load).
// `group` is carried by the route path, not a query param.

const STATUS_FILTERS = [
  'all',
  'not-translated',
  'translated',
  'needs-update',
] as const;

export const TRANSLATION_QP = {
  page:   { key: 'page',   codec: IntCodec }                            as ParamDef<number>,
  limit:  { key: 'limit',  codec: intCodec(25) }                        as ParamDef<number>,
  search: { key: 'q',      codec: StringCodec }                         as ParamDef<string>,
  status: { key: 'status', codec: enumCodec(STATUS_FILTERS, 'all') }    as ParamDef<TranslationStatusFilter>,
  item:   { key: 'item',   codec: StringCodec }                         as ParamDef<string>,
};

/** Word count for a piece of text (whitespace-delimited, trimmed). */
export function countWords(text: string): number {
  const t = (text ?? '').trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/** Status derived purely from whether the target has content. Server
 *  `needs-update` (source changed after translating) is preserved by the
 *  data source; local edits only ever move between translated / not. */
export function statusFromTarget(target: string): TranslationStatus {
  return (target ?? '').trim() ? 'translated' : 'not-translated';
}
