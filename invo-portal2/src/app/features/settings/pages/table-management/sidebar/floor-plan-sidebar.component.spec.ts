// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { FloorPlanSidebarComponent, SidebarTab, readSidebarCollapsed } from './floor-plan-sidebar.component';

@Component({
  standalone: true,
  imports: [FloorPlanSidebarComponent],
  template: `
    <app-floor-plan-sidebar [tab]="tab()" (tabChange)="tab.set($event)" [tablesCount]="3" [objectsCount]="1"
      [detailTitle]="detail()" [(collapsed)]="collapsed" (back)="backs = backs + 1">
      <p class="content">{{ detail() ? 'detail' : 'list' }}</p>
      <div sidebarFooter class="foot">actions</div>
    </app-floor-plan-sidebar>`,
})
class Host {
  tab = signal<SidebarTab>('tables');
  detail = signal<string | null>(null);
  collapsed = signal(readSidebarCollapsed());
  backs = 0;
}

describe('FloorPlanSidebarComponent', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let el: HTMLElement;
  const q = (s: string) => el.querySelector<HTMLElement>(s)!;
  const flush = () => { fixture.detectChanges(); TestBed.tick(); fixture.detectChanges(); };

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [Host, TranslateModule.forRoot()] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    flush();
  });

  it('shows three tabs with counts and marks the active one', () => {
    expect(el.querySelectorAll('[role="tab"]').length).toBe(3);
    expect(q('[role="tab"][aria-selected="true"]').textContent).toContain('3');
    expect(el.querySelector('[role="tabpanel"]')).toBeTruthy();
  });

  it('moves between tabs with the arrow keys', () => {
    q('[role="tab"][aria-selected="true"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    flush();
    expect(host.tab()).toBe('objects');
  });

  it('swaps the tabs for a back link while a detail is open, and goes back', () => {
    host.detail.set('Table 7');
    flush();
    expect(el.querySelectorAll('[role="tab"]').length).toBe(0);
    expect(q('.sb__back').getAttribute('aria-label')).toBeTruthy();
    expect(q('.sb__title').textContent).toContain('Table 7');
    q('.sb__back').click();
    expect(host.backs).toBe(1);
  });

  it('keeps the footer slot', () => {
    expect(q('.sb__footer .foot')).toBeTruthy();
  });

  it('collapses to a rail and remembers it', () => {
    q('.sb__collapse').click();
    flush();
    expect(host.collapsed()).toBe(true);
    expect(el.querySelector('.sb__rail')).toBeTruthy();
    expect(localStorage.getItem('tm.sidebar.collapsed')).toBe('1');
    expect(readSidebarCollapsed()).toBe(true);
    q('.sb__rail').click();
    flush();
    expect(localStorage.getItem('tm.sidebar.collapsed')).toBe('0');
  });
});
