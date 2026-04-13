/**
 * Pagination helpers — pure functions, fully testable.
 */

/** A page-list entry. `'gap'` represents an ellipsis between page buttons. */
export type PageListEntry = number | 'gap';

/**
 * Build the windowed page list shown by the pagination control.
 *
 * Examples (siblingCount=1, boundaryCount=1):
 *   total=5,  current=3  → [1, 2, 3, 4, 5]
 *   total=20, current=1  → [1, 2, 3, 'gap', 20]
 *   total=20, current=10 → [1, 'gap', 9, 10, 11, 'gap', 20]
 *   total=20, current=20 → [1, 'gap', 18, 19, 20]
 *
 * The list is guaranteed to contain `current` exactly once and to be sorted.
 *
 * @param current        1-based current page
 * @param total          total number of pages
 * @param siblingCount   how many pages to show on each side of `current`
 * @param boundaryCount  how many pages to pin at the start and end
 */
export function buildPageList(
  current: number,
  total: number,
  siblingCount: number = 1,
  boundaryCount: number = 1,
): PageListEntry[] {
  if (total <= 0) return [];
  if (current < 1) current = 1;
  if (current > total) current = total;

  // If everything fits without truncation, just enumerate.
  // 2 ellipses + (boundary*2) + (sibling*2 + 1 for current) = compact threshold.
  const compactThreshold = 2 + boundaryCount * 2 + siblingCount * 2 + 1;
  if (total <= compactThreshold) {
    return range(1, total);
  }

  const startPages = range(1, Math.min(boundaryCount, total));
  const endPages   = range(Math.max(total - boundaryCount + 1, boundaryCount + 1), total);

  const siblingsStart = Math.max(
    Math.min(current - siblingCount, total - boundaryCount - siblingCount * 2 - 1),
    boundaryCount + 2,
  );
  const siblingsEnd = Math.min(
    Math.max(current + siblingCount, boundaryCount + siblingCount * 2 + 2),
    endPages.length > 0 ? endPages[0] - 2 : total - 1,
  );

  const out: PageListEntry[] = [];
  out.push(...startPages);

  if (siblingsStart > boundaryCount + 2) {
    out.push('gap');
  } else if (boundaryCount + 1 < total - boundaryCount) {
    out.push(boundaryCount + 1);
  }

  out.push(...range(siblingsStart, siblingsEnd));

  if (siblingsEnd < total - boundaryCount - 1) {
    out.push('gap');
  } else if (total - boundaryCount > boundaryCount) {
    out.push(total - boundaryCount);
  }

  out.push(...endPages);

  // Dedupe (some boundary cases produce overlaps).
  return dedupe(out);
}

function range(start: number, end: number): number[] {
  if (end < start) return [];
  const out = new Array<number>(end - start + 1);
  for (let i = 0; i < out.length; i++) out[i] = start + i;
  return out;
}

function dedupe(list: PageListEntry[]): PageListEntry[] {
  const out: PageListEntry[] = [];
  let lastNum = -Infinity;
  let lastWasGap = false;
  for (const entry of list) {
    if (entry === 'gap') {
      if (!lastWasGap) {
        out.push('gap');
        lastWasGap = true;
      }
    } else {
      if (entry > lastNum) {
        out.push(entry);
        lastNum = entry;
        lastWasGap = false;
      }
    }
  }
  return out;
}
