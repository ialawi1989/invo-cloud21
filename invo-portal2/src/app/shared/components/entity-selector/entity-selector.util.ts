/**
 * Pure, dependency-free helpers for the entity selector — kept out of the
 * component file so they're unit-testable without an Angular test harness.
 */

/** The selector's display mode. */
export type SelectorMode = 'tabs' | 'dropdown' | 'sidebar';

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

/** Case- and diacritic-insensitive substring match of `query` within `text`. */
export function matchesQuery(text: string, query: string): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  return normalizeForSearch(text).includes(q);
}

/** Per-item fill state the host reports for the completion indicator. */
export type EntityCompletion = 'done' | 'partial' | 'empty';
export type CompletionMap = Readonly<Record<string, EntityCompletion>>;

/**
 * Count done / total for the progress footer. Only ids present in `ids`
 * (the live directory) are counted, so stale completion entries for deleted
 * items don't skew the total.
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
