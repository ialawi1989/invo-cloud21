import { Params } from '@angular/router';

/**
 * Working-set scope handed from the products list to the bulk-operation
 * pages (price change, availability) through query params:
 *   - `ids`                     comma list of selected product ids, OR
 *   - `search` + `filter_<key>` the list's active search / filters.
 * The same names are written back to the URL by the pages themselves so a
 * reload or a shared link restores the exact scope.
 */
export interface BulkScope {
  ids: string[];
  search: string;
  types: string[];
  departmentId: string | null;
  categoryId: string | null;
  page: number;
  limit: number;
}

const csv = (v: unknown): string[] =>
  String(v ?? '').split(',').map(s => s.trim()).filter(Boolean);

export function parseBulkScope(params: Params): BulkScope {
  const page = Number(params['page']);
  const limit = Number(params['limit']);
  return {
    ids: csv(params['ids']),
    search: String(params['search'] ?? ''),
    types: csv(params['filter_types']),
    departmentId: params['filter_departmentId'] ? String(params['filter_departmentId']) : null,
    categoryId: params['filter_categoryId'] ? String(params['filter_categoryId']) : null,
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    limit: [10, 25, 50, 100].includes(limit) ? limit : 25,
  };
}

/** Query params for the current scope; `null` clears a key on merge. */
export function bulkScopeToParams(s: BulkScope): Params {
  return {
    ids: s.ids.length ? s.ids.join(',') : null,
    search: s.search || null,
    filter_types: s.types.length ? s.types.join(',') : null,
    filter_departmentId: s.departmentId,
    filter_categoryId: s.categoryId,
    page: s.page > 1 ? s.page : null,
    limit: s.limit !== 25 ? s.limit : null,
  };
}

export const BULK_PRODUCT_TYPES = [
  'inventory', 'serialized', 'batch', 'kit', 'service',
  'package', 'menuItem', 'menuSelection', 'tailoring',
] as const;

/** `menuItem` -> `MENU_ITEM` (matches the PRODUCTS.TYPES.* i18n keys). */
export const productTypeKey = (type: string): string =>
  type.replace(/([A-Z])/g, '_$1').toUpperCase();

/**
 * The backend list endpoints have no id filter, so when a page is scoped to
 * selected ids it walks the pages (size 500) until every id is found or the
 * catalogue is exhausted.
 */
export async function fetchByIds<T>(
  ids: string[],
  idOf: (row: T) => string,
  fetchPage: (page: number, limit: number) => Promise<{ list: T[]; pageCount: number }>,
): Promise<T[]> {
  const wanted = new Set(ids);
  const found: T[] = [];
  const limit = 500;
  for (let page = 1; ; page++) {
    const res = await fetchPage(page, limit);
    for (const row of res.list) if (wanted.has(idOf(row))) found.push(row);
    if (found.length >= wanted.size || page >= res.pageCount || res.list.length === 0) break;
  }
  return found;
}
