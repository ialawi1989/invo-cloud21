import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_USE_DEFERRED_COUNT, listPageConfig, MAX_PAGE_LIMIT } from './list-page.config';

function stubStorage(value: string | null | 'throws') {
  vi.stubGlobal('localStorage', {
    getItem: () => { if (value === 'throws') throw new Error('blocked'); return value; },
  });
}

describe('useDeferredCount flag', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is on by default', () => {
    stubStorage(null);
    expect(DEFAULT_USE_DEFERRED_COUNT).toBe(true);
    expect(listPageConfig.useDeferredCount).toBe(true);
  });

  it('can be switched off without a code change (localStorage override)', () => {
    stubStorage('false');
    expect(listPageConfig.useDeferredCount).toBe(false);
  });

  it('falls back to the default when storage is unavailable', () => {
    stubStorage('throws');
    expect(listPageConfig.useDeferredCount).toBe(true);
  });

  it('caps the page size at what the API accepts', () => {
    expect(MAX_PAGE_LIMIT).toBe(100);
  });
});
