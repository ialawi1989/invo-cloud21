import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CompanyService } from '../../../../core/auth/company.service';
import { PrivilegeService } from '../../../../core/auth/privileges/privilege.service';
import { MODAL_DATA, MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ProductsService } from '../../services/products.service';
import { ProductDetailDrawerComponent, ProductDetailDrawerData, ProductDrawerNav } from './product-detail-drawer.component';

const T = {
  PRODUCTS: {
    TYPES: { INVENTORY: 'Inventory', MATRIX: 'Matrix', MENU_ITEM: 'Menu Item' },
    TREE: { UNITS: 'Units', VARIANTS: 'Variants', UNITS_N: '{{count}} units', UNITS_ONE: '1 unit', VARIANTS_N: '{{count}} variants', VARIANTS_ONE: '1 variant' },
    FIELDS: { NAME: 'Name', SKU: 'SKU', TYPE: 'Type', QTY: 'Qty', PRICE: 'Price' },
    DRAWER: { NAVIGATE: 'Browse products', PREVIOUS: 'Previous product', NEXT: 'Next product', TABS: { OVERVIEW: 'Overview', PURCHASE: 'Purchase', MOVEMENT: 'Movement', SALES: 'Sales' } },
  },
  COMMON: { LP_TREE_SHOW_MORE_PLAIN: 'Show more', LP_TREE_LOAD_ERROR: "Couldn't load children", LP_TREE_RETRY: 'Retry', LP_TREE_NO_CHILDREN: 'No children', LP_RETRY: 'Retry', ACTIONS: { EDIT: 'Edit' } },
};

const product = (id: string, over: Record<string, any> = {}) => ({ id, name: 'WIDGET ' + id.toUpperCase(), type: 'inventory', defaultPrice: 10, ...over });
const child = (n: number) => ({ id: 'c' + n, name: 'CHILD ' + n, type: 'inventory', qty: n, defaultPrice: 2.5, SKU: 'SKU-' + n });

