import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { HrError, describeError } from '../../hr-error';
import { portalKey } from '../../hr-labels';
import { hrGrantFor } from '../../hr-privilege';
import {
  BankDetails,
  EmployeeLoan,
  EmployeePayrollService,
  PayrollCatalog,
  PayrollRow,
} from '../../services/employee-payroll.service';
import {
  PayrollActor,
  isSubject,
  isValidIban,
  maskIban,
  mayEditBank,
  mayEditLoans,
  mayEditPay,
  mayViewBank,
  mayViewPay,
  splitTotal,
  splitsAreValid,
} from './payroll-rules';

/**
 * The payroll tab — salary, bank details and loans.
 *
 * ── TWO INDEPENDENTLY GATED PANELS ON ONE SCREEN ─────────────────────────────
 * `viewBank` is NOT implied by `viewPay`. Someone approving a rise has no
 * business seeing the IBAN; someone reconciling a failed transfer has no
 * business seeing the salary. Each panel asks its own question, and the subject
 * reads both and writes neither.
 *
 * ── netBeforeStatutory IS NOT TAKE-HOME PAY ──────────────────────────────────
 * This is the single most likely way this screen misleads someone, so the
 * disclaimer sits against the figure itself and not in a footnote. Gratuity,
 * GOSI and WPS are deliberately unimplemented (open question 3), and the server
 * says so on every row.
 *
 * ── A PAY CHANGE IS A NEW ROW ────────────────────────────────────────────────
 * The button says "Record a pay change", not "Edit salary", because that is
 * what happens: a new effective-dated row, with a required reason. There is no
 * update path on the server and there is none here.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Component({
  selector: 'app-employee-payroll',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-payroll.component.html',
  styleUrls: ['./employee-payroll.component.scss'],
})
export class EmployeePayrollComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(EmployeePayrollService);
  private readonly privileges = inject(PrivilegeService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  readonly employeeId =
    this.route.parent?.snapshot.paramMap.get('id')
    ?? this.route.snapshot.paramMap.get('id')
    ?? '0';

  readonly loading = signal(true);
  readonly busy = signal<string | null>(null);
  readonly error = signal<HrError | null>(null);

  readonly current = signal<PayrollRow | null>(null);
  readonly history = signal<PayrollRow[]>([]);
  readonly bank = signal<BankDetails | null>(null);
  readonly loans = signal<EmployeeLoan[]>([]);
  readonly catalog = signal<PayrollCatalog>({
    frequencies: [], paymentMethods: [], changeReasons: [],
    componentTypes: [], calculationMethods: [],
    // Assume the statutory calculations are missing until told otherwise.
    statutoryCalculationsAvailable: false,
  });

  readonly actor = computed<PayrollActor>(() => ({
    actorEmployeeId: (this.auth.currentEmployee as any)?.id ?? null,
    subjectEmployeeId: this.employeeId,
    canViewPay: hrGrantFor(this.privileges, this.auth, 'employeePayrollSecurity', 'viewPay'),
    canEditPay: hrGrantFor(this.privileges, this.auth, 'employeePayrollSecurity', 'editPay'),
    canViewBank: hrGrantFor(this.privileges, this.auth, 'employeePayrollSecurity', 'viewBank'),
    canEditBank: hrGrantFor(this.privileges, this.auth, 'employeePayrollSecurity', 'editBank'),
  }));

  readonly isOwnRecord = computed(() => isSubject(this.actor()));
  readonly canViewPay = computed(() => mayViewPay(this.actor()));
  readonly canEditPay = computed(() => mayEditPay(this.actor()));
  readonly canViewBank = computed(() => mayViewBank(this.actor()));
  readonly canEditBank = computed(() => mayEditBank(this.actor()));
  readonly canEditLoans = computed(() => mayEditLoans(this.actor()));

  /**
   * Does the current row carry statutory deductions?
   *
   * False on every row today. Read from the row and from the catalogue so the
   * disclaimer disappears on its own the day the calculations land.
   */
  readonly statutoryIncluded = computed(() =>
    this.current()?.statutoryDeductionsIncluded === true
    && this.catalog().statutoryCalculationsAvailable);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const catalog = await this.service.catalog().catch(() => this.catalog());
      this.catalog.set(catalog);

      // Each panel loads only what its grant allows, and each failure is
      // contained: a refused bank read must not blank the salary panel, and a
      // refused pay read must not blank the bank panel. That is the same split
      // the server enforces, expressed as separate requests.
      if (this.canViewPay()) {
        const [current, history, loans] = await Promise.all([
          this.service.current(this.employeeId).catch(() => null),
          this.service.history(this.employeeId).catch(() => [] as PayrollRow[]),
          this.service.loans(this.employeeId).catch(() => [] as EmployeeLoan[]),
        ]);
        this.current.set(current);
        this.history.set(history);
        this.loans.set(loans);
      }

      if (this.canViewBank()) {
        this.bank.set(await this.service.bankDetails(this.employeeId).catch(() => null));
      }
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Recording a pay change ────────────────────────────────────────────

  readonly recording = signal(false);

  readonly payForm = this.fb.group({
    effectiveFrom: this.fb.control<string | null>(null, Validators.required),
    basicSalary: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    currency: this.fb.control<string | null>(null, Validators.required),
    payFrequency: this.fb.control<string | null>(null, Validators.required),
    // Required by the server, and the reason the history is worth having.
    changeReason: this.fb.control<string | null>(null, Validators.required),
    changeNote: this.fb.control<string | null>(null),
    paymentMethod: this.fb.control<string | null>(null),
    socialInsuranceApplicable: this.fb.control<boolean>(false),
    wpsEnabled: this.fb.control<boolean>(false),
    gosiNumber: this.fb.control<string | null>(null),
    // Tax information — HELD, never computed from. No country's scheme is
    // encoded, so nothing here can be silently wrong; see the migration
    // header on 1784900000000_employee_payroll_tax.js.
    taxIdentifier: this.fb.control<string | null>(null),
    taxCountry: this.fb.control<string | null>(null),
    taxRatePercent: this.fb.control<number | null>(null),
    taxNotes: this.fb.control<string | null>(null),
    components: this.fb.array<any>([]),
  });

  get components(): FormArray { return this.payForm.controls.components as FormArray; }

  private componentGroup(c?: any) {
    return this.fb.group({
      type: this.fb.control<string | null>(c?.type ?? null, Validators.required),
      amount: this.fb.control<number | null>(c?.amount ?? null),
      // `PercentOfBasic` means 25 for 25%, never 0.25 — the two conventions are
      // equally common and mixing them is a factor-of-100 error in someone's pay.
      calculation: this.fb.control<string>(c?.calculation ?? 'Fixed'),
      isRecurring: this.fb.control<boolean>(c?.isRecurring ?? true),
      effectiveFrom: this.fb.control<string | null>(c?.effectiveFrom ?? null),
      effectiveTo: this.fb.control<string | null>(c?.effectiveTo ?? null),
    });
  }

  addComponent(): void { this.components.push(this.componentGroup()); }
  removeComponent(i: number): void { this.components.removeAt(i); }

  /**
   * Start a pay change.
   *
   * Seeded from the row currently in force — a change is nearly always a
   * variation on what is there, and retyping the components invites errors. The
   * effective date and the reason are deliberately left blank: they are the two
   * things that must be a decision, not a default.
   */
  startRecordChange(): void {
    const c = this.current();
    this.payForm.reset({
      effectiveFrom: null,
      basicSalary: c?.basicSalary ?? null,
      currency: c?.currency ?? null,
      payFrequency: c?.payFrequency ?? null,
      changeReason: null,
      changeNote: null,
      paymentMethod: c?.paymentMethod ?? null,
      socialInsuranceApplicable: c?.socialInsuranceApplicable ?? false,
      wpsEnabled: c?.wpsEnabled ?? false,
      gosiNumber: c?.gosiNumber ?? null,
      // Carried into the new row like the rest: tax details rarely change with
      // a pay rise, and retyping them invites a transcription error in an
      // identifier nobody re-checks. Effective dating still applies — this
      // seeds a NEW row, it does not edit the old one.
      taxIdentifier: c?.taxIdentifier ?? null,
      taxCountry: c?.taxCountry ?? null,
      taxRatePercent: c?.taxRatePercent ?? null,
      taxNotes: c?.taxNotes ?? null,
    });
    this.components.clear();
    (c?.components ?? []).forEach(x => this.components.push(this.componentGroup(x)));
    this.error.set(null);
    this.recording.set(true);
  }

  cancelRecord(): void { this.recording.set(false); }

  async submitPayChange(): Promise<void> {
    if (this.payForm.invalid) {
      this.payForm.markAllAsTouched();
      return;
    }
    this.busy.set('pay');
    this.error.set(null);
    try {
      // No id is ever sent. Every call inserts a new effective-dated row.
      await this.service.recordChange({
        employeeId: this.employeeId,
        ...this.payForm.getRawValue(),
      });
      this.recording.set(false);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  async removeRow(row: PayrollRow): Promise<void> {
    this.busy.set(row.id);
    this.error.set(null);
    try {
      await this.service.removeRow(row.id);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Bank details ──────────────────────────────────────────────────────

  readonly editingBank = signal(false);

  readonly bankForm = this.fb.group({
    bankName: this.fb.control<string | null>(null, Validators.required),
    iban: this.fb.control<string>('', Validators.required),
    swift: this.fb.control<string | null>(null),
    accountHolderName: this.fb.control<string | null>(null),
    splitAccounts: this.fb.array<any>([]),
  });

  get splitAccounts(): FormArray { return this.bankForm.controls.splitAccounts as FormArray; }

  private splitGroup(s?: any) {
    return this.fb.group({
      bankName: this.fb.control<string | null>(s?.bankName ?? null),
      iban: this.fb.control<string>(s?.iban ?? ''),
      percentage: this.fb.control<number | null>(s?.percentage ?? null),
    });
  }

  addSplit(): void { this.splitAccounts.push(this.splitGroup()); this.bankTick.update(n => n + 1); }
  removeSplit(i: number): void { this.splitAccounts.removeAt(i); this.bankTick.update(n => n + 1); }

  /** Bumped on every keystroke in the bank form so the checks re-evaluate. */
  readonly bankTick = signal(0);
  onBankInput(): void { this.bankTick.update(n => n + 1); }

  /**
   * The IBAN check, run as it is typed.
   *
   * A copy of the server's mod-97, and the server's answer still decides — but
   * a transposed character caught before the request is worth far more than one
   * caught after, because the failure is a salary paid into the wrong account.
   *
   * Null while the field is empty, so an untouched form is not shouted at.
   */
  readonly ibanValid = computed(() => {
    this.bankTick();
    const v = this.bankForm.controls.iban.value;
    return !v || !v.trim() ? null : isValidIban(v);
  });

  readonly splitTotal = computed(() => {
    this.bankTick();
    return splitTotal(this.splitAccounts.getRawValue());
  });

  readonly splitsOk = computed(() => {
    this.bankTick();
    return splitsAreValid(this.splitAccounts.getRawValue());
  });

  /** Every split account is itself an IBAN, and every one is worth checking. */
  readonly invalidSplitIbans = computed(() => {
    this.bankTick();
    return this.splitAccounts.getRawValue()
      .map((s: any, i: number) => ({ i, ok: !s?.iban?.trim() || isValidIban(s.iban) }))
      .filter((x: any) => !x.ok)
      .map((x: any) => x.i + 1);
  });

  readonly bankFormValid = computed(() =>
    this.bankForm.valid && this.ibanValid() === true
    && this.splitsOk() && this.invalidSplitIbans().length === 0);

  startEditBank(): void {
    const b = this.bank();
    this.bankForm.reset({
      bankName: b?.bankName ?? null,
      iban: b?.iban ?? '',
      swift: b?.swift ?? null,
      accountHolderName: b?.accountHolderName ?? null,
    });
    this.splitAccounts.clear();
    (b?.splitAccounts ?? []).forEach(s => this.splitAccounts.push(this.splitGroup(s)));
    this.onBankInput();
    this.error.set(null);
    this.editingBank.set(true);
  }

  cancelBank(): void { this.editingBank.set(false); }

  /** What the audit will record about this change: last four only. */
  readonly ibanChangePreview = computed(() => {
    this.bankTick();
    const from = this.bank()?.iban ?? null;
    const to = this.bankForm.controls.iban.value;
    if (!to || (from ?? '') === to) return null;
    return { from: maskIban(from), to: maskIban(to) };
  });

  async submitBank(): Promise<void> {
    if (!this.bankFormValid()) {
      this.bankForm.markAllAsTouched();
      return;
    }
    this.busy.set('bank');
    this.error.set(null);
    try {
      await this.service.saveBankDetails({
        employeeId: this.employeeId,
        ...this.bankForm.getRawValue(),
      });
      this.editingBank.set(false);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Loans ─────────────────────────────────────────────────────────────

  readonly editingLoan = signal<string | null>(null);

  readonly loanForm = this.fb.group({
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    currency: this.fb.control<string | null>(null),
    instalment: this.fb.control<number | null>(null),
    startDate: this.fb.control<string | null>(null),
    repaidAmount: this.fb.control<number | null>(null),
    isSettled: this.fb.control<boolean>(false),
    notes: this.fb.control<string | null>(null),
  });

  startAddLoan(): void {
    this.loanForm.reset({
      amount: null, currency: this.current()?.currency ?? null,
      instalment: null, startDate: null, repaidAmount: null,
      isSettled: false, notes: null,
    });
    this.error.set(null);
    this.editingLoan.set('new');
  }

  startEditLoan(l: EmployeeLoan): void {
    this.loanForm.reset({
      amount: l.amount, currency: l.currency, instalment: l.instalment,
      startDate: l.startDate, repaidAmount: l.repaidAmount,
      isSettled: l.isSettled ?? false, notes: l.notes,
    });
    this.error.set(null);
    this.editingLoan.set(l.id);
  }

  cancelLoan(): void { this.editingLoan.set(null); }

  async submitLoan(): Promise<void> {
    const editing = this.editingLoan();
    if (!editing) return;
    if (this.loanForm.invalid) {
      this.loanForm.markAllAsTouched();
      return;
    }
    this.busy.set(editing);
    this.error.set(null);
    try {
      await this.service.saveLoan({
        ...(editing === 'new' ? {} : { id: editing }),
        employeeId: this.employeeId,
        ...this.loanForm.getRawValue(),
      });
      this.editingLoan.set(null);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Display helpers ───────────────────────────────────────────────────

  /**
   * A money figure, at the currency's own precision.
   *
   * BHD, KWD and OMR are three-decimal currencies. Rounding to two in a
   * three-decimal currency is wrong on every payslip, and accounting notices
   * long before engineering does — so the decimals come from the currency, not
   * from a hardcoded 2.
   *
   * `| mycurrency` is not used here because it formats in the COMPANY's
   * currency, and a salary carries its own.
   */
  money(value: number | null, currency: string | null): string {
    if (value === null) return '—';
    const decimals = THREE_DECIMAL.has(String(currency ?? '').toUpperCase()) ? 3 : 2;
    return `${value.toFixed(decimals)}${currency ? ' ' + currency : ''}`;
  }

  frequencyLabel(key: string | null): string {
    const found = this.catalog().frequencies.find(f => f.key === key);
    return found?.labelKey ? portalKey(found.labelKey) : (key ?? '');
  }

  reasonLabel(key: string | null): string {
    const found = this.catalog().changeReasons.find(r => r.key === key);
    return found?.labelKey ? portalKey(found.labelKey) : (key ?? '');
  }

  componentLabel(key: string | null): string {
    const found = this.catalog().componentTypes.find(c => c.key === key);
    return found?.labelKey ? portalKey(found.labelKey) : (key ?? '');
  }

  methodLabel(key: string | null): string {
    const found = this.catalog().paymentMethods.find(m => m.key === key);
    return found?.labelKey ? portalKey(found.labelKey) : (key ?? '');
  }

  /** Does the chosen payment method need bank details at all? */
  readonly methodNeedsBank = computed(() => {
    const key = this.current()?.paymentMethod;
    const found = this.catalog().paymentMethods.find(m => m.key === key);
    return found ? found.needsBank === true : null;
  });

  maskIban = maskIban;

  optionKey = (o: { key: string }) => o.key;
  optionName = (o: { key: string; labelKey?: string }) =>
    o?.labelKey ? this.translate.instant(portalKey(o.labelKey)) : String(o?.key ?? '');
  optionMatches = (a: any, b: any) => (a?.key ?? a) === (b?.key ?? b);

  /** `Fixed` / `PercentOfBasic` arrive as bare strings, not descriptors. */
  readonly calculationOptions = computed(() =>
    this.catalog().calculationMethods.map(key => ({
      key,
      labelKey: `EMPLOYEES.PAYROLL.CALC.${key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()}`,
    })));

  trackRow = (_: number, r: PayrollRow) => r.id;
  trackLoan = (_: number, l: EmployeeLoan) => l.id;
  trackIndex = (i: number) => i;
}

/** Three-decimal currencies, copied from the server's `currencyDecimals`. */
const THREE_DECIMAL = new Set(['BHD', 'KWD', 'OMR', 'TND', 'IQD', 'JOD', 'LYD']);
