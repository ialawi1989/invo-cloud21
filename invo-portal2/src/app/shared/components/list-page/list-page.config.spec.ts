import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_USE_DEFERRED_COUNT, listPageConfig, MAX_PAGE_LIMIT } from './list-page.config';

function stubStorage(value: string | null | 'throws') {
  vi.stubGlobal('localStorage', {
    getItem: () => { if (value === 'throws') throw new Error('blocked'); return value; },
  });
}

describe('countMode / countStickyPerVisit', () => {
  afterEach(() => vi.unstubAllGlobals());

  it("a page's own mode is used by default; the default for other pages is 'auto'", () => {
    stubStorage(null);
    expect(listPageConfig.resolveCountMode(undefined)).toBe('auto');
    expect(listPageConfig.resolveCountMode('auto')).toBe('auto');
    expect(listPageConfig.resolveCountMode('onDemand')).toBe('onDemand');
  });

  it("localStorage 'invo.countMode' overrides the page (switch Products back to auto without a code change)", () => {
    stubStorage('auto');
    expect(listPageConfig.resolveCountMode('onDemand')).toBe('auto');
    stubStorage('onDemand');
    expect(listPageConfig.resolveCountMode('auto')).toBe('onDemand');
  });

  it('ignores an unknown value and unavailable storage', () => {
    stubStorage('banana');
    expect(listPageConfig.resolveCountMode('onDemand')).toBe('onDemand');
    stubStorage('throws');
    expect(listPageConfig.resolveCountMode('onDemand')).toBe('onDemand');
  });

  it('sticky is on by default and can be turned off', () => {
    stubStorage(null);
    expect(listPageConfig.countStickyPerVisit).toBe(true);
    stubStorage('false');
    expect(listPageConfig.countStickyPerVisit).toBe(false);
    stubStorage('throws');
    expect(listPageConfig.countStickyPerVisit).toBe(true);
  });
});

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
