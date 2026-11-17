// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { MenuBuilderService } from '../services/menu-builder.service';
import type { Menu, MenuSection, MenuSectionProduct } from '../services/menu-builder.types';
import { MenuBuilderStore, idOf } from './menu-builder.store';

const color = { colorName: 'Teal', borderColor: '#0a0', colorStart: '#0a0', colorEnd: '#0b0' };
const tile = (over: Partial<MenuSectionProduct> = {}): MenuSectionProduct => ({
  id: null, productId: 'p1', productName: 'Rice', page: 1, x: 0, y: 0, cols: 1, rows: 1, color: '', defaultImage: '', price: 5, mediaId: null, ...over,
});
const section = (name: string, id: string, products: MenuSectionProduct[] = []): MenuSection => ({
  id, name, translation: {}, image: '', pages: 1, color, products,
});
const menu = (over: Partial<Menu> = {}): Menu => ({
  id: 'm1', name: 'Lunch', branchIds: ['b1'], priceLabelId: '', startAt: '09:00:00', endAt: '17:00:00', availableOnline: true, index: 0,
  sections: [section('Rice', 's1', [tile({ id: 't1', productId: 'p1' })]), section('Drinks', 's2'), section('Salads', 's3')], ...over,
});

describe('MenuBuilderStore', () => {
  let store: MenuBuilderStore;
  let svc: { getMenu: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };

  async function setup(m: Menu = menu()) {
    svc = { getMenu: vi.fn().mockResolvedValue(m), save: vi.fn() };
    TestBed.configureTestingModule({ providers: [MenuBuilderStore, { provide: MenuBuilderService, useValue: svc }] });
    store = TestBed.inject(MenuBuilderStore);
    await store.load(m.id);
  }
  beforeEach(() => TestBed.resetTestingModule());
  const names = () => store.sections().map((s) => s.name);
  const sel = () => store.selectedSection()!;

  describe('loading and dirty', () => {
    it('opens the first section and is not dirty', async () => {
      await setup();
      expect(store.selectedSectionId()).toBe('s1');
      expect(store.isDirty()).toBe(false);
    });

    it('any edit makes it dirty; undoing it by hand makes it clean again', async () => {
      await setup();
      store.patch('name', 'Dinner');
      expect(store.isDirty()).toBe(true);
      store.patch('name', 'Lunch');
      expect(store.isDirty()).toBe(false);
    });
  });

  describe('sections', () => {
    it('adds "New section" at the end, selects it and returns its id', async () => {
      await setup();
      const id = store.addSection('New section');
      expect(names()).toEqual(['Rice', 'Drinks', 'Salads', 'New section']);
      expect(store.selectedSectionId()).toBe(id);
      expect(store.isDirty()).toBe(true);
    });

    it('renames a section', async () => {
      await setup();
      store.renameSection('s2', 'Beverages');
      expect(names()).toEqual(['Rice', 'Beverages', 'Salads']);
    });

    it('rejects a duplicate name inline, ignoring case and spaces', async () => {
      await setup();
      store.renameSection('s2', ' rice ');
      expect(store.errors()['section:s2']).toBe('DUPLICATE_NAME');
      store.renameSection('s2', 'Beverages');
      expect(store.errors()['section:s2']).toBeUndefined();
    });

    it('an empty name is an error', async () => {
      await setup();
      store.renameSection('s2', '  ');
      expect(store.errors()['section:s2']).toBe('SECTION_REQUIRED');
    });

    it('reorders: the new order is the array order that gets saved', async () => {
      await setup();
      store.moveSection(0, 2);
      expect(names()).toEqual(['Drinks', 'Salads', 'Rice']);
      store.moveSection(2, 0);
      expect(names()).toEqual(['Rice', 'Drinks', 'Salads']);
      store.moveSection(0, 9); // out of range: ignored
      expect(names()).toEqual(['Rice', 'Drinks', 'Salads']);
    });

    it('deletes an empty section and Undo puts it back where it was', async () => {
      await setup();
      const removed = store.deleteSection('s2')!;
      expect(names()).toEqual(['Rice', 'Salads']);
      store.restoreSection(removed.section, removed.index);
      expect(names()).toEqual(['Rice', 'Drinks', 'Salads']);
      expect(store.selectedSectionId()).toBe('s2');
    });

    it('deleting the selected section selects its neighbour', async () => {
      await setup();
      store.select('s2');
      store.deleteSection('s2');
      expect(store.selectedSectionId()).toBe('s3');
      store.deleteSection('s3');
      expect(store.selectedSectionId()).toBe('s1');
    });

    it('deleting a section with products removes them from the menu', async () => {
      await setup();
      const removed = store.deleteSection('s1')!;
      expect(removed.section.products.length).toBe(1);
      expect(store.sections().flatMap((s) => s.products)).toEqual([]);
    });

    it('duplicates client-side: a copy with its own ids, selected, right after the original', async () => {
      await setup();
      const id = store.duplicateSection('s1')!;
      expect(names()).toEqual(['Rice', 'Rice (copy)', 'Drinks', 'Salads']);
      const copy = store.sections()[1];
      expect(idOf(copy)).toBe(id);
      expect(copy.id).toBeNull();
      expect(copy.products[0].id).toBeNull();
      expect(copy.products[0].productName).toBe('Rice');
      expect(store.selectedSectionId()).toBe(id);
      expect(store.duplicateSection('s1')).toBeTruthy();
      expect(names()).toContain('Rice (copy 2)');
    });

    it('counts the empty sections for the warning line', async () => {
      await setup();
      expect(store.emptySectionCount()).toBe(2);
    });
  });

  describe('products', () => {
    it('places a product in the first empty slot and counts the slots', async () => {
      await setup();
      const r = store.placeProduct({ id: 'p2', name: 'Soup' });
      expect(r.ok).toBe(true);
      expect(store.pageProducts().map((p) => [p.productName, p.x, p.y])).toEqual([['Rice', 0, 0], ['Soup', 1, 0]]);
      expect(store.slotsUsed()).toBe(2);
    });

    it('places a product at the cell it was dropped on', async () => {
      await setup();
      store.placeProduct({ id: 'p2', name: 'Soup' }, { x: 3, y: 2 });
      expect(store.pageProducts().find((p) => p.productName === 'Soup')).toMatchObject({ x: 3, y: 2 });
    });

    it('refuses a product that is already on the page, with the reason', async () => {
      await setup();
      const r = store.placeProduct({ id: 'p1', name: 'Rice again' });
      expect(r).toEqual({ ok: false, reason: 'duplicate' });
      expect(store.pageProducts().length).toBe(1);
    });

    it('the same product may sit on another page of the section, or in another section', async () => {
      await setup();
      store.select('s2');
      expect(store.placeProduct({ id: 'p1', name: 'Rice' }).ok).toBe(true);
    });

    it('refuses a drop on a taken cell', async () => {
      await setup();
      expect(store.placeProduct({ id: 'p2', name: 'Soup' }, { x: 0, y: 0 })).toEqual({ ok: false, reason: 'occupied' });
    });

    it('refuses when the page is full', async () => {
      await setup();
      for (let i = 0; i < 35; i++) store.placeProduct({ id: 'x' + i, name: 'X' + i });
      expect(store.slotsUsed()).toBe(36);
      expect(store.placeProduct({ id: 'late', name: 'Late' })).toEqual({ ok: false, reason: 'full' });
    });

    it('moves a tile to an empty cell', async () => {
      await setup();
      const r = store.moveProduct('t1', { x: 4, y: 4 });
      expect(r.kind).toBe('moved');
      expect(store.pageProducts()[0]).toMatchObject({ x: 4, y: 4 });
    });

    it('swaps two tiles of the same size', async () => {
      await setup();
      store.placeProduct({ id: 'p2', name: 'Soup' }); // at 1,0
      const soupKey = idOf(store.pageProducts().find((p) => p.productName === 'Soup'));
      const r = store.moveProduct('t1', { x: 1, y: 0 });
      expect(r.kind).toBe('swapped');
      expect(store.pageProducts().find((p) => p.id === 't1')).toMatchObject({ x: 1, y: 0 });
      expect(store.pageProducts().find((p) => idOf(p) === soupKey)).toMatchObject({ x: 0, y: 0 });
    });

    it('refuses a move off the grid and leaves the tile where it was', async () => {
      await setup();
      expect(store.moveProduct('t1', { x: 9, y: 0 }).kind).toBe('blocked');
      expect(store.pageProducts()[0]).toMatchObject({ x: 0, y: 0 });
    });

    it('steps a tile one cell for keyboard users, and stops at the edge', async () => {
      await setup();
      expect(store.stepProduct('t1', 'right').kind).toBe('moved');
      expect(store.pageProducts()[0].x).toBe(1);
      expect(store.stepProduct('t1', 'up').kind).toBe('blocked');
    });

    it('removes a tile and Undo puts it back in its slot', async () => {
      await setup();
      const removed = store.removeProduct('t1')!;
      expect(store.pageProducts()).toEqual([]);
      expect(store.restoreProduct(removed)).toBe(true);
      expect(store.pageProducts()[0]).toMatchObject({ productName: 'Rice', x: 0, y: 0 });
    });

    it('Undo uses the first empty slot when its own was taken meanwhile', async () => {
      await setup();
      const removed = store.removeProduct('t1')!;
      store.placeProduct({ id: 'p2', name: 'Soup' }, { x: 0, y: 0 });
      store.restoreProduct(removed);
      expect(store.pageProducts().find((p) => p.productName === 'Rice')).toMatchObject({ x: 1, y: 0 });
    });

    it('resizes to 2 wide only when there is room', async () => {
      await setup();
      expect(store.resizeProduct('t1', 2, 1)).toBe(true);
      expect(store.slotsUsed()).toBe(2);
      store.placeProduct({ id: 'p2', name: 'Soup' }, { x: 3, y: 0 });
      expect(store.resizeProduct('t1', 4, 1)).toBe(false);
    });
  });

  describe('pages', () => {
    it('adds a page only when the last one has a product, and drops a page with its products', async () => {
      await setup();
      expect(store.canAddPage()).toBe(true);
      store.addPage();
      expect(sel().pages).toBe(2);
      expect(store.selectedPage()).toBe(2);
      expect(store.canAddPage()).toBe(false); // page 2 is empty
      store.placeProduct({ id: 'p9', name: 'Cake' });
      const removed = store.removePage(2);
      expect(removed.length).toBe(1);
      expect(sel().pages).toBe(1);
      expect(store.selectedPage()).toBe(1);
    });
  });

  describe('save', () => {
    it('does not call the server while the form is invalid, and shows the errors', async () => {
      await setup();
      store.patch('name', ' ');
      expect(await store.save()).toBe('invalid');
      expect(svc.save).not.toHaveBeenCalled();
      expect(store.errors()['name']).toBe('REQUIRED');
    });

    it('needs a branch, and an end time different from the start', async () => {
      await setup();
      store.patch('branchIds', []);
      store.patch('endAt', '09:00:00');
      await store.save();
      expect(store.errors()['branchIds']).toBe('REQUIRED');
      expect(store.errors()['endAt']).toBe('SAME_AS_START');
    });

    it('an overnight window (end earlier than start) is valid', async () => {
      await setup();
      store.patch('startAt', '18:00:00');
      store.patch('endAt', '02:00:00');
      svc.save.mockResolvedValue({ success: true, data: menu({ startAt: '18:00:00', endAt: '02:00:00' }) });
      expect(await store.save()).toBe('saved');
    });

    it('saves once, then loads the saved menu (new ids) and is clean', async () => {
      await setup();
      store.patch('name', 'Dinner');
      svc.save.mockResolvedValue({ success: true, data: null });
      svc.getMenu.mockResolvedValue(menu({ name: 'Dinner' }));
      expect(await store.save()).toBe('saved');
      expect(svc.save).toHaveBeenCalledTimes(1);
      expect(store.isDirty()).toBe(false);
      expect(store.menu().name).toBe('Dinner');
      expect(store.saving()).toBe(false);
    });

    it('a new menu: loads it by the id the server returned', async () => {
      await setup();
      store.menu.update((m) => ({ ...m, id: null })); // a menu that has not been saved yet
      svc.save.mockResolvedValue({ success: true, data: null, id: 'new1' });
      svc.getMenu.mockResolvedValue(menu({ id: 'new1' }));
      expect(await store.save()).toBe('saved');
      expect(svc.getMenu).toHaveBeenLastCalledWith('new1');
      expect(store.menu().id).toBe('new1');
    });

    it('uses the saved menu when the server sends it whole', async () => {
      await setup();
      store.patch('name', 'Dinner');
      svc.save.mockResolvedValue({ success: true, data: menu({ name: 'Dinner' }) });
      expect(await store.save()).toBe('saved');
      expect(svc.getMenu).toHaveBeenCalledTimes(1); // only the first load
      expect(store.isDirty()).toBe(false);
    });

    it('when the server refuses, keeps the edits and reports why', async () => {
      await setup();
      store.patch('name', 'Dinner');
      svc.save.mockResolvedValue({ success: false, message: 'Menu Name Already used' });
      expect(await store.save()).toBe('failed');
      expect(store.menu().name).toBe('Dinner');
      expect(store.isDirty()).toBe(true);
      expect(store.errors()['_general']).toBe('Menu Name Already used');
    });
  });
});
