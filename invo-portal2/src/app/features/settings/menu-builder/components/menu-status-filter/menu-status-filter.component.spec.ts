// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import type { MenuStatus } from '../../services/menu-builder.types';
import { MenuStatusFilterComponent } from './menu-status-filter.component';

describe('MenuStatusFilterComponent', () => {
  let fixture: ComponentFixture<MenuStatusFilterComponent>;
  let el: HTMLElement;
  let emitted: Array<MenuStatus | null>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [MenuStatusFilterComponent, TranslateModule.forRoot()] });
    fixture = TestBed.createComponent(MenuStatusFilterComponent);
    emitted = [];
    fixture.componentInstance.valueChange.subscribe(v => emitted.push(v));
    fixture.componentRef.setInput('counts', { ACTIVE: 2, SCHEDULED: 10, ENDED: 20, DISABLED: 9 });
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const chips = () => Array.from(el.querySelectorAll<HTMLElement>('[role="radio"]'));

  it('shows All plus the four statuses, each with its count (All = 41)', () => {
    expect(chips().length).toBe(5);
    expect(chips().map(c => c.querySelector('span')!.textContent!.trim())).toEqual(['41', '2', '10', '20', '9']);
    expect(el.querySelector('[role="radiogroup"]')).toBeTruthy();
  });

  it('marks the selected chip', () => {
    fixture.componentRef.setInput('value', 'ENDED');
    fixture.detectChanges();
    expect(chips().map(c => c.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false', 'true', 'false']);
  });

  it('emits the status of the chip clicked, and null for All', () => {
    chips()[1].click();
    fixture.componentRef.setInput('value', 'ACTIVE');
    fixture.detectChanges();
    chips()[0].click();
    expect(emitted).toEqual(['ACTIVE', null]);
  });

  it('does not emit when the selected chip is clicked again', () => {
    fixture.componentRef.setInput('value', 'ACTIVE');
    fixture.detectChanges();
    chips()[1].click();
    expect(emitted).toEqual([]);
  });

  it('moves with the arrow keys', () => {
    chips()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(emitted).toEqual(['ACTIVE']);
  });
});
