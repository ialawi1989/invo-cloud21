import { GRID_COLS, GRID_ROWS, type MenuSectionProduct } from '../services/menu-builder.types';

/**
 * Pure geometry of a section page: the fixed 6x6 grid, tiles that cover 1 or 2 cells in each direction.
 * Everything the store and the grid decide about "does it fit / where does it go" lives here so it can be tested without a DOM.
 */
export interface Rect { x: number; y: number; cols: number; rows: number }
export const SLOTS_PER_PAGE = GRID_COLS * GRID_ROWS;

/** Stable identity of a tile: the server id, or the local one given to tiles added in this session. */
export const tileKey = (p: MenuSectionProduct): string => p.id ?? (p as any).__tempId ?? `${p.x},${p.y}`;

export const onPage = (products: readonly MenuSectionProduct[], page: number) => products.filter((p) => p.page === page);

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.cols && b.x < a.x + a.cols && a.y < b.y + b.rows && b.y < a.y + a.rows;
}

export function insideGrid(r: Rect): boolean {
  return r.x >= 0 && r.y >= 0 && r.cols >= 1 && r.rows >= 1 && r.x + r.cols <= GRID_COLS && r.y + r.rows <= GRID_ROWS;
}

/** Does `rect` fit on the page: inside the grid and not on top of another tile (the tile `ignoreKey` is not counted). */
export function fits(products: readonly MenuSectionProduct[], page: number, rect: Rect, ignoreKey?: string): boolean {
  if (!insideGrid(rect)) return false;
  return !onPage(products, page).some((p) => tileKey(p) !== ignoreKey && rectsOverlap(rect, p));
}

/** The first free 1x1 (or `cols` x `rows`) spot, reading left to right, top to bottom. null = the page is full. */
export function firstEmptySlot(products: readonly MenuSectionProduct[], page: number, cols = 1, rows = 1): { x: number; y: number } | null {
  for (let y = 0; y <= GRID_ROWS - rows; y++) {
    for (let x = 0; x <= GRID_COLS - cols; x++) {
      if (fits(products, page, { x, y, cols, rows })) return { x, y };
    }
  }
  return null;
}

/** Cells in use on the page ("12 of 36 slots used"); a wide or tall tile counts for each cell it covers. */
export function slotsUsed(products: readonly MenuSectionProduct[], page: number): number {
  return onPage(products, page).reduce((n, p) => n + p.cols * p.rows, 0);
}

/** Is this product already on the page? (A product appears once per section page.) */
export function hasProduct(products: readonly MenuSectionProduct[], page: number, productId: string, ignoreKey?: string): boolean {
  return onPage(products, page).some((p) => p.productId === productId && tileKey(p) !== ignoreKey);
}

export type MovePlan =
  | { kind: 'moved' | 'swapped'; changes: Array<{ key: string; x: number; y: number }> }
  | { kind: 'blocked' };

/**
 * Move a tile to `to`. An empty destination is a plain move. A tile of exactly the same size there is swapped with.
 * Anything else (off the grid, partly on another tile, a different size) is blocked and nothing changes.
 */
export function planMove(products: readonly MenuSectionProduct[], page: number, key: string, to: { x: number; y: number }): MovePlan {
  const tile = onPage(products, page).find((p) => tileKey(p) === key);
  if (!tile) return { kind: 'blocked' };
  if (tile.x === to.x && tile.y === to.y) return { kind: 'blocked' };
  const dest: Rect = { x: to.x, y: to.y, cols: tile.cols, rows: tile.rows };
  if (!insideGrid(dest)) return { kind: 'blocked' };
  if (fits(products, page, dest, key)) return { kind: 'moved', changes: [{ key, x: to.x, y: to.y }] };
  const neighbour = onPage(products, page).find((p) => tileKey(p) !== key && p.x === to.x && p.y === to.y && p.cols === tile.cols && p.rows === tile.rows);
  if (neighbour) {
    return { kind: 'swapped', changes: [{ key, x: to.x, y: to.y }, { key: tileKey(neighbour), x: tile.x, y: tile.y }] };
  }
  return { kind: 'blocked' };
}

/** "Move to..." for keyboards: one cell up / down / left / right (a swap when a same-size tile is there). */
export function planStep(products: readonly MenuSectionProduct[], page: number, key: string, dir: 'up' | 'down' | 'left' | 'right'): MovePlan {
  const tile = onPage(products, page).find((p) => tileKey(p) === key);
  if (!tile) return { kind: 'blocked' };
  const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
  return planMove(products, page, key, { x: tile.x + dx, y: tile.y + dy });
}

/** 1-based slot number of a tile ("slot 4"), reading order. */
export const slotNumber = (p: Pick<MenuSectionProduct, 'x' | 'y'>): number => p.y * GRID_COLS + p.x + 1;
