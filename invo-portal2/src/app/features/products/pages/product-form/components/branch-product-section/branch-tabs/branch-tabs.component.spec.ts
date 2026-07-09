import { describe, expect, it } from 'vitest';

import {
  matchesQuery,
  normalizeForSearch,
  progressCounts,
  resolveBranchMode,
} from './branch-tabs.util';

describe('resolveBranchMode', () => {
  it('defaults to tabs when neither mode nor dropdown is set', () => {
    expect(resolveBranchMode(undefined, false)).toBe('tabs');
  });

  it('maps the deprecated dropdown=true alias to dropdown', () => {
    expect(resolveBranchMode(undefined, true)).toBe('dropdown');
  });

  it('lets an explicit mode win over the dropdown alias', () => {
    expect(resolveBranchMode('tabs', true)).toBe('tabs');
    expect(resolveBranchMode('sidebar', true)).toBe('sidebar');
    expect(resolveBranchMode('dropdown', false)).toBe('dropdown');
  });

  it('passes each explicit mode through unchanged', () => {
    expect(resolveBranchMode('tabs', false)).toBe('tabs');
    expect(resolveBranchMode('dropdown', false)).toBe('dropdown');
    expect(resolveBranchMode('sidebar', false)).toBe('sidebar');
  });
});

describe('progressCounts', () => {
  const ids = ['a', 'b', 'c'];

  it('returns 0/total when completion is off (null)', () => {
    expect(progressCounts(null, ids)).toEqual({ done: 0, total: 3 });
  });

  it('counts only done entries, over the live directory', () => {
    const map = { a: 'done', b: 'partial', c: 'done' } as const;
    expect(progressCounts(map, ids)).toEqual({ done: 2, total: 3 });
  });

  it('ignores completion entries for branches not in the directory', () => {
    const map = { a: 'done', zzz: 'done' } as const; // zzz not in ids
    expect(progressCounts(map, ids)).toEqual({ done: 1, total: 3 });
  });

  it('treats empty/missing as not done', () => {
    const map = { a: 'empty' } as const;
    expect(progressCounts(map, ids)).toEqual({ done: 0, total: 3 });
  });
});

describe('matchesQuery (sidebar / popover filtering)', () => {
  it('matches case-insensitively', () => {
    expect(matchesQuery('Manama 3', 'manama')).toBe(true);
    expect(matchesQuery('Manama 3', 'MAN')).toBe(true);
  });

  it('matches substrings anywhere in the name', () => {
    expect(matchesQuery('Zayed town', 'town')).toBe(true);
    expect(matchesQuery('Zayed town', 'xyz')).toBe(false);
  });

  it('is diacritic-insensitive both ways (Latin accents + Arabic tashkeel)', () => {
    expect(matchesQuery('Záyed', 'zayed')).toBe(true);   // query plain, name accented
    expect(matchesQuery('Zayed', 'záyed')).toBe(true);   // query accented, name plain
    expect(normalizeForSearch('مَنَامَة')).toBe(normalizeForSearch('منامة'));
  });

  it('an empty query matches everything', () => {
    expect(matchesQuery('anything', '')).toBe(true);
    expect(matchesQuery('anything', '   ')).toBe(true);
  });
});
