import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from '@core/auth/auth.service';
import { FeatureService } from '@core/auth/feature.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ToastService } from '@shared/components/toast/toast.service';

import { EmployeeService } from '../../services/employee.service';
import { EmployeePayrollService } from '../../services/employee-payroll.service';
import { EmployeeOverviewComponent } from './employee-overview.component';

/**
 * The read-only record page.
 *
 * ── WHAT THESE GUARD ─────────────────────────────────────────────────────────
 * Three things, none of which shows as an error when it breaks:
 *
 *  1. **The id comes off the PARENT route.** The overview is a child of the
 *     record shell and declares no `:id` of its own. This is exactly the bug
 *     that shipped in the sibling form — every route stub there put the id on
 *     the component's own route, so the whole path was untested behind green.
 *     Here the stub's own paramMap is EMPTY, deliberately.
 *  2. **Bank details are default-DENY.** `viewBank` is a grant of its own, and
 *     a card that renders without it exposes an account number to someone the
 *     server would have refused.
 *  3. **The IBAN is masked.** A test that only checked "the row exists" would
 *     pass while printing the whole number.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

const RECORD: any = {
  id: 'emp-77',
  name: 'Fatima Al-Sayed',
  email: 'fatima@example.com',
  avatar: '',
  admin: false, superAdmin: false, user: true, isDriver: false, isInvitedUser: false,
  branchId: 'br-2',
  branches: [{ id: 'br-1', name: 'Sanabis' }, { id: 'br-2', name: 'Manama' }],
  hasSystemAccess: true,
  hireDate: '2025-07-14',
  terminationDate: null,
  profile: {
    nameAr: 'فاطمة السيد',
    employeeNumber: 'E-633648',
    mobile: '+97336001122',
    dateOfBirth: '1994-03-18',
    nationality: 'BH',
    address: { country: 'BH', city: 'Manama', block: '318', road: '1705', building: '42' },
  },
  employment: {
    department: 'Finance',
    position: 'Senior Accountant',
    employmentType: 'Full-time',
    status: 'Active',
    weeklyHours: 40,
  },
};

const BANK: any = {
  id: 'bank-1',
  bankName: 'Bank of Bahrain and Kuwait',
  accountHolderName: 'Fatima Al-Sayed',
  iban: 'BH67BMAG00001299123456',
  swift: 'BBKUBHBM',
  splitAccounts: [],
  updatedAt: null,
  updatedBy: null,
};

const PAY: any = {
  id: 'pay-1', employeeId: 'emp-77', effectiveFrom: '2025-07-14',
  basicSalary: 950, currency: 'BHD', payFrequency: 'Monthly',
  paymentMethod: 'BankTransfer', components: [],
};

function setup(opts: {
  record?: any;
  bank?: any;
  /** The pay revision in force. `paymentMethod` is a column on it. */
  pay?: any;
  features?: string[];
  /** A privilege tree. Absent means "super admin", which bypasses. */
  privileges?: any;
} = {}) {
  const getOne = vi.fn().mockResolvedValue('record' in opts ? opts.record : RECORD);
  const bankDetails = vi.fn().mockResolvedValue('bank' in opts ? opts.bank : BANK);
  const current = vi.fn().mockResolvedValue('pay' in opts ? opts.pay : PAY);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [EmployeeOverviewComponent, TranslateModule.forRoot()],
    providers: [
      { provide: EmployeeService, useValue: { getOne } },
      { provide: EmployeePayrollService, useValue: { bankDetails, current } },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      {
        provide: AuthService,
        // NOT an admin. Admins bypass every HR grant, so testing as one would
        // make the default-DENY cases pass without the grant check running.
        useValue: { currentEmployee: { id: 'me-1', admin: false, superAdmin: false } },
      },
      { provide: PrivilegeService, useValue: { privileges: opts.privileges ?? null } },
      {
        provide: ActivatedRoute,
        useValue: {
          // Empty: the overview declares no params of its own.
          snapshot: { paramMap: new Map() },
          parent: { snapshot: { paramMap: new Map([['id', 'emp-77']]) } },
        },
      },
    ],
  });

  if (opts.features?.length) TestBed.inject(FeatureService).setFeatures(opts.features);

  const fixture = TestBed.createComponent(EmployeeOverviewComponent);
  return {
    fixture, component: fixture.componentInstance,
    getOne, bankDetails, current, router: TestBed.inject(Router),
  };
}

async function load(fixture: ComponentFixture<EmployeeOverviewComponent>): Promise<void> {
  fixture.detectChanges();
  await flush();
  await flush();
  fixture.detectChanges();
}

/** The value shown for a given label key, or undefined if the row is absent. */
function valueOf(rows: { labelKey: string; value: string }[], key: string): string | undefined {
  return rows.find((r) => r.labelKey === key)?.value;
}

