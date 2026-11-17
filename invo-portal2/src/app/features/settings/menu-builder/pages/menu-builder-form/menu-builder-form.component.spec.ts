// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { BranchSettingsService } from '../../../services/branch-settings.service';
import { MenuBuilderService } from '../../services/menu-builder.service';
import type { Menu, MenuSection, MenuSectionProduct } from '../../services/menu-builder.types';
import { MenuBuilderStore } from '../../store/menu-builder.store';
import { MenuBuilderFormComponent } from './menu-builder-form.component';

const color = { colorName: 'Teal', borderColor: '#0a0', colorStart: '#0a0', colorEnd: '#0b0' };
const tile = (): MenuSectionProduct => ({ id: 't1', productId: 'p1', productName: 'Rice', page: 1, x: 0, y: 0, cols: 1, rows: 1, color: '', defaultImage: '', price: 5, mediaId: null });
const section = (id: string, name: string, products: MenuSectionProduct[] = []): MenuSection => ({ id, name, translation: {}, image: '', pages: 1, color, products });
const menu = (over: Partial<Menu> = {}): Menu => ({
  id: 'm1', name: 'Lunch', branchIds: ['b1'], priceLabelId: '', startAt: '09:00:00', endAt: '17:00:00', availableOnline: true, index: 0,
  sections: [section('s1', 'Rice', [tile()]), section('s2', 'Drinks')], ...over,
});

