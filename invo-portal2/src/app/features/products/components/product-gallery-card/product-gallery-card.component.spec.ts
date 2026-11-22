import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CompanyService } from '@core/auth/company.service';
import { GalleryProductRow, ProductGalleryCardComponent } from './product-gallery-card.component';

const T = {
  PRODUCTS: { TREE: { UNITS: 'Units', VARIANTS: 'Variants', SEE_VARIANTS: 'See variants' }, STOCK: { OUT_OF_STOCK: 'Out of stock' } },
  COMMON: { MORE_ACTIONS: 'More actions' },
};

@Component({
  selector: 'app-menu-stub',
  standalone: true,
  template: `<button class="kebab" type="button" [attr.aria-label]="'COMMON.MORE_ACTIONS' | translate">...</button>`,
  imports: [TranslateModule],
})
class MenuStub {}

describe('<app-product-gallery-card>', () => {
  let fixture: ComponentFixture<ProductGalleryCardComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends Element = HTMLElement>(s: string) => el().querySelector<T>(s);
  const text = () => el().textContent!.replace(/\s+/g, ' ').trim();

  function render(row: GalleryProductRow, inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(ProductGalleryCardComponent);
    fixture.componentRef.setInput('row', row);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductGalleryCardComponent, TranslateModule.forRoot()],
      providers: [{ provide: CompanyService, useValue: { settings: () => ({ settings: { currencySymbol: 'BHD', afterDecimal: 3 } }) } }],
    });
    TestBed.inject(TranslateService).setTranslation('en', T);
    TestBed.inject(TranslateService).use('en');
  });

  describe('image', () => {
    it('renders a lazy, async image with the product name as alt text', () => {
      render({ id: '1', name: 'Blue Mug', image: 'https://cdn.test/t.jpg' });
      const img = q<HTMLImageElement>('img')!;
      expect(img.getAttribute('src')).toBe('https://cdn.test/t.jpg');
      expect(img.getAttribute('alt')).toBe('Blue Mug');
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(img.getAttribute('decoding')).toBe('async');
      expect(q('.pgc__skel')).toBeTruthy();          // skeleton until the picture is in
      img.dispatchEvent(new Event('load')); fixture.detectChanges();
      expect(q('.pgc__skel')).toBeNull();
      expect(img.classList.contains('is-loaded')).toBe(true);
    });

    it('with no image shows the neutral placeholder and no <img>', () => {
      render({ id: '1', name: 'Blue Mug', image: null });
      expect(q('img')).toBeNull();
      expect(q('.pgc__ph svg')).toBeTruthy();
      expect(q('.pgc__skel')).toBeNull();
    });

    it('a load error swaps to the placeholder once and never retries the URL', () => {
      render({ id: '1', name: 'Blue Mug', image: 'https://cdn.test/broken.jpg' });
      q<HTMLImageElement>('img')!.dispatchEvent(new Event('error')); fixture.detectChanges();
      expect(q('img')).toBeNull();
      expect(q('.pgc__ph')).toBeTruthy();
      fixture.detectChanges(); fixture.detectChanges();     // re-rendering must not bring the <img> back
      expect(q('img')).toBeNull();
    });

    it('a new URL on the same card is tried again (only the failed URL is remembered)', () => {
      render({ id: '1', name: 'A', image: 'https://cdn.test/broken.jpg' });
      q<HTMLImageElement>('img')!.dispatchEvent(new Event('error')); fixture.detectChanges();
      fixture.componentRef.setInput('row', { id: '1', name: 'A', image: 'https://cdn.test/good.jpg' }); fixture.detectChanges();
      expect(q<HTMLImageElement>('img')!.getAttribute('src')).toBe('https://cdn.test/good.jpg');
    });
  });

  describe('parents, stock and text', () => {
    it('shows the children pill for a parent, with the type-specific wording', () => {
      render({ id: '1', name: 'Parent', type: 'inventory', isParent: true });
      expect(q('.pgc__pill')!.textContent!.trim()).toBe('Units');
      render({ id: '2', name: 'Matrix', type: 'matrix' });
      expect(q('.pgc__pill')!.textContent!.trim()).toBe('Variants');
    });

    it('no pill for an ordinary product', () => {
      render({ id: '1', name: 'Plain', type: 'inventory', qty: 4 });
      expect(q('.pgc__pill')).toBeNull();
    });

    it('a matrix parent shows an em dash for Qty (never a sum) with the "See variants" tooltip text', () => {
      render({ id: '1', name: 'Matrix', type: 'matrix', qty: 99, defaultPrice: 5 });
      const qty = q('.pgc__qty')!;
      expect(qty.textContent!.trim()).toBe('—');
      expect(qty.classList.contains('pgc__qty--none')).toBe(true);
    });

    it('zero quantity is the danger pill with the alert icon and an "Out of stock" label', () => {
      render({ id: '1', name: 'Gone', type: 'inventory', qty: 0 });
      const qty = q('.pgc__qty')!;
      expect(qty.classList.contains('pgc__qty--out')).toBe(true);
      expect(qty.getAttribute('aria-label')).toBe('Out of stock');
      expect(qty.querySelector('svg')).toBeTruthy();
    });

    it('a missing qty column leaves the pill out instead of showing a false 0', () => {
      render({ id: '1', name: 'No qty column', type: 'inventory', defaultPrice: 3 });
      expect(q('.pgc__qty')).toBeNull();
    });

    it('a long name stays in the 2-line clamp box and keeps its full text', () => {
      const name = 'Extra long product name '.repeat(12).trim();
      render({ id: '1', name });
      const n = q('.pgc__name')!;
      expect(n.textContent!.trim()).toBe(name);
      expect(el().getAttribute('aria-label')).toBe(name);
    });

    it('a long SKU is rendered in full inside the chip, on its own line', () => {
      const sku = 'SKU-' + 'ABCDEFGH'.repeat(8);
      render({ id: '1', name: 'X', SKU: sku });
      const chip = q('.pgc__code .app-product-badge--sku')!;
      expect(chip.textContent!.trim()).toBe(sku);
      expect(q('.pgc__name')!.parentElement).toBe(chip.closest('.pgc__body'));
    });

    it('department / category / brand: one muted joined line, nothing when all are empty', () => {
      render({ id: '1', name: 'X', departmentName: 'Kitchen', categoryName: '', brandName: 'Acme' });
      expect(q('.pgc__tax')!.textContent!.trim()).toBe('Kitchen · Acme');
      render({ id: '2', name: 'Y', departmentName: null, categoryName: '  ', brandName: undefined });
      expect(q('.pgc__tax')).toBeNull();
      expect(text()).not.toContain('—');       // no dash placeholders
    });

    it('is an article labelled by the product name', () => {
      render({ id: '1', name: 'Blue Mug' });
      expect(el().getAttribute('role')).toBe('article');
      expect(el().getAttribute('aria-label')).toBe('Blue Mug');
    });
  });

  describe('interaction', () => {
    it('clicking the card opens the product', () => {
      render({ id: '1', name: 'A' });
      const open = vi.fn(); fixture.componentInstance.open.subscribe(open);
      el().click();
      expect(open).toHaveBeenCalledTimes(1);
    });

    it('Enter on the focused card opens; Enter on the checkbox does not', () => {
      render({ id: '1', name: 'A' });
      const open = vi.fn(); fixture.componentInstance.open.subscribe(open);
      el().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(open).toHaveBeenCalledTimes(1);
      q('input[type=checkbox]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(open).toHaveBeenCalledTimes(1);
    });

    it('the checkbox selects without opening the product (independent selection)', () => {
      render({ id: '1', name: 'A' });
      const open = vi.fn(); const sel = vi.fn();
      fixture.componentInstance.open.subscribe(open); fixture.componentInstance.selectToggle.subscribe(sel);
      q<HTMLInputElement>('input[type=checkbox]')!.click();
      expect(sel).toHaveBeenCalledTimes(1);
      expect(open).not.toHaveBeenCalled();
    });

    it('reflects the selected input on the checkbox and the card', () => {
      render({ id: '1', name: 'A' }, { selected: true });
      expect(q<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(true);
      expect(el().classList.contains('is-selected')).toBe(true);
    });

    it('a click on the row menu never opens the product', () => {
      const t = TestBed.createComponent(HostWithMenu); t.detectChanges();
      const card = t.nativeElement.querySelector('app-product-gallery-card') as HTMLElement;
      (card.querySelector('.kebab') as HTMLElement).click();
      expect(t.componentInstance.opened).toBe(0);
      card.click();
      expect(t.componentInstance.opened).toBe(1);
      expect(card.querySelector('.kebab')!.getAttribute('aria-label')).toBe('More actions');
    });

    it('no checkbox when the page is not selectable', () => {
      render({ id: '1', name: 'A' }, { selectable: false });
      expect(q('input[type=checkbox]')).toBeNull();
    });
  });
});

@Component({
  standalone: true,
  imports: [ProductGalleryCardComponent, MenuStub],
  template: `
    <ng-template #menu let-row><app-menu-stub /></ng-template>
    <app-product-gallery-card [row]="{ id: '1', name: 'A' }" [menuTemplate]="menu" (open)="opened = opened + 1" />`,
})
class HostWithMenu { opened = 0; }
