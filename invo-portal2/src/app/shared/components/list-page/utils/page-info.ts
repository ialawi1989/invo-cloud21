/**
 * Pagination, in one place.
 *
 * Every pagination decision in `<app-list-page>` and in the tree's child groups reads from `PageInfo` /
 * `resolvePage()`. Nothing else looks at a response's `count`, `pageCount`, `lastIndex` or `hasNext` directly, so
 * moving an endpoint from "I know the total" to "I only know whether there is a next page" means changing
 * `pageInfoFromResponse()` below and nothing else.
 */

/** What is known about one page of a list (or of one group of children). */
export interface PageInfo {
  /** 1-based. */
  page: number;
  limit: number;
  /** Set when the API says whether another page exists. */
  hasNext?: boolean;
  /** Total number of matching rows, when the API provides it. */
  total?: number;
  /** Total pages, for legacy responses that give this but no total. */
  pageCount?: number;
}

/** A `PageInfo` with every derived value the UI needs. */
export interface ResolvedPage {
  page: number;
  limit: number;
  total: number | null;
  /** True when `total` is a real number: numbered pages, "of N" and the header count may be shown. */
  totalKnown: boolean;
  pageCount: number | null;
  hasNext: boolean;
  hasPrev: boolean;
  /** 1-based index of the first row on this page (0 when empty) and of the last. */
  from: number;
  to: number;
}

/** The loose shape of a list response; only this file reads these fields. */
export interface PageSource {
  count?: unknown;
  total?: unknown;
  pageCount?: unknown;
  hasNext?: unknown;
  hasMore?: unknown;
}

const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Reads what a response says about paging. Counts may arrive as strings (bigint columns). */
export function pageInfoFromResponse(res: PageSource | null | undefined, page: number, limit: number): PageInfo {
  const total = num(res?.total) ?? num(res?.count);
  const pageCount = num(res?.pageCount);
  const hn = res?.hasNext ?? res?.hasMore;
  return {
    page,
    limit,
    total,
    pageCount: total === undefined && pageCount !== undefined && pageCount > 0 ? pageCount : undefined,
    hasNext: typeof hn === 'boolean' ? hn : undefined,
  };
}

/**
 * Derives everything else. `hasNext` comes from the API when given; otherwise from the total
 * (`page * limit < total`), then from the page count, and finally from the page being full
 * (`rowsReturned === limit`).
 */
export function resolvePage(info: PageInfo, rowsReturned: number): ResolvedPage {
  const { page, limit } = info;
  const totalKnown = info.total !== undefined;
  const total = totalKnown ? info.total! : null;
  const pageCount = totalKnown
    ? Math.max(1, Math.ceil(info.total! / Math.max(1, limit)))
    : info.pageCount ?? null;

  let hasNext: boolean;
  if (typeof info.hasNext === 'boolean') hasNext = info.hasNext;
  else if (totalKnown) hasNext = page * limit < info.total!;
  else if (info.pageCount !== undefined) hasNext = page < info.pageCount;
  else hasNext = rowsReturned === limit;

  const start = (page - 1) * limit;
  return {
    page, limit, total, totalKnown, pageCount, hasNext,
    hasPrev: page > 1,
    from: rowsReturned > 0 ? start + 1 : 0,
    to: start + rowsReturned,
  };
}

/** What the pill and the footer show, given the resolved page and whether a total is still on its way. */
export interface PageChrome {
  /** Number in the header pill. */
  pill: boolean;
  /** Skeleton in the pill and after "Showing 1-15 of". */
  skeleton: boolean;
  /** Footer: numbered pages, "of N" and first / last buttons (`full`), or "Showing 1-15" + Previous / Next (`compact`). */
  footer: 'full' | 'compact';
  showFirstLast: boolean;
}

export function pageChrome(p: ResolvedPage, totalPending: boolean): PageChrome {
  return {
    pill: !totalPending && p.totalKnown && (p.total ?? 0) > 0,
    skeleton: totalPending,
    footer: p.totalKnown || p.pageCount !== null ? 'full' : 'compact',
    showFirstLast: p.totalKnown || p.pageCount !== null,
  };
}

/** `countMode: 'onDemand'`: what the header pill shows in each count state. */
export type OnDemandPill = 'button' | 'skeleton' | 'number' | 'retry' | 'none';

export interface OnDemandChrome extends PageChrome {
  status: 'unknown' | 'counting' | 'known' | 'failed';
  /** Header pill: "Count" button, skeleton, the number, or the "Retry" button. */
  pillKind: OnDemandPill;
}

/**
 * Same shape as `pageChrome` for the on-demand mode. Numbered pages / first-last / "of N" appear ONLY in `known`;
 * the other three states paginate with Previous / Next (driven by `hasNext`).
 */
export function onDemandChrome(p: ResolvedPage, status: OnDemandChrome['status']): OnDemandChrome {
  const known = status === 'known' && p.totalKnown;
  const pillKind: OnDemandPill =
    status === 'unknown' ? 'button'
    : status === 'counting' ? 'skeleton'
    : status === 'failed' ? 'retry'
    : known && (p.total ?? 0) > 0 ? 'number' : 'none';
  return {
    status,
    pillKind,
    pill: pillKind === 'number',
    skeleton: status === 'counting',
    footer: known ? 'full' : 'compact',
    showFirstLast: known,
  };
}
