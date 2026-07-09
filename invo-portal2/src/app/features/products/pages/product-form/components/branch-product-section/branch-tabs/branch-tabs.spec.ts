import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmployeeOptionsService } from '@core/layout/services/employee-options.service';
import { BranchTabsComponent } from './branch-tabs.component';
import { provideBranchTabs } from './branch-tabs.service';
import { resolveBranchMode, toEntityRef } from './branch-tabs.util';

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('branch-tabs mapping (BranchTabRef → EntityRef)', () => {
  it('maps name → label and isOnline → status', () => {
    expect(toEntityRef({ id: 'b1', name: 'Main', isOnline: true }))
      .toEqual({ id: 'b1', label: 'Main', status: 'online', group: undefined, disabled: undefined });
    expect(toEntityRef({ id: 'b2', name: 'Depot', isOnline: false }).status).toBe('offline');
  });

  it('passes group + disabled through', () => {
    const e = toEntityRef({ id: 'b3', name: 'Truck', isOnline: true, group: 'Trucks', disabled: true });
    expect(e.group).toBe('Trucks');
    expect(e.disabled).toBe(true);
  });
});

describe('branch-tabs dropdown alias', () => {
  it('maps the deprecated dropdown=true to dropdown, mode wins when set', () => {
    expect(resolveBranchMode(undefined, false)).toBe('tabs');
    expect(resolveBranchMode(undefined, true)).toBe('dropdown');
    expect(resolveBranchMode('sidebar', true)).toBe('sidebar');
  });
});

describe('branch-tabs online dot renders via projection', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BranchTabsComponent, TranslateModule.forRoot()],
      providers: [
        provideBranchTabs('spec.branches'),
        {
          provide: EmployeeOptionsService,
          useValue: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined) },
        },
      ],
    });
  });

  it('renders a .bt-dot (on) inside the generic selector for an online branch', async () => {
    const fixture = TestBed.createComponent(BranchTabsComponent);
    fixture.componentRef.setInput('branches', [{ id: 'b1', name: 'B1', isOnline: true }]);
    fixture.detectChanges();
    await flush();            // store hydration → seeds the active tab
    fixture.detectChanges();

    const dot: HTMLElement | null = fixture.nativeElement.querySelector('.bt-dot');
    expect(dot).toBeTruthy();
    expect(dot!.classList.contains('bt-dot--on')).toBe(true);
  });
});
