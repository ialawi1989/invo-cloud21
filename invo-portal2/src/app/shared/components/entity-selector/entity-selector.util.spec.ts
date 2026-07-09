import { describe, expect, it } from 'vitest';

import { matchesQuery, normalizeForSearch, progressCounts } from './entity-selector.util';

describe('progressCounts', () => {
  const ids = ['a', 'b', 'c'];

  it('returns 0/total when completion is off (null)', () => {
    expect(progressCounts(null, ids)).toEqual({ done: 0, total: 3 });
  });

  it('counts only done entries, over the live directory', () => {
    const map = { a: 'done', b: 'partial', c: 'done' } as const;
    expect(progressCounts(map, ids)).toEqual({ done: 2, total: 3 });
  });

  it('ignores completion entries for ids not in the directory', () => {
    const map = { a: 'done', zzz: 'done' } as const;
    expect(progressCounts(map, ids)).toEqual({ done: 1, total: 3 });
  });

  it('treats empty/missing as not done', () => {
    expect(progressCounts({ a: 'empty' } as const, ids)).toEqual({ done: 0, total: 3 });
  });
});

describe('matchesQuery', () => {
  it('matches case-insensitively and by substring', () => {
    expect(matchesQuery('Some Store 3', 'store')).toBe(true);
    expect(matchesQuery('Some Store 3', 'STORE')).toBe(true);
    expect(matchesQuery('Some Store 3', 'xyz')).toBe(false);
  });

  it('is diacritic-insensitive both ways (Latin accents + Arabic tashkeel)', () => {
    expect(matchesQuery('Záyed', 'zayed')).toBe(true);
    expect(matchesQuery('Zayed', 'záyed')).toBe(true);
    expect(normalizeForSearch('مَنَامَة')).toBe(normalizeForSearch('منامة'));
  });

  it('an empty query matches everything', () => {
    expect(matchesQuery('anything', '')).toBe(true);
    expect(matchesQuery('anything', '   ')).toBe(true);
  });
});
