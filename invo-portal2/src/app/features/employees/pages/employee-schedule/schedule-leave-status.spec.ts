import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';

import { EmployeeService } from '../../services/employee.service';
import { BranchSettingsService } from '../../../settings/services/branch-settings.service';
import { EmployeeScheduleComponent } from './employee-schedule.component';
import type { ScheduleEmployee } from './employee-schedule.types';

/**
 * What the board says about a leave that has not been decided.
 *
 * ── THE TWO THINGS WORTH GUARDING ────────────────────────────────────────────
 * 1. The MENU CARRIES THE COUNT. Without it the row menu is a blind door:
 *    nothing on the roster tells a supervisor whether opening it shows a queue
 *    or an empty panel, so the only way to find out is to open every row.
 *
 * 2. THE COUNT IS BY LEAVE, NOT BY DAY. A leave spanning a week draws seven
 *    chips over ONE row. Counting days would say "7 waiting" for one request —
 *    a number nobody could reconcile with the list they then open. This is the
 *    assertion a naive implementation fails.
 */

function make(days: Array<Array<{ id: string; status?: string }>>): ScheduleEmployee {
  return {
    employeeId: 'e1',
    employeeName: 'Abbas',
    days: days.map((offs, i) => ({
      date: `2027-03-0${i + 1}`,
      shift: [],
      dayOffShift: offs.map((o) => ({ type: 'Annual leave', offDayId: o.id, status: o.status })),
    })),
  } as any;
}

function component(canApprove = true) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [EmployeeScheduleComponent, TranslateModule.forRoot()],
    providers: [
      { provide: EmployeeService, useValue: {
        getEmployeesSchedule: vi.fn().mockResolvedValue([]),
        cancelEmployeeOffDays: vi.fn(),
        decideLeaveRequest: vi.fn(),
      } },
      { provide: BranchSettingsService, useValue: { list: vi.fn().mockResolvedValue([]) } },
      { provide: ModalService, useValue: { open: vi.fn() } },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map(), queryParamMap: new Map() } } },
      { provide: AuthService, useValue: { currentEmployee: { admin: false, superAdmin: false } } },
      { provide: PrivilegeService, useValue: {
        privileges: { employeeLeaveSecurity: { actions: { approve: { access: canApprove } } } },
      } },
    ],
  });
  return TestBed.createComponent(EmployeeScheduleComponent).componentInstance;
}

describe('schedule board — pending leave is visible before you open anything', () => {
  it('counts ONE leave spread over several days as one', () => {
    // The assertion a day-counting implementation fails.
    const c = component();
    const e = make([[{ id: 'L1', status: 'Pending' }],
                    [{ id: 'L1', status: 'Pending' }],
                    [{ id: 'L1', status: 'Pending' }]]);
    expect(c.pendingLeaveCount(e)).toBe(1);
  });

  it('counts two separate leaves as two', () => {
    const c = component();
    const e = make([[{ id: 'L1', status: 'Pending' }],
                    [{ id: 'L2', status: 'Pending' }]]);
    expect(c.pendingLeaveCount(e)).toBe(2);
  });

  it('ignores anything already decided', () => {
    const c = component();
    const e = make([[{ id: 'A', status: 'Approved' }],
                    [{ id: 'P', status: 'Pending' }],
                    [{ id: 'N' }]]);
    expect(c.pendingLeaveCount(e)).toBe(1);
  });

  it('is zero for someone with nothing waiting', () => {
    const c = component();
    expect(c.pendingLeaveCount(make([[{ id: 'A', status: 'Approved' }]]))).toBe(0);
    expect(c.pendingLeaveCount(make([[]]))).toBe(0);
  });
});

describe('schedule board — the row menu', () => {
  const labelOf = (c: any, e: ScheduleEmployee) =>
    (c.rowMenu(e) as Array<{ label: string }>)
      .map((i) => i.label)
      .find((l) => l.includes('MANAGE_LEAVE')) ?? '';

  it('shows the count when something is waiting', () => {
    const c = component();
    const label = labelOf(c, make([[{ id: 'L1', status: 'Pending' }],
                                   [{ id: 'L2', status: 'Pending' }]]));
    expect(label).toContain('(2)');
  });

  it('shows NO count when nothing is', () => {
    // "(0)" on every row of a roster where most people have nothing pending is
    // noise, and a zero in a badge reads as something to look at.
    const c = component();
    expect(labelOf(c, make([[{ id: 'A', status: 'Approved' }]]))).not.toContain('(');
  });
});

describe('schedule board — the day-off menu follows the status', () => {
  const labels = (c: any, off: any) =>
    (c.dayOffMenu(make([[]]), { date: '2027-03-01', shift: [], dayOffShift: [] } as any, off) as Array<{ label: string }>)
      .map((i) => i.label);

  it('offers approve and reject on a PENDING leave', () => {
    const c = component(true);
    const l = labels(c, { type: 'Annual leave', offDayId: 'L1', status: 'Pending' });
    expect(l.some((x) => x.includes('APPROVE_LEAVE'))).toBe(true);
    expect(l.some((x) => x.includes('REJECT_LEAVE'))).toBe(true);
  });

  it('offers NEITHER on one already approved', () => {
    // A second decision over the first would show as two in the audit.
    const c = component(true);
    const l = labels(c, { type: 'Annual leave', offDayId: 'L1', status: 'Approved' });
    expect(l.some((x) => x.includes('APPROVE_LEAVE'))).toBe(false);
    expect(l.some((x) => x.includes('REJECT_LEAVE'))).toBe(false);
  });

  it('offers NEITHER without the privilege, pending or not', () => {
    // The same grant the HR screen reads. If the board could decide without
    // it, the board would be a way around the privilege.
    const c = component(false);
    const l = labels(c, { type: 'Annual leave', offDayId: 'L1', status: 'Pending' });
    expect(l.some((x) => x.includes('APPROVE_LEAVE'))).toBe(false);
  });

  it('always offers cancel, and never a hard delete', () => {
    // `deleteEmployeeOffDay` was retired: an unscoped erase of a row that is
    // now a leave request. Cancel keeps the record of a leave withdrawn.
    const c = component(false);
    const l = labels(c, { type: 'Annual leave', offDayId: 'L1', status: 'Approved' });
    expect(l.some((x) => x.includes('CANCEL_LEAVE'))).toBe(true);
    expect(l.some((x) => x.includes('COMMON.DELETE'))).toBe(false);
  });
});
