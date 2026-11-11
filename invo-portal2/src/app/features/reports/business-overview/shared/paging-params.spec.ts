import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { PAGING_PARAMS, pickPageSize, pickSort } from './paging-params';

describe('paging params', () => {
  it('defaults are not written to the URL', () => {
    expect(PAGING_PARAMS.page.codec.encode(1)).toBeNull();
    expect(PAGING_PARAMS.limit.codec.encode(25)).toBeNull();
    expect(PAGING_PARAMS.sortDirection.codec.encode('asc')).toBeNull();
    expect(PAGING_PARAMS.sortBy.codec.encode('')).toBeNull();
  });
  it('anything else is written and read back', () => {
    expect(PAGING_PARAMS.page.codec.encode(3)).toBe('3');
    expect(PAGING_PARAMS.page.codec.decode('3')).toBe(3);
    expect(PAGING_PARAMS.limit.codec.encode(50)).toBe('50');
    expect(PAGING_PARAMS.limit.codec.decode('50')).toBe(50);
    expect(PAGING_PARAMS.sortDirection.codec.encode('desc')).toBe('desc');
  });
  it('garbage falls back to the defaults', () => {
    expect(PAGING_PARAMS.page.codec.decode('abc')).toBe(1);
    expect(PAGING_PARAMS.limit.codec.decode('x')).toBe(25);
    expect(PAGING_PARAMS.sortDirection.codec.decode('sideways')).toBe('asc');
  });
  it('page size must be one the page offers', () => {
    expect(pickPageSize(50, [10, 25, 50, 100])).toBe(50);
    expect(pickPageSize(7, [10, 25, 50, 100])).toBe(25);
    expect(pickPageSize(7, [15, 50])).toBe(15);
  });
  it('sort must be a sortable column', () => {
    expect(pickSort('Debit', 'desc', ['Debit', 'Credit'])).toEqual({ sortValue: 'Debit', sortDirection: 'desc' });
    expect(pickSort('createdAt', 'asc', ['Debit'])).toBeNull();
    expect(pickSort('', 'asc', ['Debit'])).toBeNull();
  });
});
