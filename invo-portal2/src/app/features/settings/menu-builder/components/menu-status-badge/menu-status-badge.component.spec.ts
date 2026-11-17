// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import type { MenuStatus } from '../../services/menu-builder.types';
import { MenuStatusBadgeComponent } from './menu-status-badge.component';

const TEXTS = { MENU_BUILDER: { STATUS: { ACTIVE: 'Active now', STARTS_AT: 'Starts at {{time}}', ENDED_AT: 'Ended at {{time}}' } } };

describe('MenuStatusBadgeComponent', () => {
  let fixture: ComponentFixture<MenuStatusBadgeComponent>;
  let el: HTMLElement;

  function render(status: MenuStatus, inputs: Record<string, unknown> = {}) {
    fixture.componentRef.setInput('status', status);
    fixture.componentRef.setInput('startAt', '06:00:00');
    fixture.componentRef.setInput('endAt', '22:00:00');
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  }
  const label = () => el.querySelector('.badge-label')?.textContent?.trim();

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [MenuStatusBadgeComponent, TranslateModule.forRoot()] });
    const t = TestBed.inject(TranslateService);
    t.setTranslation('en', TEXTS);
    t.use('en');
    fixture = TestBed.createComponent(MenuStatusBadgeComponent);
    el = fixture.nativeElement;
  });

  it('ACTIVE says "Active now", bold, with an icon', () => {
    render('ACTIVE');
    expect(label()).toBe('Active now');
    expect(el.querySelector('svg')).toBeTruthy();
    expect(el.querySelector('[data-status="ACTIVE"]')?.className).toContain('font-bold');
  });

  it('SCHEDULED says when it starts', () => {
    render('SCHEDULED');
    expect(label()).toBe('Starts at 06:00');
  });

  it('ENDED says when it ended', () => {
    render('ENDED');
    expect(label()).toBe('Ended at 22:00');
  });

  it('every status has an icon and a text label (never colour alone)', () => {
    for (const s of ['ACTIVE', 'SCHEDULED', 'ENDED'] as MenuStatus[]) {
      render(s);
      expect(el.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(label()?.length).toBeGreaterThan(0);
    }
  });

  it('honours the 12 hour preference', () => {
    render('SCHEDULED', { use12h: true });
    expect(label()).toMatch(/^Starts at 6:00\s?AM$/i);
  });
});
