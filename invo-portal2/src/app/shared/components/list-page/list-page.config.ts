/**
 * Switches for <app-list-page> and the lists built on it.
 *
 * `useDeferredCount` (default true): the list asks the API to skip counting (`skipCount: true`) so rows render at
 * once, and the total arrives separately from a `countOnly` request. Until it resolves the header pill and the
 * footer's "of N" show a skeleton; if it fails the list carries on with Previous / Next only.
 *
 * Turn it off WITHOUT a code change (the list then gets `count` in its normal response, as before):
 *   localStorage.setItem('invo.useDeferredCount', 'false')   // and reload; remove the key to go back to the default
 */
export const DEFAULT_USE_DEFERRED_COUNT = true;

export const listPageConfig = {
  get useDeferredCount(): boolean {
    try {
      const v = localStorage.getItem('invo.useDeferredCount');
      if (v === 'false') return false;
      if (v === 'true') return true;
    } catch { /* storage unavailable: use the default */ }
    return DEFAULT_USE_DEFERRED_COUNT;
  },
};

/** The API accepts 1..100 rows per page. */
export const MAX_PAGE_LIMIT = 100;
