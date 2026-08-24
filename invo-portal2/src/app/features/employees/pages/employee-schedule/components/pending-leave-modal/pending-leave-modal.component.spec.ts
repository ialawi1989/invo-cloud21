import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ToastService } from '@shared/components/toast/toast.service';
import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';

import { EmployeeLeaveService } from '../../../../services/employee-leave.service';
import { EmployeeService } from '../../../../services/employee.service';
import { PendingLeaveModalComponent } from './pending-leave-modal.component';

/**
 * The leave surface reached from the board's row menu.
 *
 * ── WHAT IS WORTH GUARDING ───────────────────────────────────────────────────
 * Not that a list renders. That the FILTERS answer the question the screen
 * exists for, and that the actions offered match what each row can actually
 * accept — offering Approve on an approved request invites a second decision
 * over the first, and the audit would then show two.
 *
 * The privilege stub is deliberately a NON-admin with an explicit grant.
 * `hrGrantFor` short-circuits for admins, so testing as one would pass whatever
 * the gate said.
 */

const ROWS = [
  { id: 'p1', leaveType: 'Annual leave', status: 'Pending',   startDate: '2027-01-04', endDate: '2027-01-06', days: 3, reason: null },
  { id: 'p2', leaveType: 'Sick leave',   status: 'Pending',   startDate: '2027-02-01', endDate: '2027-02-01', days: 1, reason: 'flu' },
  { id: 'a1', leaveType: 'Annual leave', status: 'Approved',  startDate: '2026-12-01', endDate: '2026-12-03', days: 3, reason: null },
  { id: 'r1', leaveType: 'Annual leave', status: 'Rejected',  startDate: '2026-11-01', endDate: '2026-11-02', days: 2, reason: null },
  { id: 'c1', leaveType: 'Sick leave',   status: 'Cancelled', startDate: '2026-10-01', endDate: '2026-10-01', days: 1, reason: null },
  // Written before the status column existed. The server reads these as
  // Approved, and so must this.
  { id: 'n1', leaveType: 'Training',     status: null,        startDate: '2026-09-01', endDate: '2026-09-01', days: 1, reason: null },
] as any[];

