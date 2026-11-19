import { describe, expect, it } from 'vitest';
import { pageInfoFromResponse, resolvePage } from './page-info';

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
