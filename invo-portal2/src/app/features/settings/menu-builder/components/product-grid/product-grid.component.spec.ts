// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import type { MenuSectionProduct } from '../../services/menu-builder.types';
import { PRODUCT_DRAG_TYPE, ProductGridComponent } from './product-grid.component';

const TEXTS = {
  COMMON: { DELETE: 'Delete' },
  MENU_BUILDER: { GRID: {
    LABEL: 'Product grid', ADD_HERE: 'Add product here', TILE_LABEL: '{{name}}, slot {{slot}}', REMOVE_FROM_SLOT: 'Remove {{name}} from slot {{slot}}',
    TILE_ACTIONS: 'Actions for {{name}}', MOVE_UP: 'Move up', MOVE_DOWN: 'Move down', MOVE_LEFT: 'Move left', MOVE_RIGHT: 'Move right', COLOR: 'Color',
  } },
};
const tile = (id: string, name: string, x: number, y: number, price: number | null = null): MenuSectionProduct =>
  ({ id, productId: 'p-' + id, productName: name, page: 1, x, y, cols: 1, rows: 1, color: '', defaultImage: '', price, mediaId: null });

describe('ProductGridComponent', () => {
  let fixture: ComponentFixture<ProductGridComponent>;
  let el: HTMLElement;
  let c: ProductGridComponent;
  let picked: Array<{ x: number; y: number }>;
  let removed: string[];
  let dropped: Array<{ id: string; x: number; y: number }>;
  let steps: Array<{ key: string; dir: string }>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ProductGridComponent, TranslateModule.forRoot()] });
    const t = TestBed.inject(TranslateService);
    t.setTranslation('en', TEXTS);
    t.use('en');
    fixture = TestBed.createComponent(ProductGridComponent);
    c = fixture.componentInstance;
    picked = []; removed = []; dropped = []; steps = [];
    c.pickAt.subscribe((e) => picked.push(e));
    c.tileRemove.subscribe((p) => removed.push(p.productName));
    c.productDrop.subscribe((e) => dropped.push({ id: e.product.id, x: e.x, y: e.y }));
    c.tileStep.subscribe((e) => steps.push(e));
    fixture.componentRef.setInput('products', [tile('a', 'Chicken Mandi', 3, 0, 42.5)]);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('shows 35 empty cells and one tile (36 slots in all)', () => {
    expect(el.querySelectorAll('.cell').length).toBe(35);
    expect(el.querySelectorAll('.tile').length).toBe(1);
  });

  it('a filled tile shows its name and price, and says which slot it is in', () => {
    const t = el.querySelector('.tile')!;
    expect(t.querySelector('.tile__name')!.textContent).toContain('Chicken Mandi');
    expect(t.querySelector('.tile__price')!.textContent).toContain('42.5');
    expect(t.getAttribute('aria-label')).toBe('Chicken Mandi, slot 4');
  });

  it('the remove button says what it removes', () => {
    const x = el.querySelector<HTMLButtonElement>('.tile__x')!;
    expect(x.getAttribute('aria-label')).toBe('Remove Chicken Mandi from slot 4');
    x.click();
    expect(removed).toEqual(['Chicken Mandi']);
  });

  it('an empty cell asks for the picker at its own position', () => {
    const cells = el.querySelectorAll<HTMLElement>('.cell');
    cells[0].click();
    expect(picked).toEqual([{ x: 0, y: 0 }]);
  });

  it('a product dropped from the search results lands on the cell it was dropped on', () => {
    const cells = el.querySelectorAll<HTMLElement>('.cell');
    const data = JSON.stringify({ id: 'p9', name: 'Soup' });
    const dt = { types: [PRODUCT_DRAG_TYPE], getData: (t: string) => (t === PRODUCT_DRAG_TYPE ? data : ''), dropEffect: '' };
    const over = new Event('dragover', { bubbles: true, cancelable: true }) as any;
    over.dataTransfer = dt;
    cells[2].dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true); // it is a valid drop target
    const drop = new Event('drop', { bubbles: true, cancelable: true }) as any;
    drop.dataTransfer = dt;
    cells[2].dispatchEvent(drop);
    expect(dropped).toEqual([{ id: 'p9', x: 2, y: 0 }]);
  });

  it('ignores a drag that is not a product', () => {
    const cells = el.querySelectorAll<HTMLElement>('.cell');
    const over = new Event('dragover', { bubbles: true, cancelable: true }) as any;
    over.dataTransfer = { types: ['text/plain'], getData: () => '' };
    cells[0].dispatchEvent(over);
    expect(over.defaultPrevented).toBe(false);
  });

  it('the tile menu moves it a cell at a time (the keyboard alternative to dragging)', () => {
    el.querySelector<HTMLButtonElement>('.tile app-row-menu button')!.click();
    fixture.detectChanges();
    const items = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    expect(items.map((i) => i.textContent!.trim())).toEqual(['Move up', 'Move down', 'Move left', 'Move right', 'Color', 'Delete']);
    expect((items[0] as HTMLButtonElement).disabled).toBe(true); // already on the top row
    items[3].click();
    expect(steps).toEqual([{ key: 'a', dir: 'right' }]);
  });

  it('shows the notice under the grid', () => {
    fixture.componentRef.setInput('notice', 'Chicken Mandi is already on this page.');
    fixture.detectChanges();
    expect(el.querySelector('.pg__notice')!.textContent).toContain('already on this page');
  });
});
