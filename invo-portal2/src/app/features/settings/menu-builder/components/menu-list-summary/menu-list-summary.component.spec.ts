// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import type { MenuSummary } from '../../services/menu-builder.types';
import { MenuListSummaryComponent } from './menu-list-summary.component';

const TEXTS = { MENU_BUILDER: {
  MORE_N: '+{{n}} more', TIMES_IN: 'Times in {{zone}}',
  SUMMARY: { TOTAL: '{{n}} menus', ACTIVE: '{{n}} active now', SCHEDULED: '{{n}} scheduled', ENDED: '{{n}} ended', ACTIVE_LABEL: 'Active now:', NONE_ACTIVE: 'No menu is active right now.' },
} };
const summary = (active: string[], over: Partial<MenuSummary> = {}): MenuSummary => ({
  total: 41, statusCounts: { ACTIVE: active.length, SCHEDULED: 0, ENDED: 1, DISABLED: 0 }, active: active.map((name, i) => ({ id: 'm' + i, name })), branchTimeZone: 'Asia/Bahrain', ...over,
});

describe('MenuListSummaryComponent', () => {
  let fixture: ComponentFixture<MenuListSummaryComponent>;
  let el: HTMLElement;
  const text = () => el.textContent!.replace(/\s+/g, ' ');

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [MenuListSummaryComponent, TranslateModule.forRoot()] });
    const t = TestBed.inject(TranslateService);
    t.setTranslation('en', TEXTS);
    t.use('en');
    fixture = TestBed.createComponent(MenuListSummaryComponent);
    el = fixture.nativeElement;
  });
  const set = (s: MenuSummary | null) => { fixture.componentRef.setInput('summary', s); fixture.detectChanges(); };

  it('shows nothing until there is a summary', () => {
    set(null);
    expect(text().trim()).toBe('');
  });

  it('shows the totals, the zone and who is live', () => {
    set(summary(['DineIn', 'Delivery']));
    expect(text()).toContain('41 menus');
    expect(text()).toContain('2 active now');
    expect(text()).toContain('1 ended');
    expect(text()).toContain('Times in Asia/Bahrain');
    expect(text()).toContain('Active now: DineIn, Delivery');
  });

  it('names three and puts the rest behind "+N more"', () => {
    set(summary(Array.from({ length: 25 }, (_, i) => 'Menu ' + i)));
    expect(text()).toContain('Menu 0, Menu 1, Menu 2');
    expect(text()).not.toContain('Menu 3');
    expect(text()).toContain('+22 more');
  });

  it('says so when nothing is live', () => {
    set(summary([]));
    expect(text()).toContain('No menu is active right now.');
  });
});
