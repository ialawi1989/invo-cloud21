import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ToastService } from '@shared/components/toast/toast.service';

import { EmployeeDetails } from '../../models/employee.types';
import { EmployeeService } from '../../services/employee.service';
import {
  BankDetails,
  EmployeePayrollService,
  PayrollRow,
} from '../../services/employee-payroll.service';
import { HR_PAYROLL, hrModuleEnabled } from '../../employee-feature-flags';
import { hrGrantFor } from '../../hr-privilege';
import { countryOptions } from '../../models/employee-catalogs';

/** One label/value line inside a card. `value` is already display-ready. */
interface OverviewRow {
  labelKey: string;
  value: string;
}

/**
 * The employee record, read first.
 *
 * Opening a person shows what is on file, not a form — the overwhelmingly
 * common reason to open a record is to LOOK something up, and a page of inputs
 * makes that a worse experience while inviting accidental edits. Each card
 * carries a pencil that opens the matching section of the form
 * (`edit?section=…`), so a correction is two clicks and touches one section.
 *
 * Everything here is derived from the record the API already returns. Nothing
 * on this page writes, which is why it needs no grant of its own beyond the
 * view grant the route already enforces — a card whose data the caller may not
 * read arrives empty from the server and is dropped by `rows.length`.
 */
@Component({
  selector: 'app-employee-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-overview.component.html',
  styleUrl: './employee-overview.component.scss',
})
export class EmployeeOverviewComponent implements OnInit {
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private service   = inject(EmployeeService);
  private payroll   = inject(EmployeePayrollService);
  private auth      = inject(AuthService);
  private privilegeSvc = inject(PrivilegeService);
  private translate = inject(TranslateService);
  private toast     = inject(ToastService);

  readonly loading = signal<boolean>(true);
  readonly record  = signal<EmployeeDetails | null>(null);
  readonly bank    = signal<BankDetails | null>(null);
  /** The pay revision in force — `paymentMethod` is a column on it. */
  readonly pay     = signal<PayrollRow | null>(null);
  readonly menuOpen = signal<boolean>(false);

  private payrollFlag = hrModuleEnabled(HR_PAYROLL);
  /** Bank details are readable only under `viewBank` — a separate grant from pay. */
  readonly canViewBank = computed<boolean>(() =>
    this.payrollFlag() && hrGrantFor(this.privilegeSvc, this.auth, 'employeePayrollSecurity', 'viewBank'));

  readonly employeeId = computed<string>(() => this.record()?.id ?? '');
  readonly name       = computed<string>(() => this.record()?.name ?? '');
  readonly employeeNumber = computed<string>(() => this.record()?.profile?.employeeNumber ?? '');
  readonly position   = computed<string>(() => this.record()?.employment?.position ?? '');
  readonly avatar     = computed<string>(() => this.record()?.avatar ?? '');

  /** Already ended, so Terminate has nothing left to do. */
  readonly isTerminated = computed<boolean>(() => !!this.record()?.terminationDate);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')
      ?? this.route.parent?.snapshot.paramMap.get('id')
      ?? null;
    if (!id || id === '0') { this.router.navigate(['/employees']); return; }

