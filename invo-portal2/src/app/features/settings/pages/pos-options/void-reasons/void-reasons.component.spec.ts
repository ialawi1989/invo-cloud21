// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ToastService } from '@shared/components/toast/toast.service';
import { VoidReasonsComponent } from './void-reasons.component';
import { validateReason } from './void-reason.validators';

const TEXTS = {
  SETTINGS: { POS_OPTIONS: { VOID: {
    SUGGEST_WRONG_ITEM: 'Wrong item scanned', SUGGEST_PRICE_ERROR: 'Price error', SUGGEST_DAMAGED: 'Item damaged',
    SUGGEST_UNAVAILABLE: 'Item unavailable', SUGGEST_DUPLICATE: 'Duplicate entry',
  } } },
};

describe('VoidReasonsComponent', () => {
  let fixture: ComponentFixture<VoidReasonsComponent>;
  let el: HTMLElement;
  let emitted: string[][];
  let toast: ToastService;

  async function setup(reasons: string[] = []) {
    TestBed.configureTestingModule({ imports: [VoidReasonsComponent, TranslateModule.forRoot()] });
    const t = TestBed.inject(TranslateService);
    t.setTranslation('en', TEXTS);
    t.use('en');
    toast = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(VoidReasonsComponent);
    emitted = [];
    fixture.componentInstance.reasonsChange.subscribe(v => emitted.push(v));
    fixture.componentRef.setInput('reasons', reasons);
    el = fixture.nativeElement;
    await settle();
  }
  async function settle() { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); }

  const rows = () => Array.from(el.querySelectorAll<HTMLElement>('li[app-reason-row]'));
  const texts = () => rows().map(r => r.querySelector('.rr__text')?.textContent?.trim());
  const addInput = () => el.querySelector<HTMLInputElement>('.vr__input')!;
  const addButton = () => el.querySelector<HTMLButtonElement>('.vr__add-btn')!;
  async function type(input: HTMLInputElement, value: string) { input.value = value; input.dispatchEvent(new Event('input')); await settle(); }
  async function press(target: HTMLElement, key: string, init: KeyboardEventInit = {}) {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
    await settle();
  }
  const last = () => emitted[emitted.length - 1];

  beforeEach(() => TestBed.resetTestingModule());

  it('adds a trimmed reason with Enter and clears the field', async () => {
    await setup();
    await type(addInput(), '  Customer changed mind  ');
    await press(addInput(), 'Enter');
    expect(last()).toEqual(['Customer changed mind']);
    expect(texts()).toEqual(['Customer changed mind']);
    expect(addInput().value).toBe('');
  });

  it('keeps the Add button disabled while the text is empty', async () => {
    await setup();
    expect(addButton().disabled).toBe(true);
    await type(addInput(), '   ');
    expect(addButton().disabled).toBe(true);
    await press(addInput(), 'Enter');
    expect(emitted.length).toBe(0);
  });

  it('rejects a duplicate, ignoring case and spaces, with an error message', async () => {
    await setup(['Price error']);
    await type(addInput(), '  price ERROR ');
    await press(addInput(), 'Enter');
    expect(emitted.length).toBe(0);
    expect(el.querySelector('.vr__error')?.textContent).toContain('ERR_DUPLICATE');
    expect(validateReason('price error', ['Price error'])).toBe('duplicate');
    expect(validateReason('', [])).toBe('required');
  });

  it('edits in place: Enter saves, Escape restores the old text', async () => {
    await setup(['Customer changed mind', 'Price error']);
    // Enter saves
    rows()[0].querySelector<HTMLButtonElement>('.rr__text')!.click();
    await settle();
    let input = rows()[0].querySelector<HTMLInputElement>('.rr__input')!;
    expect(input).toBeTruthy();
    await type(input, 'Customer left');
    await press(input, 'Enter');
    expect(last()).toEqual(['Customer left', 'Price error']);
    expect(texts()[0]).toBe('Customer left');
    // Escape cancels
    rows()[1].querySelector<HTMLButtonElement>('.rr__icon')!.click();
    await settle();
    input = rows()[1].querySelector<HTMLInputElement>('.rr__input')!;
    await type(input, 'Something else');
    await press(input, 'Escape');
    expect(texts()[1]).toBe('Price error');
    expect(emitted.length).toBe(1);
  });

  it('rejects an edit that duplicates another reason', async () => {
    await setup(['A reason', 'Other reason']);
    rows()[0].querySelector<HTMLButtonElement>('.rr__text')!.click();
    await settle();
    const input = rows()[0].querySelector<HTMLInputElement>('.rr__input')!;
    await type(input, 'other REASON');
    await press(input, 'Enter');
    expect(emitted.length).toBe(0);
    expect(rows()[0].querySelector('.rr__error')).toBeTruthy();
  });

  it('deletes with an Undo that puts the reason back in its place', async () => {
    await setup(['One', 'Two', 'Three']);
    rows()[1].querySelector<HTMLButtonElement>('.rr__icon--danger')!.click();
    // The toast keeps a 5 s timer: don't wait for the zone to go idle, just render.
    fixture.detectChanges();
    expect(last()).toEqual(['One', 'Three']);
    const t = toast.items().find(i => i.action);
    expect(t?.action?.label).toContain('UNDO');
    expect(t?.timeout).toBe(5000);
    t!.action!.run();
    fixture.detectChanges();
    expect(last()).toEqual(['One', 'Two', 'Three']);
    expect(texts()).toEqual(['One', 'Two', 'Three']);
    toast.clear();
  });

  it('reorders by drag and drop', async () => {
    await setup(['One', 'Two', 'Three']);
    fixture.componentInstance.drop({ previousIndex: 0, currentIndex: 2 } as never);
    await settle();
    expect(last()).toEqual(['Two', 'Three', 'One']);
    expect(texts()).toEqual(['Two', 'Three', 'One']);
  });

  it('reorders from the keyboard with Alt + Arrow on the handle', async () => {
    await setup(['One', 'Two', 'Three']);
    await press(rows()[2].querySelector<HTMLElement>('.rr__handle')!, 'ArrowUp', { altKey: true });
    expect(last()).toEqual(['One', 'Three', 'Two']);
    await press(rows()[0].querySelector<HTMLElement>('.rr__handle')!, 'ArrowUp', { altKey: true });   // already first: nothing happens
    expect(emitted.length).toBe(1);
    await press(rows()[0].querySelector<HTMLElement>('.rr__handle')!, 'ArrowDown');                   // no Alt: ignored
    expect(emitted.length).toBe(1);
  });

  it('stops at 10 reasons: the field is disabled and a message is shown', async () => {
    await setup(Array.from({ length: 10 }, (_, i) => `Reason ${i + 1}`));
    expect(addInput().disabled).toBe(true);
    expect(addButton().disabled).toBe(true);
    expect(el.querySelector('.vr__error--info')?.textContent).toContain('ERR_LIMIT');
    expect(el.querySelector('app-suggestion-chips .sc')).toBeNull();
  });

  it('suggests ready-made reasons while the list is short and hides the ones already present', async () => {
    await setup(['Price error']);
    const chips = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.sc__chip')).map(c => c.textContent?.trim());
    expect(chips()).toEqual(['Wrong item scanned', 'Item damaged', 'Item unavailable', 'Duplicate entry']);
    el.querySelectorAll<HTMLButtonElement>('.sc__chip')[0].click();
    await settle();
    expect(last()).toEqual(['Price error', 'Wrong item scanned']);
    expect(chips()).not.toContain('Wrong item scanned');
    // 5 reasons: no more suggestions
    fixture.componentRef.setInput('reasons', ['a', 'b', 'c', 'd', 'e']);
    await settle();
    expect(chips()).toEqual([]);
  });
});