describe('MenuBuilderFormComponent (container logic)', () => {
  let svc: { getMenu: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn>; getPriceLabels: ReturnType<typeof vi.fn>; listMenuProducts: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let confirmAnswer: boolean;
  let confirmed: number;
  let cmp: MenuBuilderFormComponent;
  let store: MenuBuilderStore;

  async function setup(m: Menu = menu()) {
    svc = { getMenu: vi.fn().mockResolvedValue(m), save: vi.fn(), getPriceLabels: vi.fn().mockResolvedValue([]), listMenuProducts: vi.fn().mockResolvedValue({ list: [], count: 0 }) };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    confirmAnswer = true; confirmed = 0;
    TestBed.configureTestingModule({
      imports: [MenuBuilderFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: MenuBuilderService, useValue: svc },
        { provide: BranchSettingsService, useValue: { getList: vi.fn().mockResolvedValue({ list: [{ id: 'b1', name: 'Main' }] }) } },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'm1' }) } } },
        { provide: ToastService, useValue: toast },
        { provide: ModalService, useValue: { open: () => ({ afterClosed: async () => { confirmed++; return confirmAnswer; } }) } },
      ],
    });
    // Container logic only: the child components have their own specs.
    TestBed.overrideComponent(MenuBuilderFormComponent, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(MenuBuilderFormComponent);
    cmp = fixture.componentInstance;
    store = cmp.store;
    await cmp.ngOnInit();
    return fixture;
  }
  beforeEach(() => { TestBed.resetTestingModule(); document.body.innerHTML = ''; });

  describe('leaving with unsaved changes', () => {
    it('a clean form lets you leave, a dirty one asks (the route guard reads this)', async () => {
      await setup();
      expect(cmp.hasUnsavedChanges()).toBe(false);
      store.patch('name', 'Dinner');
      expect(cmp.hasUnsavedChanges()).toBe(true);
    });

    it('blocks closing the tab only when dirty', async () => {
      await setup();
      const clean = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
      cmp.onBeforeUnload(clean);
      expect(clean.defaultPrevented).toBe(false);
      store.patch('name', 'Dinner');
      const dirty = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
      cmp.onBeforeUnload(dirty);
      expect(dirty.defaultPrevented).toBe(true);
    });

    it('saving makes it clean again', async () => {
      await setup();
      store.patch('name', 'Dinner');
      svc.save.mockResolvedValue({ success: true, data: menu({ name: 'Dinner' }) });
      await cmp.save();
      expect(cmp.hasUnsavedChanges()).toBe(false);
      expect(toast.success).toHaveBeenCalledWith('COMMON.SAVED_OK');
    });
  });

  describe('deleting a section', () => {
    it('with products: asks first, and removes it only when confirmed', async () => {
      await setup();
      confirmAnswer = false;
      await cmp.deleteSection('s1');
      expect(confirmed).toBe(1);
      expect(store.sections().length).toBe(2);
      confirmAnswer = true;
      await cmp.deleteSection('s1');
      expect(store.sections().map((s) => s.name)).toEqual(['Drinks']);
      expect(toast.info).not.toHaveBeenCalled(); // no Undo snackbar for the confirmed path
    });

    it('empty: no question, removed straight away, with an Undo snackbar that brings it back', async () => {
      await setup();
      await cmp.deleteSection('s2');
      expect(confirmed).toBe(0);
      expect(store.sections().map((s) => s.name)).toEqual(['Rice']);
      const action = toast.info.mock.calls[0][3];
      expect(action.label).toBe('MENU_BUILDER.UNDO');
      action.run();
      expect(store.sections().map((s) => s.name)).toEqual(['Rice', 'Drinks']);
    });
  });

  describe('products', () => {
    it('removing a tile offers Undo', async () => {
      await setup();
      cmp.onTileRemove(store.pageProducts()[0]);
      expect(store.pageProducts()).toEqual([]);
      toast.info.mock.calls[0][3].run();
      expect(store.pageProducts().length).toBe(1);
    });

    it('a duplicate drop shows an inline message and places nothing', async () => {
      await setup();
      cmp.onProductDrop({ product: { id: 'p1', name: 'Rice' }, x: 3, y: 3 });
      expect(store.pageProducts().length).toBe(1);
      expect(cmp.notice()).toContain('MENU_BUILDER.GRID.DUPLICATE');
    });

    it('Enter on a search result fills the first empty slot', async () => {
      await setup();
      cmp.onPickResult({ id: 'p2', name: 'Soup' });
      expect(store.pageProducts().map((p) => p.productName)).toEqual(['Rice', 'Soup']);
      expect(cmp.notice()).toBeNull();
    });
  });

  describe('validation: scroll to the first invalid field', () => {
    function field(key: string): HTMLInputElement {
      const input = document.createElement('input');
      input.setAttribute('data-field', key);
      input.scrollIntoView = vi.fn();
      document.body.appendChild(input);
      return input;
    }

    it('saving with errors sends nothing, scrolls to the first bad field and focuses it', async () => {
      await setup();
      const name = field('name');
      const branches = field('branchIds');
      store.patch('name', '');
      store.patch('branchIds', []);
      await cmp.save();
      expect(svc.save).not.toHaveBeenCalled();
      await Promise.resolve();
      expect(name.scrollIntoView).toHaveBeenCalled();
      expect(document.activeElement).toBe(name);
      expect(branches.scrollIntoView).not.toHaveBeenCalled();
    });

    it('the first invalid is the branches when the name is fine', async () => {
      await setup();
      field('name');
      const branches = field('branchIds');
      store.patch('branchIds', []);
      await cmp.save();
      await Promise.resolve();
      expect(document.activeElement).toBe(branches);
    });

    it('a bad section name selects that section and asks for its name field', async () => {
      await setup();
      store.renameSection('s2', 'Rice'); // duplicate of s1
      const before = cmp.renameRequest();
      await cmp.save();
      await Promise.resolve();
      expect(store.selectedSectionId()).toBe('s2');
      expect(cmp.renameRequest()).toBe(before + 1);
    });
  });

  describe('product search', () => {
    it('asks the server for 20 results and shows them', async () => {
      await setup();
      svc.listMenuProducts.mockResolvedValue({ list: [{ id: 'p9', name: 'Cake', defaultImage: '', color: '', price: 7 }], count: 1 });
      await cmp.onQuery('cak');
      expect(svc.listMenuProducts).toHaveBeenCalledWith({ page: 1, limit: 20, searchTerm: 'cak' });
      expect(cmp.results()).toEqual([{ id: 'p9', name: 'Cake', defaultImage: '', color: '', price: 7 }]);
      expect(cmp.searching()).toBe(false);
    });
  });
});
