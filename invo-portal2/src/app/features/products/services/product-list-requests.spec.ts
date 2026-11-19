import { describe, expect, it } from 'vitest';
import { buildChildrenBody, buildCountBody, buildRootListBody, transformProductFilters } from './product-list-requests';

const input = {
  page: 3,
  limit: 15,
  searchTerm: 'jacket',
  sortBy: { sortValue: 'name', sortDirection: 'asc' as const },
  filter: { types: 'kit', departmentId: 'd1', categoryId: 'c1', brandId: 'b1', tags: ['t1'] },
  columns: ['name', 'qty'],
};

describe('root list body', () => {
  it('sends skipCount: true while the deferred count is on', () => {
    const body = buildRootListBody(input, true);
    expect(body['skipCount']).toBe(true);
    expect(body['countOnly']).toBeUndefined();
    expect(body['page']).toBe(3);
    expect(body['limit']).toBe(15);
  });

  it('flag off: one normal request, no skipCount (count comes back in the response)', () => {
    const body = buildRootListBody(input, false);
    expect('skipCount' in body).toBe(false);
  });

  it('coerces a single URL-restored type into an array', () => {
    expect(buildRootListBody(input, true)['filter'].type).toEqual(['kit']);
  });
});

describe('count body', () => {
  const count = buildCountBody(input);

  it('has the same search, filters and type as the list', () => {
    expect(count['searchTerm']).toBe('jacket');
    expect(count['filter']).toEqual(buildRootListBody(input, true)['filter']);
    expect(count['filter']).toEqual(transformProductFilters(input.filter));
  });

  it('has no page, limit or sortBy (and the service adds countOnly)', () => {
    expect('page' in count).toBe(false);
    expect('limit' in count).toBe(false);
    expect('sortBy' in count).toBe(false);
  });
});

describe('child group body', () => {
  it('keeps the default response: no skipCount / countOnly', () => {
    const body = buildChildrenBody('p1', { page: 1, limit: 15 });
    expect('skipCount' in body).toBe(false);
    expect('countOnly' in body).toBe(false);
  });

  it('targets the parent id and keeps page >= 1, limit within 1..100', () => {
    expect(buildChildrenBody('p1', { page: 0, limit: 15 })['page']).toBe(1);
    expect(buildChildrenBody('p1', { page: -4, limit: 15 })['page']).toBe(1);
    expect(buildChildrenBody('p1', { page: 2, limit: 500 })['limit']).toBe(100);
    expect(buildChildrenBody('p1', { page: 2, limit: 0 })['limit']).toBe(1);
    expect(buildChildrenBody('p1', { page: 1, limit: 15 })['id']).toBe('p1');
  });

  it('sends only the filters the endpoint honours', () => {
    const f = buildChildrenBody('p1', { page: 1, limit: 15, filter: input.filter })['filter'];
    expect(Object.keys(f).sort()).toEqual(['categories', 'departments', 'type']);
  });

  it('omits an unsupported sort (qty, stockValue) instead of sending {}', () => {
    const body = buildChildrenBody('p1', { page: 1, limit: 15, sortBy: { sortValue: 'qty', sortDirection: 'desc' } });
    expect(body['sortBy']).toBeUndefined();
    expect(buildChildrenBody('p1', { page: 1, limit: 15, sortBy: { sortValue: 'name', sortDirection: 'desc' } })['sortBy'])
      .toEqual({ sortValue: 'name', sortDirection: 'desc' });
  });
});
