import { describe, it, expect } from 'vitest';
import { ListUrlStateHelper } from './list-helpers';

describe('ListUrlStateHelper sort params', () => {
  it('writes the sort to the address bar', () => {
    const p = ListUrlStateHelper.toQueryParams({ sortBy: { sortValue: 'name', sortDirection: 'desc' } });
    expect(p['sortBy']).toBe('name');
    expect(p['sortDir']).toBe('desc');
  });

  it('removes them when the sort is cleared (null drops a param when query params are merged)', () => {
    const p = ListUrlStateHelper.toQueryParams({ sortBy: undefined });
    expect('sortBy' in p && p['sortBy']).toBeNull();
    expect('sortDir' in p && p['sortDir']).toBeNull();
  });

  it('round-trips a sort through the URL', () => {
    const state = ListUrlStateHelper.fromQueryParams({ sortBy: 'name', sortDir: 'desc' }, { page: 1, pageSize: 20, searchTerm: '', filters: {}, visibleColumns: [] } as any);
    expect(state.sortBy).toEqual({ sortValue: 'name', sortDirection: 'desc' });
  });
});

describe('ListUrlStateHelper.validateRestoredSort', () => {
  const columns = [
    { key: 'name', sortable: true },
    { key: 'total', sortable: true },
    { key: 'notes', sortable: false },
    { key: 'status' }
  ];
  const on = { enabled: true };
  const withDefault = { enabled: true, defaultSort: { key: 'createdAt', direction: 'desc' as const } };

  it('accepts a key that is a sortable column', () => {
    expect(ListUrlStateHelper.validateRestoredSort({ sortValue: 'name', sortDirection: 'desc' }, columns, on))
      .toEqual({ sortValue: 'name', sortDirection: 'desc' });
  });

  it('ignores unknown keys, non-sortable columns, empty and non-string values', () => {
    for (const k of ['bogus', 'notes', 'status', '', undefined, null, ['name'], { a: 1 }, 42]) {
      expect(ListUrlStateHelper.validateRestoredSort({ sortValue: k, sortDirection: 'asc' }, columns, on)).toBeUndefined();
    }
    expect(ListUrlStateHelper.validateRestoredSort(undefined, columns, on)).toBeUndefined();
  });

  it('ignores injection-like strings (quotes, semicolons, comment markers)', () => {
    const attacks = [
      `name"; DROP TABLE users;--`, `name'`, `name; select 1`, `name--`, `name/*x*/`, `"name"`,
      `name OR 1=1`, ` name`, `name `, `Name`, 'na%6De', 'name\n', 'name\0', `1; --`
    ];
    for (const sortValue of attacks) {
      expect(ListUrlStateHelper.validateRestoredSort({ sortValue, sortDirection: 'asc' }, columns, on)).toBeUndefined();
    }
  });

  it('normalises the direction case-insensitively', () => {
    expect(ListUrlStateHelper.validateRestoredSort({ sortValue: 'name', sortDirection: 'DESC' }, columns, on)?.sortDirection).toBe('desc');
    expect(ListUrlStateHelper.validateRestoredSort({ sortValue: 'name', sortDirection: ' Asc ' }, columns, on)?.sortDirection).toBe('asc');
  });

  it('falls back to the default direction when missing or invalid', () => {
    expect(ListUrlStateHelper.validateRestoredSort({ sortValue: 'name' }, columns, on)?.sortDirection).toBe('asc');
    expect(ListUrlStateHelper.validateRestoredSort({ sortValue: 'name', sortDirection: 'sideways; --' }, columns, on)?.sortDirection).toBe('asc');
    expect(ListUrlStateHelper.validateRestoredSort({ sortValue: 'name' }, columns, withDefault)?.sortDirection).toBe('desc');
  });

  it('on a screen with a custom defaultSort accepts its key even if not a sortable column', () => {
    expect(ListUrlStateHelper.validateRestoredSort({ sortValue: 'createdAt', sortDirection: 'asc' }, columns, withDefault))
      .toEqual({ sortValue: 'createdAt', sortDirection: 'asc' });
    expect(ListUrlStateHelper.validateRestoredSort({ sortValue: 'bogus' }, columns, withDefault)).toBeUndefined();
  });

  it('ignores any restored sort when sorting is disabled', () => {
    expect(ListUrlStateHelper.validateRestoredSort({ sortValue: 'name', sortDirection: 'asc' }, columns, { enabled: false })).toBeUndefined();
  });
});
