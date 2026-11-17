import { describe, it, expect } from 'vitest';
import type { MenuSectionProduct } from '../services/menu-builder.types';
import { firstEmptySlot, fits, hasProduct, planMove, planStep, rectsOverlap, slotNumber, slotsUsed } from './menu-layout';

const t = (key: string, x: number, y: number, over: Partial<MenuSectionProduct> = {}): MenuSectionProduct =>
  ({ id: key, productId: 'p-' + key, productName: key, page: 1, x, y, cols: 1, rows: 1, color: '', defaultImage: '', price: null, mediaId: null, ...over });

describe('menu layout (6x6)', () => {
  it('detects overlapping footprints', () => {
    expect(rectsOverlap({ x: 0, y: 0, cols: 2, rows: 1 }, { x: 1, y: 0, cols: 1, rows: 1 })).toBe(true);
    expect(rectsOverlap({ x: 0, y: 0, cols: 1, rows: 1 }, { x: 1, y: 0, cols: 1, rows: 1 })).toBe(false);
  });

  it('fits only inside the grid and off other tiles', () => {
    const list = [t('a', 0, 0)];
    expect(fits(list, 1, { x: 5, y: 5, cols: 1, rows: 1 })).toBe(true);
    expect(fits(list, 1, { x: 6, y: 0, cols: 1, rows: 1 })).toBe(false);
    expect(fits(list, 1, { x: 5, y: 0, cols: 2, rows: 1 })).toBe(false);
    expect(fits(list, 1, { x: 0, y: 0, cols: 1, rows: 1 })).toBe(false);
    expect(fits(list, 1, { x: 0, y: 0, cols: 1, rows: 1 }, 'a')).toBe(true); // the tile itself is ignored
    expect(fits(list, 2, { x: 0, y: 0, cols: 1, rows: 1 })).toBe(true); // another page
  });

  it('finds the first empty slot, left to right then down, and null when full', () => {
    expect(firstEmptySlot([t('a', 0, 0), t('b', 1, 0)], 1)).toEqual({ x: 2, y: 0 });
    const full = Array.from({ length: 36 }, (_, i) => t('t' + i, i % 6, Math.floor(i / 6)));
    expect(firstEmptySlot(full, 1)).toBeNull();
    expect(slotsUsed(full, 1)).toBe(36);
  });

  it('a wide tile counts for each cell', () => {
    expect(slotsUsed([t('a', 0, 0, { cols: 2, rows: 2 })], 1)).toBe(4);
  });

  it('knows a product is on a page', () => {
    expect(hasProduct([t('a', 0, 0)], 1, 'p-a')).toBe(true);
    expect(hasProduct([t('a', 0, 0)], 2, 'p-a')).toBe(false);
    expect(hasProduct([t('a', 0, 0)], 1, 'p-a', 'a')).toBe(false);
  });

  describe('planMove', () => {
    it('moves to an empty cell', () => {
      expect(planMove([t('a', 0, 0)], 1, 'a', { x: 3, y: 3 })).toEqual({ kind: 'moved', changes: [{ key: 'a', x: 3, y: 3 }] });
    });
    it('swaps with a same-size tile', () => {
      const plan = planMove([t('a', 0, 0), t('b', 2, 0)], 1, 'a', { x: 2, y: 0 });
      expect(plan).toEqual({ kind: 'swapped', changes: [{ key: 'a', x: 2, y: 0 }, { key: 'b', x: 0, y: 0 }] });
    });
    it('is blocked by a tile of another size, off the grid, or onto itself', () => {
      expect(planMove([t('a', 0, 0), t('b', 2, 0, { cols: 2 })], 1, 'a', { x: 2, y: 0 }).kind).toBe('blocked');
      expect(planMove([t('a', 0, 0)], 1, 'a', { x: 6, y: 0 }).kind).toBe('blocked');
      expect(planMove([t('a', 0, 0)], 1, 'a', { x: 0, y: 0 }).kind).toBe('blocked');
      expect(planMove([t('a', 5, 0, { cols: 2 })], 1, 'a', { x: 5, y: 1 }).kind).toBe('blocked');
    });
  });

  it('steps a cell at a time', () => {
    expect(planStep([t('a', 2, 2)], 1, 'a', 'left')).toEqual({ kind: 'moved', changes: [{ key: 'a', x: 1, y: 2 }] });
    expect(planStep([t('a', 0, 0)], 1, 'a', 'up').kind).toBe('blocked');
  });

  it('numbers slots 1 to 36 in reading order', () => {
    expect(slotNumber({ x: 0, y: 0 })).toBe(1);
    expect(slotNumber({ x: 3, y: 0 })).toBe(4);
    expect(slotNumber({ x: 5, y: 5 })).toBe(36);
  });
});
