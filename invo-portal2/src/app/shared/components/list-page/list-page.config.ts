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

/**
 * `countMode` (set per page with `<app-list-page [countMode]>`; default 'auto'):
 *  - 'auto'     the deferred behaviour above: the total is requested in parallel with every list load;
 *  - 'onDemand' no count request is made until the user asks for it (header "Count" pill or footer "Show total").
 *               Needs a `countSource` and `useDeferredCount` on; the list itself still sends `skipCount: true`.
 *
 * Switch a page WITHOUT a code change (overrides every page's `countMode`; remove the key for the page's own value):
 *   localStorage.setItem('invo.countMode', 'auto')        // or 'onDemand'
 *
 * `countStickyPerVisit` (default true): once the user has asked for a count during a page visit, later search /
 * filter / type changes request it automatically (debounced). In memory only; leaving the page or reloading resets it.
 *   localStorage.setItem('invo.countStickyPerVisit', 'false')
 */
export type CountMode = 'auto' | 'onDemand';
export const DEFAULT_COUNT_MODE: CountMode = 'auto';
export const DEFAULT_COUNT_STICKY_PER_VISIT = true;
/** Client-side timeout of one count request. */
export const COUNT_TIMEOUT_MS = 30_000;

export const listPageConfig = {
  /** The page's own mode unless `invo.countMode` overrides it. */
  resolveCountMode(pageMode: CountMode | undefined): CountMode {
    try {
      const v = localStorage.getItem('invo.countMode');
      if (v === 'auto' || v === 'onDemand') return v;
    } catch { /* storage unavailable: use the page's mode */ }
    return pageMode === 'onDemand' ? 'onDemand' : DEFAULT_COUNT_MODE;
  },
  get countStickyPerVisit(): boolean {
    try {
      const v = localStorage.getItem('invo.countStickyPerVisit');
      if (v === 'false') return false;
      if (v === 'true') return true;
    } catch { /* storage unavailable: use the default */ }
    return DEFAULT_COUNT_STICKY_PER_VISIT;
  },
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
