import { ParamDef, StringCodec, enumCodec, intCodec, IntCodec } from '../../../../shared/services/query-params.service';
import { BoSort } from './bo-filter';

/**
 * Paging + sort of the paged Business Overview reports (Journal Entries, Account Journals) as URL params, so a
 * refresh or a shared link keeps the page, the page size and the sort. `page=1`, `limit=25` and "no sort" are not written.
 */
export const DEFAULT_PAGE_SIZE = 25;

export const PAGING_PARAMS = {
  page: { key: 'page', codec: IntCodec } as ParamDef<number>,
  limit: { key: 'limit', codec: intCodec(DEFAULT_PAGE_SIZE) } as ParamDef<number>,
  sortBy: { key: 'sortBy', codec: StringCodec } as ParamDef<string>,
  sortDirection: { key: 'sortDirection', codec: enumCodec(['asc', 'desc'] as const, 'asc') } as ParamDef<'asc' | 'desc'>,
};

/** Page size from the URL, only when it is one the page offers. */
export function pickPageSize(limit: number, sizes: readonly number[]): number {
  return sizes.includes(limit) ? limit : (sizes.includes(DEFAULT_PAGE_SIZE) ? DEFAULT_PAGE_SIZE : sizes[0]);
}

/** Sort from the URL, only for columns the report can sort by. */
export function pickSort(sortBy: string, direction: 'asc' | 'desc', allowed: readonly string[]): BoSort | null {
  return sortBy && allowed.includes(sortBy) ? { sortValue: sortBy, sortDirection: direction } : null;
}