function setup(opts: { canApprove?: boolean; rows?: any[] } = {}) {
  const requests = vi.fn().mockResolvedValue(opts.rows ?? ROWS);
  const decide = vi.fn().mockResolvedValue(undefined);
  const cancelEmployeeOffDays = vi.fn().mockResolvedValue({ data: { cancelled: 1, skipped: [] } });

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [PendingLeaveModalComponent, TranslateModule.forRoot()],
    providers: [
      { provide: MODAL_DATA, useValue: { employeeId: 'e1', employeeName: 'Abbas' } },
      { provide: MODAL_REF, useValue: { close: vi.fn() } },
      { provide: EmployeeLeaveService, useValue: { requests, decide } },
      { provide: EmployeeService, useValue: { cancelEmployeeOffDays } },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      // A non-admin, so the grant below is what decides.
      { provide: AuthService, useValue: { currentEmployee: { admin: false, superAdmin: false } } },
      {
        provide: PrivilegeService,
        useValue: {
          privileges: {
            employeeLeaveSecurity: {
              actions: { approve: { access: opts.canApprove ?? true } },
            },
          },
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(PendingLeaveModalComponent);
  return { fixture, c: fixture.componentInstance, requests, decide, cancelEmployeeOffDays };
}

const load = async (ctx: any) => {
  await ctx.c.ngOnInit();
};

describe('pending-leave modal — filters', () => {
  it('OPENS on Pending, not on everything', async () => {
    // The question that brings someone here is what is waiting on them. A list
    // that starts by mixing decided with undecided stops answering it.
    const ctx = setup();
    await load(ctx);

    expect(ctx.c.filter()).toBe('Pending');
    expect(ctx.c.rows().map((r: any) => r.id)).toEqual(['p1', 'p2']);
  });

  it('shows the decided ones when asked — it is a filter, not a restriction', async () => {
    const ctx = setup();
    await load(ctx);

    ctx.c.setFilter('Rejected');
    expect(ctx.c.rows().map((r: any) => r.id)).toEqual(['r1']);

    ctx.c.setFilter('All');
    expect(ctx.c.rows().length).toBe(ROWS.length);
  });

  it('filters by TYPE as well, and the two compose', async () => {
    const ctx = setup();
    await load(ctx);

    ctx.c.setFilter('All');
    ctx.c.setTypeFilter('Sick leave');
    expect(ctx.c.rows().map((r: any) => r.id)).toEqual(['p2', 'c1']);

    // Both at once: sick AND pending is p2 alone.
    ctx.c.setFilter('Pending');
    expect(ctx.c.rows().map((r: any) => r.id)).toEqual(['p2']);
  });

  it('offers only the types actually present', async () => {
    // A fixed list of every type the system knows would offer a dozen options
    // against six rows, most matching nothing.
    const ctx = setup();
    await load(ctx);
    expect(ctx.c.typeOptions()).toEqual(['All', 'Annual leave', 'Sick leave', 'Training']);
  });

  it('treats a NULL status as Approved', async () => {
    const ctx = setup();
    await load(ctx);
    ctx.c.setFilter('Approved');
    expect(ctx.c.rows().map((r: any) => r.id)).toEqual(['a1', 'n1']);
  });

  it('CLEARS the selection when a filter changes', async () => {
    // A selection made under one filter would act on rows the user can no
    // longer see.
    const ctx = setup();
    await load(ctx);

    ctx.c.toggle('p1');
    expect(ctx.c.selectedCount()).toBe(1);

    ctx.c.setFilter('All');
    expect(ctx.c.selectedCount()).toBe(0);
  });
});

describe('pending-leave modal — which actions each row accepts', () => {
  it('decides a PENDING row and nothing else', async () => {
    const ctx = setup();
    await load(ctx);
    ctx.c.setFilter('All');
    const by = (id: string) => ctx.c.rows().find((r: any) => r.id === id)!;

    expect(ctx.c.canDecide(by('p1'))).toBe(true);
    expect(ctx.c.canDecide(by('a1'))).toBe(false);
    expect(ctx.c.canDecide(by('r1'))).toBe(false);
  });

  it('cancels what is still open or approved, never what is closed', async () => {
    const ctx = setup();
    await load(ctx);
    ctx.c.setFilter('All');
    const by = (id: string) => ctx.c.rows().find((r: any) => r.id === id)!;

    expect(ctx.c.canCancel(by('p1'))).toBe(true);
    expect(ctx.c.canCancel(by('a1'))).toBe(true);
    expect(ctx.c.canCancel(by('r1'))).toBe(false);
    expect(ctx.c.canCancel(by('c1'))).toBe(false);
  });

  it('offers NO decision without the privilege', async () => {
    // The same grant the HR leave screen reads. If the board could decide
    // without it, the board would be a way around the privilege.
    const ctx = setup({ canApprove: false });
    await load(ctx);
    expect(ctx.c.canDecide(ctx.c.rows()[0])).toBe(false);
    // Cancelling is not an approval and stays available.
    expect(ctx.c.canCancel(ctx.c.rows()[0])).toBe(true);
  });

  it('a MIXED selection offers no bulk decision', async () => {
    /*
     * Deciding some and skipping others is worse than doing nothing: the bar
     * cannot say which without listing them, so it declines the action instead
     * of half-performing it.
     */
    const ctx = setup();
    await load(ctx);
    ctx.c.setFilter('All');

    ctx.c.toggle('p1');
    expect(ctx.c.selectionDecidable()).toBe(true);

    ctx.c.toggle('a1');
    expect(ctx.c.selectionDecidable()).toBe(false);
    // Both are cancellable, so that one stays on.
    expect(ctx.c.selectionCancellable()).toBe(true);

    ctx.c.toggle('r1');
    expect(ctx.c.selectionCancellable()).toBe(false);
  });

  it('an EMPTY selection offers nothing', async () => {
    const ctx = setup();
    await load(ctx);
    expect(ctx.c.selectionDecidable()).toBe(false);
    expect(ctx.c.selectionCancellable()).toBe(false);
  });
});

describe('pending-leave modal — what it sends', () => {
  it('cancels the whole selection in ONE request', async () => {
    const ctx = setup();
    await load(ctx);
    ctx.c.toggle('p1');
    ctx.c.toggle('p2');

    await ctx.c.cancel();

    expect(ctx.cancelEmployeeOffDays).toHaveBeenCalledTimes(1);
    expect(ctx.cancelEmployeeOffDays.mock.calls[0][0]).toEqual(['p1', 'p2']);
  });

  it('acts on ONE row without needing it selected first', async () => {
    // Deciding a single request is the common case; requiring a tick would add
    // a click to the thing people do most.
    const ctx = setup();
    await load(ctx);

    await ctx.c.decide('Approved', ctx.c.rows()[0]);

    expect(ctx.decide).toHaveBeenCalledTimes(1);
    expect(ctx.decide.mock.calls[0][0]).toBe('p1');
    expect(ctx.decide.mock.calls[0][1]).toBe('Approved');
  });

  it('does not send one row when a DIFFERENT one is selected', async () => {
    // The row argument wins over the selection, and the selection is not
    // silently folded in.
    const ctx = setup();
    await load(ctx);
    ctx.c.toggle('p2');

    await ctx.c.decide('Rejected', ctx.c.rows()[0]);

    expect(ctx.decide).toHaveBeenCalledTimes(1);
    expect(ctx.decide.mock.calls[0][0]).toBe('p1');
  });

  it('reloads after acting, so a decided row leaves the queue', async () => {
    const ctx = setup();
    await load(ctx);
    expect(ctx.requests).toHaveBeenCalledTimes(1);

    await ctx.c.decide('Approved', ctx.c.rows()[0]);
    expect(ctx.requests).toHaveBeenCalledTimes(2);
  });
});
