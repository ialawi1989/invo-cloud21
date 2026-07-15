/**
 * Product-collection domain types
 * ───────────────────────────────
 * Port of the legacy `core/models/products-collections.ts` class graph to plain
 * interfaces + factory functions. A collection groups products either
 * **Manually** (a pinned, ordered list) or **Automatically** (rule-based
 * conditions the backend evaluates).
 *
 * The wire format matches the legacy backend verbatim (`company/saveCollection`
 * round-trips these exact shapes); normalisation of missing arrays / stringly
 * fields happens in `normalizeCollection`.
 */

export type CollectionType = 'Manual' | 'Auto';
export type CollectionMatch = 'all' | 'any';

export interface CollectionImage {
  defaultUrl: string | null;
  thumbnailUrl: string | null;
}

export interface CollectionTranslationField {
  en: string;
  ar: string;
  [lang: string]: string;
}

export interface CollectionTranslation {
  title: CollectionTranslationField;
  description: CollectionTranslationField;
}

/** A pinned product inside a Manual collection (id + display name). */
export interface CollectionProductRef {
  id: string;
  name: string;
}

export interface ManualCollectionData {
  /** Selection kind — only 'Product' is used by the form. */
  type: string;
  ids: string[];
  products: CollectionProductRef[];
}

export interface CollectionCondition {
  /** Field to compare: Name | Type | Category | Department | Tag | Price | On hand. */
  type: string;
  /** Comparator: isEqual | isNotEqual | startsWith | endsWith | contains | notContain. */
  condition: string;
  value: any;
}

export interface AutoCollectionData {
  sortBy: string;
  match: CollectionMatch;
  conditions: CollectionCondition[];
}

export interface Collection {
  id: string | null;
  title: string;
  slug: string;
  description: string;
  translation: CollectionTranslation;
  type: CollectionType;
  data: ManualCollectionData | AutoCollectionData;
  mediaId: string | null;
  mediaUrl: CollectionImage;
}

// ─── Factories ──────────────────────────────────────────────────────────────

export function emptyTranslationField(): CollectionTranslationField {
  return { en: '', ar: '' };
}

export function emptyCollectionTranslation(): CollectionTranslation {
  return { title: emptyTranslationField(), description: emptyTranslationField() };
}

export function emptyManualData(): ManualCollectionData {
  return { type: 'Product', ids: [], products: [] };
}

export function emptyAutoData(): AutoCollectionData {
  return { sortBy: '', match: 'all', conditions: [emptyCondition()] };
}

export function emptyCondition(): CollectionCondition {
  return { type: 'Price', condition: 'isEqual', value: '' };
}

export function emptyCollection(): Collection {
  return {
    id: null,
    title: '',
    slug: '',
    description: '',
    translation: emptyCollectionTranslation(),
    type: 'Manual',
    data: emptyManualData(),
    mediaId: null,
    mediaUrl: { defaultUrl: '', thumbnailUrl: '' },
  };
}

/** Derive a URL-safe slug from a title (lowercase, spaces → dashes). */
export function slugify(title: string): string {
  return (title || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '');
}

/** Normalise a raw `getCollectionById` payload into a typed `Collection`,
 *  filling missing arrays / translation shapes so the form can trust them. */
export function normalizeCollection(raw: any): Collection {
  const base = emptyCollection();
  if (!raw || typeof raw !== 'object') return base;

  const type: CollectionType = raw.type === 'Auto' ? 'Auto' : 'Manual';
  const translation: CollectionTranslation = {
    title: {
      ...(raw?.translation?.title ?? {}),
      en: raw?.translation?.title?.en ?? raw.title ?? '',
      ar: raw?.translation?.title?.ar ?? '',
    },
    description: {
      ...(raw?.translation?.description ?? {}),
      en: raw?.translation?.description?.en ?? raw.description ?? '',
      ar: raw?.translation?.description?.ar ?? '',
    },
  };

  let data: ManualCollectionData | AutoCollectionData;
  if (type === 'Auto') {
    const d = raw.data ?? {};
    data = {
      sortBy: d.sortBy ?? '',
      match: d.match === 'any' ? 'any' : 'all',
      conditions: Array.isArray(d.conditions) && d.conditions.length
        ? d.conditions.map((c: any) => ({
            type: c?.type ?? 'Price',
            condition: c?.condition ?? 'isEqual',
            value: c?.value ?? '',
          }))
        : [emptyCondition()],
    };
  } else {
    const d = raw.data ?? {};
    const products: CollectionProductRef[] = Array.isArray(d.products)
      ? d.products.map((p: any) => ({ id: String(p?.id ?? ''), name: p?.name ?? p?.productName ?? '' }))
      : [];
    const ids: string[] = Array.isArray(d.ids)
      ? d.ids.map((i: any) => String(i))
      : products.map((p) => p.id);
    data = { type: d.type || 'Product', ids, products };
  }

  return {
    id: raw.id ? String(raw.id) : null,
    title: raw.title ?? '',
    slug: raw.slug ?? slugify(raw.title ?? ''),
    description: raw.description ?? '',
    translation,
    type,
    data,
    mediaId: raw.mediaId ?? null,
    mediaUrl: {
      defaultUrl: raw?.mediaUrl?.defaultUrl ?? '',
      thumbnailUrl: raw?.mediaUrl?.thumbnailUrl ?? '',
    },
  };
}
