/**
 * Pure, dependency-free helpers for the branch-tabs selector — kept out of the
 * component file so they're unit-testable without an Angular test harness.
 */

/** The selector's display mode. */
export type BranchTabsMode = 'tabs' | 'dropdown' | 'sidebar';

/**
 * Resolve the effective display mode. `mode` wins when set; otherwise the
 * deprecated `dropdown` boolean maps `true` → `'dropdown'`, falling back to
 * `'tabs'`.
 */
export function resolveBranchMode(
  mode: BranchTabsMode | undefined,
  dropdown: boolean,
): BranchTabsMode {
  if (mode) return mode;
  return dropdown ? 'dropdown' : 'tabs';
}

/**
 * Normalise a string for search: lowercase + strip diacritics/combining marks
 * (so "Zayed" matches "Záyed" and Arabic tashkeel is ignored). NFD-decomposes
 * then drops every Unicode combining mark (`\p{M}` — Latin accents + Arabic
 * tashkeel).
 */
export function normalizeForSearch(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/** Case- and diacritic-insensitive substring match of `query` within `name`. */
export function matchesQuery(name: string, query: string): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  return normalizeForSearch(name).includes(q);
}

/** Per-branch fill state the host form reports for the completion indicator. */
export type BranchCompletion = 'done' | 'partial' | 'empty';
export type CompletionMap = Readonly<Record<string, BranchCompletion>>;

/**
 * Count done / total for the progress footer. Only branches present in `ids`
 * (the live directory) are counted, so stale completion entries for deleted
 * branches don't skew the total.
 */
export function progressCounts(
  completion: CompletionMap | null,
  ids: readonly string[],
): { done: number; total: number } {
  const total = ids.length;
  if (!completion) return { done: 0, total };
  let done = 0;
  for (const id of ids) if (completion[id] === 'done') done++;
  return { done, total };
}