describe('the employee record overview', () => {
  it('reads the id off the parent route', async () => {
    const ctx = setup();
    await load(ctx.fixture);
    expect(ctx.getOne).toHaveBeenCalledWith('emp-77');
    expect(ctx.component.employeeId()).toBe('emp-77');
  });

  it('sends you back to the list when the record cannot be loaded', async () => {
    // Staying would leave an empty page with a name-less header and no
    // explanation of what went wrong.
    const ctx = setup({ record: null });
    await load(ctx.fixture);
    expect(ctx.router.navigate).toHaveBeenCalledWith(['/employees']);
  });

  it('names the PRIMARY branch, not merely the first one', async () => {
    // `branchId` is br-2 while br-1 is first in the array. A `branches[0]`
    // shortcut prints the wrong location and reads as correct.
    const ctx = setup();
    await load(ctx.fixture);
    expect(valueOf(ctx.component.basicRows(), 'EMPLOYEES.OVERVIEW.WORK_LOCATION')).toBe('Manama');
  });

  it('renders a date as written, without a timezone shift', async () => {
    // 2025-07-14 must print as the 14th. NOTE: this pins the FORMAT and the
    // day, but it cannot prove the UTC-parse hazard is gone — `new Date(iso)`
    // yields the same day in a positive-offset zone, which is where CI runs.
    // The guard is the split in `date()`; this case would only catch its
    // removal on a machine west of Greenwich.
    const ctx = setup();
    await load(ctx.fixture);
    expect(valueOf(ctx.component.basicRows(), 'EMPLOYEES.FORM.HIRE_DATE')).toBe('14/07/2025');
  });

  it('leaves out rows the record has no value for', async () => {
    // An empty row reads as missing data; the honest rendering is no row.
    const ctx = setup();
    await load(ctx.fixture);
    const keys = ctx.component.employmentRows().map((r) => r.labelKey);
    expect(keys).toContain('EMPLOYEES.FIELDS.EMPLOYMENT.DEPARTMENT');
    expect(keys).not.toContain('EMPLOYEES.FIELDS.EMPLOYMENT.COST_CENTER');
    expect(keys).not.toContain('EMPLOYEES.FORM.TERMINATION_DATE');
  });

  it('still has no ROWS for a record with no HR profile', async () => {
    const ctx = setup({ record: { ...RECORD, profile: undefined } });
    await load(ctx.fixture);
    expect(ctx.component.personalRows()).toEqual([]);
  });

  it('OFFERS the section anyway, so the pencil is reachable', async () => {
    /*
     * This reverses an earlier decision, deliberately.
     *
     * Hiding an empty section was the honest rendering of "no data" - but the
     * pencil that enters that data lives in the section header, and the only
     * other action on this page is Terminate. So a record with no `profile`
     * offered no way to give it one. Measured on dev: 291 of 292 employees
     * predate these groups, which is not an edge case, it is the table.
     *
     * The empty line says the data is missing, so the honesty is kept without
     * the dead end.
     */
    const ctx = setup({
      record: { ...RECORD, profile: undefined, employment: undefined },
    });
    await load(ctx.fixture);

    const el: HTMLElement = ctx.fixture.nativeElement;

    /*
     * NAMED, not counted. A `>= 2` on the empty lines passed with this very
     * section hidden, because the other two sections met the threshold on
     * their own - the mutant that restored the old guard stayed green. A
     * count is not an assertion about the section it is meant to be about.
     */
    const section = Array.from(el.querySelectorAll('section.card')).find((c) =>
      c.querySelector('.card__title')?.textContent?.includes('PERSONAL_DETAILS'),
    );
    expect(section).toBeTruthy();

    // Says the data is missing...
    expect(section!.querySelector('.kv__empty')).toBeTruthy();
    // ...and offers the way to enter it. Reaching the editor is the point.
    expect(section!.querySelector('.card__head .icon-btn')).toBeTruthy();
  });

  // ── Bank details ─────────────────────────────────────────────────────────
  describe('bank details', () => {
    it('are not even fetched without the payroll module', async () => {
      // Not merely hidden. Requesting them would be a refused call on every
      // record open, and a 200-shaped refusal is easy to render by accident.
      const ctx = setup();
      await load(ctx.fixture);
      expect(ctx.bankDetails).not.toHaveBeenCalled();
      expect(ctx.component.paymentRows()).toEqual([]);
    });

    it('are withheld from someone whose privilege set lacks viewBank', async () => {
      // Default-DENY: a set that simply does not mention the group is a denial,
      // not a gap. This is the case an `access !== false` check would fail.
      const ctx = setup({
        features: ['hr.payroll'],
        privileges: { employeePayrollSecurity: { actions: { viewPay: { access: true } } } },
      });
      await load(ctx.fixture);
      expect(ctx.bankDetails).not.toHaveBeenCalled();
      expect(ctx.component.paymentRows()).toEqual([]);
    });

    it('are shown to someone who holds viewBank', async () => {
      // The inverse of the two above — without it they would both pass with the
      // card wired to render never.
      const ctx = setup({
        features: ['hr.payroll'],
        privileges: { employeePayrollSecurity: { actions: { viewBank: { access: true } } } },
      });
      await load(ctx.fixture);
      expect(ctx.bankDetails).toHaveBeenCalledWith('emp-77');
      expect(valueOf(ctx.component.paymentRows(), 'EMPLOYEES.WIZARD.BANK_NAME'))
        .toBe('Bank of Bahrain and Kuwait');
    });

    it('says HOW the employee is paid, not only into what', async () => {
      // The card used to show an account and never the method — so a record
      // switched to cash looked identical to one paid by transfer.
      const ctx = setup({
        features: ['hr.payroll'],
        privileges: { employeePayrollSecurity: { actions: { viewBank: { access: true } } } },
      });
      await load(ctx.fixture);

      expect(valueOf(ctx.component.paymentRows(), 'EMPLOYEES.WIZARD.PAYMENT_METHOD'))
        .toBe('EMPLOYEES.WIZARD.METHOD_BANKTRANSFER');
    });

    it('hides the account entirely for someone paid in cash', async () => {
      // Switching to cash does NOT delete the bank row — nothing does. Showing
      // it beside "Cash" is a contradiction the reader has to resolve, and the
      // wrong resolution is "they still get a transfer".
      const ctx = setup({
        features: ['hr.payroll'],
        privileges: { employeePayrollSecurity: { actions: { viewBank: { access: true } } } },
        pay: { ...PAY, paymentMethod: 'Cash' },
      });
      await load(ctx.fixture);

      const keys = ctx.component.paymentRows().map((r) => r.labelKey);
      expect(keys).toContain('EMPLOYEES.WIZARD.PAYMENT_METHOD');
      expect(keys).not.toContain('EMPLOYEES.WIZARD.IBAN');
      expect(keys).not.toContain('EMPLOYEES.WIZARD.BANK_NAME');
    });

    it('masks the IBAN down to its last four', async () => {
      const ctx = setup({
        features: ['hr.payroll'],
        privileges: { employeePayrollSecurity: { actions: { viewBank: { access: true } } } },
      });
      await load(ctx.fixture);

      const shown = valueOf(ctx.component.paymentRows(), 'EMPLOYEES.WIZARD.IBAN')!;
      expect(shown).toContain('3456');
      // The assertion that matters: the full number must not be on the page.
      // Checking only for the last four would pass while printing all of it.
      expect(shown).not.toContain(BANK.iban);
      expect(shown).not.toContain('BH67');
    });

    it('still says how they are paid when the ACCOUNT lookup fails', async () => {
      // Two independent sources: the method is on the pay revision, the account
      // on the bank record. Losing one must not blank the other — and losing
      // the account is the less important half, since "paid by transfer" is
      // still a useful answer without the digits.
      const ctx = setup({
        features: ['hr.payroll'],
        privileges: { employeePayrollSecurity: { actions: { viewBank: { access: true } } } },
      });
      ctx.bankDetails.mockRejectedValueOnce(new Error('refused'));
      await load(ctx.fixture);

      expect(ctx.component.record()).toBeTruthy();
      const keys = ctx.component.paymentRows().map((r) => r.labelKey);
      expect(keys).toEqual(['EMPLOYEES.WIZARD.PAYMENT_METHOD']);
    });

    it('shows nothing at all when BOTH lookups fail', async () => {
      // The card must be absent, not present and empty — an empty payment card
      // reads as "no account on file", which is a different claim.
      const ctx = setup({
        features: ['hr.payroll'],
        privileges: { employeePayrollSecurity: { actions: { viewBank: { access: true } } } },
        bank: null,
        pay: null,
      });
      await load(ctx.fixture);

      expect(ctx.component.record()).toBeTruthy();
      expect(ctx.component.paymentRows()).toEqual([]);
    });
  });

  // ── Actions ──────────────────────────────────────────────────────────────
  it('opens the matching section of the form from a pencil', async () => {
    const ctx = setup();
    await load(ctx.fixture);

    ctx.component.edit('personal');

    expect(ctx.router.navigate).toHaveBeenCalledWith(
      ['/employees', 'emp-77', 'edit'],
      { queryParams: { section: 'personal' } },
    );
  });

  it('routes Terminate to End of Service rather than a second path', async () => {
    // EOS owns the blocking gates — open assets, clearance, settlement. A
    // termination that did not go through it would walk past all of them.
    const ctx = setup();
    await load(ctx.fixture);

    ctx.component.terminate();

    expect(ctx.router.navigate).toHaveBeenCalledWith(['/employees', 'emp-77', 'end-of-service']);
  });

  it('knows an already-terminated record has nothing left to terminate', async () => {
    const ctx = setup({ record: { ...RECORD, terminationDate: '2026-01-31' } });
    await load(ctx.fixture);
    expect(ctx.component.isTerminated()).toBe(true);
  });
});
