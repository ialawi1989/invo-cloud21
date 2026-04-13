/**
 * SearchDropdown public types.
 */

/** Parameters passed to a `loadFn` when fetching a page of items. */
export interface DropdownLoadParams {
  /** 1-based page number. */
  page: number;
  /** Page size requested. */
  pageSize: number;
  /** Current search query (empty string if none). */
  search: string;
}

/** Result returned by a `loadFn`. */
export interface DropdownLoadResult<T> {
  /** Items for the requested page. */
  items: T[];
  /** Whether more pages exist after this one. */
  hasMore: boolean;
}

/** Async loader signature for server-side data. */
export type DropdownLoadFn<T> = (
  params: DropdownLoadParams,
) => Promise<DropdownLoadResult<T>>;