describe('<app-product-detail-drawer>', () => {
  let fixture: ComponentFixture<ProductDetailDrawerComponent>;
  let svc: { getProduct: any; getProductAvailability: any; getProductActivity: any; productChildsList: any };
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const settle = async () => { for (let i = 0; i < 5; i++) { await new Promise(r => setTimeout(r, 0)); fixture.detectChanges(); } };
  const btn = (label: string) => el().querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
  const section = () => el().querySelector('app-product-children');

  async function open(data: Partial<ProductDetailDrawerData> & { productId: string }) {
    TestBed.configureTestingModule({
      imports: [ProductDetailDrawerComponent, TranslateModule.forRoot()],
      providers: [
        { provide: MODAL_DATA, useValue: data },
        { provide: MODAL_REF, useValue: { dismiss: vi.fn(), close: vi.fn() } },
        { provide: ProductsService, useValue: svc },
        { provide: PrivilegeService, useValue: { check: () => true } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: CompanyService, useValue: { settings: () => ({ settings: { currencySymbol: 'BHD', afterDecimal: 3 } }) } },
      ],
    });
    const t = TestBed.inject(TranslateService);
    t.setTranslation('en', T);
    t.use('en');
    fixture = TestBed.createComponent(ProductDetailDrawerComponent);
    fixture.detectChanges();
    await settle();
  }

  beforeEach(() => {
    svc = {
      getProduct: vi.fn(async (id: string) => product(id)),
      getProductAvailability: vi.fn(async () => []),
      getProductActivity: vi.fn(async () => null),
      productChildsList: vi.fn(async () => ({ list: [], count: 0, hasNext: false })),
    };
  });
  afterEach(() => TestBed.resetTestingModule());

  describe('formatting matches the list', () => {
    it('shows the price with the company currency, the capitalised type label and a title-cased name', async () => {
      svc.getProduct.mockResolvedValue(product('p1', { name: 'ACME WIDGET', type: 'menuItem', defaultPrice: 10 }));
      await open({ productId: 'p1' });
      expect(text()).toContain('BHD 10.000');
      expect(text()).toContain('Menu Item');
      expect(text()).not.toContain('menuItem');
      expect(el().querySelector('.head-title')!.textContent!.trim()).toBe('Acme Widget');
    });
  });

  describe('Units / Variants section', () => {
    it('parent (Check 1): lazily loads children with the list\'s request body, skeleton first, rows with SKU chip, type, qty and price', async () => {
      let resolve!: (v: any) => void;
      svc.productChildsList.mockReturnValueOnce(new Promise(r => (resolve = r)));
      await open({ productId: 'check1', row: { id: 'check1', isParent: true, type: 'inventory' } });

      expect(section()).toBeTruthy();
      expect(el().querySelectorAll('.row--skeleton').length).toBe(3);
      expect(svc.productChildsList).toHaveBeenCalledTimes(1);
      // Same endpoint payload as the list: parent id, page 1, the tree's page size of 15, no search, no sort.
      expect(svc.productChildsList.mock.calls[0][0]).toEqual({
        id: 'check1', page: 1, limit: 15, searchTerm: '', sortBy: undefined, filter: { departments: [], categories: [], type: [] },
      });

      resolve({ list: [child(1), child(2)], count: 2, hasNext: false });
      await settle();
      expect(el().querySelectorAll('.row--skeleton').length).toBe(0);
      const rows = el().querySelectorAll('.row--item');
      expect(rows.length).toBe(2);
      const first = rows[0].textContent!.replace(/\s+/g, ' ');
      expect(first).toContain('Child 1');           // title-cased like the list
      expect(first).toContain('SKU-1');
      expect(rows[0].querySelector('.app-product-badge--sku')).toBeTruthy();
      expect(first).toContain('Inventory');
      expect(first).toContain('BHD 2.500');
      expect(text()).toContain('2 units');
    });

    it('never adds child quantities into the parent: Branch Stock totals only the parent\'s own stock', async () => {
      svc.getProductAvailability.mockResolvedValue([{ branchId: 'b1', branch: 'Main', onHand: 5, stockValue: 50, reorderLevel: 1, status: 'In Stock' }]);
      svc.productChildsList.mockResolvedValue({ list: [child(1), child(2), child(3)], count: 3, hasNext: false });
      await open({ productId: 'p', row: { id: 'p', isParent: true } });
      const total = el().querySelector('tfoot')!.textContent!.replace(/\s+/g, ' ');
      expect(total).toContain('5');
      expect(total).not.toContain('11');   // 5 + (1+2+3) would be 11
    });

    it('"Show more" loads the next page and disappears when hasNext is false', async () => {
      svc.productChildsList
        .mockResolvedValueOnce({ list: [child(1)], count: 2, hasNext: true })
        .mockResolvedValueOnce({ list: [child(2)], count: 2, hasNext: false });
      await open({ productId: 'p', row: { id: 'p', isParent: true } });
      const more = () => el().querySelector('.more-row') as HTMLButtonElement | null;
      expect(more()).toBeTruthy();
      more()!.click();
      await settle();
      expect(svc.productChildsList.mock.calls[1][0].page).toBe(2);
      expect(el().querySelectorAll('.row--item').length).toBe(2);
      expect(more()).toBeNull();
    });

    it('a failed load shows an inline error and Retry loads again', async () => {
      svc.productChildsList.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ list: [child(1)], count: 1, hasNext: false });
      await open({ productId: 'p', row: { id: 'p', isParent: true } });
      expect(el().querySelector('.inline-state--error')!.textContent).toContain("Couldn't load children");
      (el().querySelector('.inline-state--error .link-btn') as HTMLButtonElement).click();
      await settle();
      expect(el().querySelectorAll('.row--item').length).toBe(1);
      expect(el().querySelector('.inline-state--error')).toBeNull();
    });

    it('normal product with no children: no section and no children request', async () => {
      await open({ productId: 'plain', row: { id: 'plain', isParent: false } });
      expect(section()).toBeNull();
      expect(svc.productChildsList).not.toHaveBeenCalled();
    });

    it('matrix product: shows "Variants" even though its row has no isParent', async () => {
      svc.getProduct.mockResolvedValue(product('m1', { type: 'matrix' }));
      svc.productChildsList.mockResolvedValue({ list: [child(1)], count: 1, hasNext: false });
      await open({ productId: 'm1', row: { id: 'm1', type: 'matrix', isParent: null } });
      expect(section()).toBeTruthy();
      expect(el().querySelector('app-product-children .card-head')!.textContent).toContain('Variants');
      expect(text()).toContain('1 variant');
    });

    it('choosing a child opens it in the same drawer', async () => {
      svc.productChildsList.mockResolvedValue({ list: [child(1)], count: 1, hasNext: false });
      await open({ productId: 'p', row: { id: 'p', isParent: true } });
      (el().querySelector('.row--item') as HTMLButtonElement).click();
      await settle();
      expect(svc.getProduct).toHaveBeenLastCalledWith('c1');
      expect(el().querySelector('.head-title')!.textContent).toContain('Widget C1');
    });
  });

  describe('Previous / Next', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    let nav: ProductDrawerNav;
    beforeEach(() => { nav = { rows: () => rows, activated: vi.fn() }; });

    it('has no buttons when the list gave no navigation', async () => {
      await open({ productId: 'a' });
      expect(btn('Previous product')).toBeNull();
    });

    it('is disabled at both ends of the loaded page and enabled in the middle', async () => {
      await open({ productId: 'a', row: rows[0], nav });
      expect(btn('Previous product').disabled).toBe(true);
      expect(btn('Next product').disabled).toBe(false);
      btn('Next product').click();
      await settle();
      expect(btn('Previous product').disabled).toBe(false);
      expect(btn('Next product').disabled).toBe(false);
      btn('Next product').click();
      await settle();
      expect(btn('Next product').disabled).toBe(true);
      expect(svc.getProduct.mock.calls.map((c: any[]) => c[0])).toEqual(['a', 'b', 'c']);
      expect(nav.activated).toHaveBeenLastCalledWith(rows[2]);
    });

    it('Alt+ArrowDown / Alt+ArrowUp step through the list; plain arrows and typing in a field do not', async () => {
      await open({ productId: 'b', row: rows[1], nav });
      const host = el();
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await settle();
      expect(svc.getProduct).toHaveBeenCalledTimes(1);

      const input = document.createElement('input');
      host.appendChild(input);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
      await settle();
      expect(svc.getProduct).toHaveBeenCalledTimes(1);
      input.remove();

      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
      await settle();
      expect(svc.getProduct).toHaveBeenLastCalledWith('c');
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));
      await settle();
      expect(svc.getProduct).toHaveBeenLastCalledWith('b');
    });

    it('a slow response for a product the user already left never overwrites the newer one', async () => {
      const slow: Record<string, (v: any) => void> = {};
      svc.getProduct.mockImplementation((id: string) => id === 'b' ? new Promise(r => (slow[id] = r)) : Promise.resolve(product(id)));
      await open({ productId: 'a', row: rows[0], nav });
      btn('Next product').click();      // -> b (slow)
      await settle();
      btn('Next product').click();      // -> c (fast)
      await settle();
      expect(el().querySelector('.head-title')!.textContent).toContain('Widget C');
      slow['b'](product('b'));          // b answers late
      await settle();
      expect(el().querySelector('.head-title')!.textContent).toContain('Widget C');
    });

    it('a product that is not in the list (e.g. a child) has both buttons disabled', async () => {
      await open({ productId: 'zzz', row: { id: 'zzz' }, nav });
      expect(btn('Previous product').disabled).toBe(true);
      expect(btn('Next product').disabled).toBe(true);
    });
  });
});
