/**
 * Request bodies of the Products list, as pure functions (so what is sent is unit-tested).
 *
 *  - root list:     `product/getProductList` — with `skipCount: true` while the deferred-count flag is on;
 *  - total:         the same endpoint with `countOnly: true`, the same search / filters / type and NO page, limit or sortBy;
 *  - child groups:  `product/productChildsList` — the default response (with `count`) and only the filters / sort the
 *                   endpoint honours.
 */

export interface RootListInput {
  page: number;
  limit: number;
  searchTerm?: string;
  sortBy?: { sortValue: string; sortDirection: 'asc' | 'desc' };
  filter?: Record<string, any>;
  columns?: string[];
}

/** Accepts array / scalar / nullish and returns a clean string array. */
export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (value === null || value === undefined || value === '') return [];
  return [String(value)];
}

/**
 * The list's UI filter state -> the API's filter shape. `types` is a checkbox group and is always an array (a URL
 * restore hands back a bare string for a single value).
 */
export function transformProductFilters(filters: Record<string, any> = {}): {
  type: string[]; departments: string[]; categories: string[]; brands: string[]; tags: string[];
} {
  return {
    type:        toStringArray(filters['types']),
    departments: filters['departmentId'] ? [filters['departmentId']] : [],
    categories:  filters['categoryId']   ? [filters['categoryId']]   : [],
    brands:      filters['brandId']      ? [filters['brandId']]      : [],
    tags:        toStringArray(filters['tags']),
  };
}

export function buildRootListBody(input: RootListInput, deferredCount: boolean): Record<string, any> {
  return {
    page: input.page,
    limit: input.limit,
    searchTerm: input.searchTerm || '',
    sortBy: input.sortBy ? { sortValue: input.sortBy.sortValue, sortDirection: input.sortBy.sortDirection } : {},
    filter: transformProductFilters(input.filter),
    columns: input.columns,
    ...(deferredCount ? { skipCount: true } : {}),
  };
}

/** Same search, filters and type as the list; the API ignores page and limit for `countOnly`, so none are sent. */
export function buildCountBody(input: RootListInput): Record<string, any> {
  return {
    searchTerm: input.searchTerm || '',
    filter: transformProductFilters(input.filter),
    columns: input.columns,
  };
}

/** Sort keys `productChildsList` can ORDER BY; anything else is omitted so the endpoint uses its default order. */
export const CHILD_SORT_KEYS: ReadonlySet<string> = new Set([
  'name', 'barcode', 'unitCost', 'defaultPrice', 'type', 'createdAt', 'categoryName', 'departmentName',
]);

export function buildChildrenBody(
  parentId: string,
  p: { page: number; limit: number; searchTerm?: string; sortBy?: { sortValue: string; sortDirection: 'asc' | 'desc' }; filter?: Record<string, any> },
): Record<string, any> {
  const f = transformProductFilters(p.filter);
  const sortOk = !!p.sortBy && CHILD_SORT_KEYS.has(p.sortBy.sortValue);
  return {
    id: parentId,
    page: Math.max(1, Math.floor(p.page) || 1),
    limit: Math.min(100, Math.max(1, Math.floor(p.limit) || 1)),
    searchTerm: p.searchTerm || '',
    sortBy: sortOk ? { sortValue: p.sortBy!.sortValue, sortDirection: p.sortBy!.sortDirection } : undefined,
    // Only these three filters are honoured for children (brands, tags and ids are ignored by the endpoint).
    filter: { departments: f.departments, categories: f.categories, type: f.type },
  };
}
