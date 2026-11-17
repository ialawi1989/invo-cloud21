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
