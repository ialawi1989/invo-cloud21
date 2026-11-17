// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { SectionListComponent, SectionRow, SectionAction } from './section-list.component';

const TEXTS = {
  COMMON: { DELETE: 'Delete' },
  MENU_BUILDER: {
    ADD_SECTION: 'Add section', NO_SECTIONS: 'No sections yet', UNNAMED_SECTION: 'Untitled',
    ERR: { DUPLICATE_NAME: 'Another section already uses this name.' },
    SECTION: {
      LIST: 'Sections', RENAME: 'Rename', CHANGE_COLOR: 'Change color', DUPLICATE: 'Duplicate',
      ACTIONS_FOR: 'Actions for section {{name}}', DRAG_HANDLE: 'Drag to reorder {{name}}', PRODUCTS_N: '{{n}} products',
      EMPTY_WARNING: '{{n}} sections are empty and won\'t show on the POS.',
    },
  },
};
const row = (id: string, name: string, productsCount = 0): SectionRow => ({ id, name, colorStart: '#0a0', colorEnd: '#0b0', productsCount });

describe('SectionListComponent', () => {
  let fixture: ComponentFixture<SectionListComponent>;
  let el: HTMLElement;
  let reorders: Array<{ from: number; to: number }>;
  let actions: Array<{ id: string; action: SectionAction }>;
  let selected: string[];
  let added = 0;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [SectionListComponent, TranslateModule.forRoot()] });
    const t = TestBed.inject(TranslateService);
    t.setTranslation('en', TEXTS);
    t.use('en');
    fixture = TestBed.createComponent(SectionListComponent);
    const c = fixture.componentInstance;
    reorders = []; actions = []; selected = []; added = 0;
    c.reorder.subscribe((e) => reorders.push(e));
    c.action.subscribe((e) => actions.push(e));
    c.select.subscribe((id) => selected.push(id));
    c.add.subscribe(() => added++);
    fixture.componentRef.setInput('sections', [row('a', 'Rice', 3), row('b', 'Drinks', 0), row('c', 'Salads', 2)]);
    fixture.componentRef.setInput('selectedId', 'b');
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const rows = () => Array.from(el.querySelectorAll<HTMLElement>('.sl__row'));
  const press = (target: Element, init: KeyboardEventInit) => { target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init })); fixture.detectChanges(); };

  it('uses list semantics with a name, a count and a drag handle on each row', () => {
    expect(el.querySelector('ul')!.getAttribute('role')).toBe('list');
    expect(rows().length).toBe(3);
    expect(rows()[0].textContent).toContain('Rice');
    expect(rows()[0].textContent).toContain('3 products');
    expect(rows()[0].querySelector('.sl__handle')!.getAttribute('aria-label')).toBe('Drag to reorder Rice');
  });

  it('marks the selected section by more than colour: aria-current and the selected class', () => {
    expect(rows()[1].getAttribute('aria-current')).toBe('true');
    expect(rows()[1].classList.contains('sl__row--on')).toBe(true);
    expect(rows()[0].getAttribute('aria-current')).toBeNull();
  });

  it('selects on click and adds on the dashed button', () => {
    rows()[2].querySelector<HTMLElement>('.sl__main')!.click();
    expect(selected).toEqual(['c']);
    el.querySelector<HTMLElement>('.sl__add')!.click();
    expect(added).toBe(1);
  });

  it('Alt+ArrowDown / Alt+ArrowUp reorder from the keyboard', () => {
    press(rows()[0].querySelector('.sl__main')!, { key: 'ArrowDown', altKey: true });
    press(rows()[2].querySelector('.sl__main')!, { key: 'ArrowUp', altKey: true });
    expect(reorders).toEqual([{ from: 0, to: 1 }, { from: 2, to: 1 }]);
  });

  it('does not move past either end, and plain arrows do nothing', () => {
    press(rows()[0].querySelector('.sl__main')!, { key: 'ArrowUp', altKey: true });
    press(rows()[2].querySelector('.sl__main')!, { key: 'ArrowDown', altKey: true });
    press(rows()[1].querySelector('.sl__main')!, { key: 'ArrowDown' });
    expect(reorders).toEqual([]);
  });

  it('each row has a menu button named for its section, with Rename / Change color / Duplicate / Delete', () => {
    const btn = rows()[0].querySelector<HTMLButtonElement>('app-row-menu button')!;
    expect(btn.getAttribute('aria-label')).toBe('Actions for section Rice');
    expect(btn.getAttribute('aria-haspopup')).toBe('menu');
    btn.click();
    fixture.detectChanges();
    const items = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    expect(items.map((i) => i.textContent!.trim())).toEqual(['Rename', 'Change color', 'Duplicate', 'Delete']);
    items[3].click();
    expect(actions).toEqual([{ id: 'a', action: 'delete' }]);
  });

  it('warns about empty sections, and not otherwise', () => {
    expect(el.querySelector('.sl__warn')).toBeNull();
    fixture.componentRef.setInput('emptyCount', 2);
    fixture.detectChanges();
    expect(el.querySelector('.sl__warn')!.textContent).toContain('2 sections are empty');
  });

  it('shows a section-name error under its row', () => {
    fixture.componentRef.setInput('errors', { 'section:b': 'DUPLICATE_NAME' });
    fixture.detectChanges();
    expect(rows()[1].querySelector('[role="alert"]')!.textContent).toContain('already uses this name');
  });
});
