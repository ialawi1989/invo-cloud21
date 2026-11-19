import { describe, expect, it } from 'vitest';
import { pageChrome, pageInfoFromResponse, resolvePage } from './page-info';

describe('pageInfoFromResponse', () => {
  it('reads a total from count (bigint strings included)', () => {
    expect(pageInfoFromResponse({ count: '45' }, 1, 15).total).toBe(45);
  });

  it('keeps total unknown when the response has none', () => {
    const p = pageInfoFromResponse({ hasNext: true }, 2, 15);
    expect(p.total).toBeUndefined();
    expect(p.hasNext).toBe(true);
  });

  it('keeps a legacy pageCount only when there is no total', () => {
    expect(pageInfoFromResponse({ pageCount: 7 }, 1, 15).pageCount).toBe(7);
    expect(pageInfoFromResponse({ count: 100, pageCount: 7 }, 1, 15).pageCount).toBeUndefined();
  });

  it('accepts hasMore as an alias of hasNext', () => {
    expect(pageInfoFromResponse({ hasMore: false }, 1, 15).hasNext).toBe(false);
  });
});

describe('resolvePage', () => {
  it('derives hasNext from the total when known', () => {
    expect(resolvePage({ page: 1, limit: 15, total: 45 }, 15).hasNext).toBe(true);
    expect(resolvePage({ page: 3, limit: 15, total: 45 }, 15).hasNext).toBe(false);
  });

  it('prefers the API flag over the derived value', () => {
    expect(resolvePage({ page: 1, limit: 15, total: 45, hasNext: false }, 15).hasNext).toBe(false);
  });

  it('derives hasNext from a full page when nothing else is known', () => {
    expect(resolvePage({ page: 1, limit: 15 }, 15).hasNext).toBe(true);
    expect(resolvePage({ page: 2, limit: 15 }, 9).hasNext).toBe(false);
  });

  it('reports the total as unknown instead of guessing', () => {
    const r = resolvePage({ page: 1, limit: 15 }, 15);
    expect(r.totalKnown).toBe(false);
    expect(r.total).toBeNull();
    expect(r.pageCount).toBeNull();
  });

  it('computes the visible range', () => {
    const r = resolvePage({ page: 2, limit: 15, total: 40 }, 15);
    expect(r.from).toBe(16);
    expect(r.to).toBe(30);
    expect(r.hasPrev).toBe(true);
    expect(resolvePage({ page: 1, limit: 15, total: 0 }, 0).from).toBe(0);
  });
});

describe('pageChrome (what the pill and footer show)', () => {
  const list = (info: Parameters<typeof resolvePage>[0], rows: number) => resolvePage(info, rows);

  it('total pending: skeleton in pill and footer, no number yet, footer already usable (Previous / Next)', () => {
    const c = pageChrome(list({ page: 1, limit: 15, hasNext: true }, 15), true);
    expect(c.skeleton).toBe(true);
    expect(c.pill).toBe(false);
    expect(c.footer).toBe('compact');
    expect(c.showFirstLast).toBe(false);
  });

  it('total failed: skeleton gone, pill and "of N" hidden, "Showing 1-15" + Previous / Next, list still usable', () => {
    const p = list({ page: 1, limit: 15, hasNext: true }, 15);   // the count never arrived: total stays unknown
    const c = pageChrome(p, false);
    expect(c.skeleton).toBe(false);
    expect(c.pill).toBe(false);
    expect(c.footer).toBe('compact');
    expect(c.showFirstLast).toBe(false);
    expect(p.hasNext).toBe(true);
    expect(p.from).toBe(1);
    expect(p.to).toBe(15);
  });

  it('total known: pill, numbered pages and first / last', () => {
    const c = pageChrome(list({ page: 1, limit: 15, total: 10581, hasNext: true }, 15), false);
    expect(c).toEqual({ pill: true, skeleton: false, footer: 'full', showFirstLast: true });
  });

  it('a list with only a legacy pageCount keeps numbered pages and first / last', () => {
    const p = list(pageInfoFromResponse({ pageCount: 5 }, 1, 15), 15);
    const c = pageChrome(p, false);
    expect(c.footer).toBe('full');
    expect(c.showFirstLast).toBe(true);
    expect(c.pill).toBe(false);
  });

  it('an empty list shows no pill', () => {
    expect(pageChrome(list({ page: 1, limit: 15, total: 0 }, 0), false).pill).toBe(false);
  });
});

describe('hasNext for child groups ("Show N more")', () => {
  it('uses the API flag when present', () => {
    expect(resolvePage({ page: 1, limit: 15, total: 40, hasNext: false }, 15).hasNext).toBe(false);
  });
  it('falls back to the total, then to a full page, when an older backend sends no hasNext', () => {
    expect(resolvePage({ page: 1, limit: 15, total: 40 }, 15).hasNext).toBe(true);
    expect(resolvePage({ page: 3, limit: 15, total: 40 }, 10).hasNext).toBe(false);
    expect(resolvePage({ page: 1, limit: 15 }, 15).hasNext).toBe(true);
    expect(resolvePage({ page: 1, limit: 15 }, 7).hasNext).toBe(false);
  });
});
