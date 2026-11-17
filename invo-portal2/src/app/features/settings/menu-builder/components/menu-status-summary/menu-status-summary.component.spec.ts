// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { MenuStatusSummaryComponent } from './menu-status-summary.component';

const TEXTS = {
  MENU_BUILDER: { STATUS: {
    SUMMARY_ACTIVE: 'Active now:', SUMMARY_COUNT: '{{n}} of {{total}}',
    NONE_ACTIVE: 'No menu is active right now. The POS will show nothing.', SEE_SCHEDULED: 'See scheduled menus',
    TZ_HINT: 'Times shown in branch time ({{zone}})',
  } },
};

describe('MenuStatusSummaryComponent', () => {
  let fixture: ComponentFixture<MenuStatusSummaryComponent>;
  let el: HTMLElement;
  let clicked: string[];
  let scheduled: number;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [MenuStatusSummaryComponent, TranslateModule.forRoot()] });
    const t = TestBed.inject(TranslateService);
    t.setTranslation('en', TEXTS);
    t.use('en');
    fixture = TestBed.createComponent(MenuStatusSummaryComponent);
    clicked = [];
    scheduled = 0;
    fixture.componentInstance.menuClick.subscribe(id => clicked.push(id));
    fixture.componentInstance.showScheduled.subscribe(() => scheduled++);
    fixture.componentRef.setInput('total', 41);
    el = fixture.nativeElement;
  });

  const set = (active: Array<{ id: string; name: string }>, zone = '') => {
    fixture.componentRef.setInput('active', active);
    fixture.componentRef.setInput('timeZone', zone);
    fixture.detectChanges();
  };

  it('names the active menus and counts them: "2 of 41"', () => {
    set([{ id: 'a', name: 'DineIn Menu' }, { id: 'b', name: 'Delivery Menu' }]);
    const text = el.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Active now:');
    expect(text).toContain('DineIn Menu');
    expect(text).toContain('Delivery Menu');
    expect(text).toContain('2 of 41');
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('one active menu: "1 of 41"', () => {
    set([{ id: 'a', name: 'Lunch' }]);
    expect(el.textContent).toContain('1 of 41');
  });

  it('names are clickable and emit the menu id', () => {
    set([{ id: 'a', name: 'DineIn Menu' }, { id: 'b', name: 'Delivery Menu' }]);
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('button'));
    buttons[1].click();
    expect(clicked).toEqual(['b']);
  });

  it('warns when nothing is active, with a link to the scheduled filter', () => {
    set([]);
    const alert = el.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('No menu is active right now. The POS will show nothing.');
    alert.querySelector('button')!.click();
    expect(scheduled).toBe(1);
  });

  it('shows the time zone hint only when it knows the zone', () => {
    set([{ id: 'a', name: 'Lunch' }], 'Asia/Riyadh');
    expect(el.textContent).toContain('Times shown in branch time (Asia/Riyadh)');
    set([{ id: 'a', name: 'Lunch' }], '');
    expect(el.textContent).not.toContain('Times shown');
  });

  it('renders nothing until the first load', () => {
    fixture.componentRef.setInput('loaded', false);
    set([]);
    expect(el.textContent!.trim()).toBe('');
  });
});
