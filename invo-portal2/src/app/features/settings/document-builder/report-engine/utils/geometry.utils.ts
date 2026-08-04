import { Block } from '../core/types/block.types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Snap a value to the nearest multiple of `step`. Default 0.5mm. */
export function snap(value: number, step = 0.5): number {
  return Math.round(value / step) * step;
}

/** Clamp utility. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Bounding rect of a block in mm. */
export function blockRect(block: Block): Rect {
  return {
    x: block.position.x,
    y: block.position.y,
    width: block.size.width,
    height: block.size.height,
  };
}

/** Bounding rect of a set of blocks. */
export function unionRect(blocks: Block[]): Rect | null {
  if (blocks.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const b of blocks) {
    const r = blockRect(b);
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y + r.height > maxY) maxY = r.y + r.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Returns true if the two rects overlap. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/**
 * Compute alignment-guide candidates for a moving block, returned as 1-D
 * coordinate values keyed by axis. The canvas overlays a vertical/horizontal
 * line for each guide that the block currently snaps to.
 */
export interface AlignmentGuides {
  vertical: number[]; // x coordinates
  horizontal: number[]; // y coordinates
}

const GUIDE_TOLERANCE_MM = 0.5;

export function computeAlignmentGuides(
  moving: Rect,
  others: Block[],
): AlignmentGuides {
  const v: number[] = [];
  const h: number[] = [];
  const movingX = [moving.x, moving.x + moving.width / 2, moving.x + moving.width];
  const movingY = [moving.y, moving.y + moving.height / 2, moving.y + moving.height];
  for (const b of others) {
    const r = blockRect(b);
    const xs = [r.x, r.x + r.width / 2, r.x + r.width];
    const ys = [r.y, r.y + r.height / 2, r.y + r.height];
    for (const a of movingX) for (const t of xs) {
      if (Math.abs(a - t) <= GUIDE_TOLERANCE_MM) v.push(t);
    }
    for (const a of movingY) for (const t of ys) {
      if (Math.abs(a - t) <= GUIDE_TOLERANCE_MM) h.push(t);
    }
  }
  return { vertical: Array.from(new Set(v)), horizontal: Array.from(new Set(h)) };
}