    this.loading.set(true);
    try {
      const [record, bank, pay] = await Promise.all([
        this.service.getOne(id),
        // A missing or refused bank record must not take the page down — the
        // rest of the record is still worth reading.
        this.canViewBank() ? this.payroll.bankDetails(id).catch(() => null) : Promise.resolve(null),
        // The METHOD lives here, not on the bank record. Without it the card
        // showed an account for someone paid in cash and never said how they
        // are actually paid.
        this.canViewBank() ? this.payroll.current(id).catch(() => null) : Promise.resolve(null),
      ]);
      if (!record) {
        this.toast.error('COMMON.LOAD_FAILED');
        this.router.navigate(['/employees']);
        return;
      }
      this.record.set(record);
      this.bank.set(bank);
      this.pay.set(pay);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Card contents ────────────────────────────────────────────────────────
  // Each builder drops empty lines rather than printing a dash: a record that
  // simply has no cost centre should not read as a record with a missing one.

  readonly basicRows = computed<OverviewRow[]>(() => {
    const r = this.record();
    if (!r) return [];
    return this.compact([
      ['EMPLOYEES.FORM.NAME',            r.name],
      ['EMPLOYEES.FORM.EMAIL',           r.email],
      ['EMPLOYEES.FORM.HIRE_DATE',       this.date(r.hireDate)],
      ['EMPLOYEES.OVERVIEW.WORK_LOCATION', this.primaryBranchName(r)],
      ['EMPLOYEES.OVERVIEW.ROLES',       this.roles(r)],
      ['EMPLOYEES.FORM.SYSTEM_ACCESS',   this.translate.instant(
        r.hasSystemAccess === false ? 'COMMON.DISABLED' : 'COMMON.ENABLED')],
    ]);
  });

  readonly personalRows = computed<OverviewRow[]>(() => {
    const p = this.record()?.profile;
    if (!p) return [];
    return this.compact([
      ['EMPLOYEES.FIELDS.PROFILE.NAME_AR',         p.nameAr],
      ['EMPLOYEES.FIELDS.PROFILE.EMPLOYEE_NUMBER', p.employeeNumber],
      ['EMPLOYEES.FIELDS.PROFILE.MOBILE',          p.mobile],
      ['EMPLOYEES.FIELDS.PROFILE.PERSONAL_EMAIL',  p.personalEmail],
      ['EMPLOYEES.FIELDS.PROFILE.DATE_OF_BIRTH',   this.date(p.dateOfBirth)],
      ['EMPLOYEES.FIELDS.PROFILE.NATIONALITY',     this.country(p.nationality)],
      ['EMPLOYEES.FIELDS.PROFILE.ADDRESS',         this.address(p)],
    ]);
  });

  readonly employmentRows = computed<OverviewRow[]>(() => {
    const r = this.record();
    const e = r?.employment;
    if (!e) return [];
    return this.compact([
      ['EMPLOYEES.FIELDS.EMPLOYMENT.DEPARTMENT',       e.department],
      ['EMPLOYEES.FIELDS.EMPLOYMENT.POSITION',         e.position],
      ['EMPLOYEES.FIELDS.EMPLOYMENT.EMPLOYMENT_TYPE',  e.employmentType],
      ['EMPLOYEES.FIELDS.EMPLOYMENT.STATUS',           e.status],
      ['EMPLOYEES.FIELDS.EMPLOYMENT.JOB_GRADE',        e.jobGrade],
      ['EMPLOYEES.FIELDS.EMPLOYMENT.COST_CENTER',      e.costCenter],
      ['EMPLOYEES.FIELDS.EMPLOYMENT.NOTICE_PERIOD_DAYS', this.num(e.noticePeriodDays)],
      ['EMPLOYEES.FIELDS.EMPLOYMENT.WEEKLY_HOURS',     this.num(e.weeklyHours)],
      ['EMPLOYEES.FORM.TERMINATION_DATE',              this.date(r?.terminationDate ?? null)],
    ]);
  });

  /**
   * How this employee is paid, and — only if by transfer — into what.
   *
   * The method comes off the PAY REVISION and the account off the bank record:
   * two tables, two endpoints. Showing the account regardless was wrong twice
   * over. It answered a question nobody asked (the row survives a switch to
   * cash, because changing how someone is paid does not delete their account),
   * and it never answered the one that matters, which is how they are paid now.
   */
  readonly paymentRows = computed<OverviewRow[]>(() => {
    const method = this.pay()?.paymentMethod ?? null;
    const b = this.bank();
    if (!method && !b) return [];

    const rows: [string, unknown][] = [];
    if (method) {
      rows.push([
        'EMPLOYEES.WIZARD.PAYMENT_METHOD',
        this.translate.instant(`EMPLOYEES.WIZARD.METHOD_${String(method).toUpperCase()}`),
      ]);
    }

    // Cash and cheque use no account. A stale bank row shown beside "Cash"
    // reads as a contradiction the viewer has to resolve.
    if (!method || method === 'BankTransfer') {
      rows.push(
        ['EMPLOYEES.WIZARD.BANK_NAME',      b?.bankName],
        ['EMPLOYEES.WIZARD.ACCOUNT_HOLDER', b?.accountHolderName],
        // Masked, always. A full IBAN on a page anyone with `viewBank` can
        // leave open is the number the fraud needs; the last four identify the
        // account for a human without handing it over.
        ['EMPLOYEES.WIZARD.IBAN',           this.maskIban(b?.iban ?? null)],
        ['EMPLOYEES.WIZARD.SWIFT',          b?.swift],
      );
    }
    return this.compact(rows);
  });

  // ── Actions ──────────────────────────────────────────────────────────────

  edit(section: string): void {
    this.router.navigate(['/employees', this.employeeId(), 'edit'], {
      queryParams: { section },
    });
  }

  toggleMenu(): void { this.menuOpen.set(!this.menuOpen()); }

  /** End of Service — the existing HR module, not a second termination path. */
  terminate(): void {
    this.menuOpen.set(false);
    this.router.navigate(['/employees', this.employeeId(), 'end-of-service']);
  }

  // ── Formatting ───────────────────────────────────────────────────────────

  private compact(pairs: [string, unknown][]): OverviewRow[] {
    return pairs
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
      .map(([labelKey, v]) => ({ labelKey, value: String(v) }));
  }

  private date(iso: string | null | undefined): string {
    if (!iso) return '';
    // Split rather than `new Date(iso)`: a bare 'YYYY-MM-DD' parses as UTC
    // midnight, which renders as the previous day anywhere west of Greenwich.
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return y && m && d ? `${d}/${m}/${y}` : '';
  }

  private num(v: number | null | undefined): string {
    return v === null || v === undefined ? '' : String(v);
  }

  private country(code: string | undefined): string {
    if (!code) return '';
    // Localised through the SAME catalogue the form's picker uses, so the
    // overview and the editor never disagree about a country's name.
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    return countryOptions(lang).find((o) => o.value === code)?.label ?? code;
  }

  private address(p: Record<string, any>): string {
    const a = p['address'];
    if (!a) return '';
    return [a.building, a.road, a.block, a.city, this.country(a.country)]
      .filter((part) => part !== null && part !== undefined && String(part).trim() !== '')
      .join(', ');
  }

  private roles(r: EmployeeDetails): string {
    const keys: string[] = [];
    if (r.superAdmin) keys.push('EMPLOYEES.FORM.SUPER_ADMIN');
    if (r.admin)      keys.push('EMPLOYEES.FORM.CLOUD_ADMIN');
    if (r.user)       keys.push('EMPLOYEES.FORM.POS_USER');
    if (r.isDriver)   keys.push('EMPLOYEES.FORM.IS_DRIVER');
    return keys.map((k) => this.translate.instant(k)).join(', ');
  }

  private primaryBranchName(r: EmployeeDetails): string {
    const list = Array.isArray(r.branches) ? r.branches : [];
    return list.find((b: any) => b?.id === r.branchId)?.name ?? list[0]?.name ?? '';
  }

  private maskIban(iban: string | null): string {
    if (!iban) return '';
    const tail = iban.slice(-4);
    return `•••• ${tail}`;
  }
}
