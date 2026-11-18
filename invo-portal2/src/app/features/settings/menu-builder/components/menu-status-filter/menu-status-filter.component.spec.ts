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
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const chips = () => Array.from(el.querySelectorAll<HTMLElement>('[role="radio"]'));

  it('shows All plus Active now / Scheduled / Ended', () => {
    expect(chips().length).toBe(4);
    expect(el.querySelector('[role="radiogroup"]')).toBeTruthy();
  });

  it('marks the selected tab', () => {
    fixture.componentRef.setInput('value', 'ENDED');
    fixture.detectChanges();
    expect(chips().map((c) => c.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false', 'true']);
  });

  it('emits the status of the tab clicked, and null for All; not when the selected one is clicked again', () => {
    chips()[1].click();
    fixture.componentRef.setInput('value', 'ACTIVE');
    fixture.detectChanges();
    chips()[1].click();
    chips()[0].click();
    expect(emitted).toEqual(['ACTIVE', null]);
  });

  it('moves with the arrow keys', () => {
    chips()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(emitted).toEqual(['ACTIVE']);
  });
});
