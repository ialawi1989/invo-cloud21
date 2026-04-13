/**
 * Pagination public types.
 */

/** Convenience shape for backends that return a paged result with total count. */
export interface PagedResultWithCount<T> {
  list: T[];
  count: number;
  pageCount: number;
  startIndex: number;
  lastIndex: number;
}

/** Convenience shape for backends that only return a "more pages" hint. */
export interface PagedResultWithHasMore<T> {
  list: T[];
  hasMore: boolean;
}

/** Convenience shape for cursor-based pagination. */
export interface CursorPagedResult<T> {
  list: T[];
  hasNext: boolean;
  hasPrev: boolean;
  nextCursor?: string | null;
  prevCursor?: string | null;
}
