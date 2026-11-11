import { ChangeDetectorRef, Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { DateFieldComponent } from '@shared/components/date-field/date-field.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { SalesLookupsService } from '../../../account/services/sales-lookups.service';

import { EmployeePayoutPayload, PayoutLine, SavedPayoutLine, buildPayoutLines, payoutTotal, toPayoutLinesPayload } from '../../models/employee-earnings.types';
import { EmployeePayoutService } from '../../services/employee-payout.service';
import { EmployeeService } from '../../services/employee.service';

interface Option { id: string; name: string }
interface MethodOption extends Option {
  /** The method's account for the selected branch, shown for reference. */
  accountName: string;
}

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * New or edited employee payout (`/employees/payouts/:id`, `0` = new).
 *
 * Amounts are never computed here beyond the running total: the server decides what's outstanding, which rows are
 * pre-selected, and re-checks every line on save. The payout sends a payment method; the server pays from that
 * method's account for the payout's branch.
 */
@Component({
  selector: 'app-employee-payout-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, MycurrencyPipe,
    BreadcrumbsComponent, SearchDropdownComponent, DateFieldComponent, FormStickyFooterComponent, LoadingOverlayComponent,
  ],
  templateUrl: './employee-payout-form.component.html',
  styleUrl: '../earnings-pages.scss',
})
export class EmployeePayoutFormComponent implements OnInit, CanLeaveComponent {
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private service   = inject(EmployeePayoutService);
  private employeesApi = inject(EmployeeService);
  private lookups   = inject(SalesLookupsService);
  private toast     = inject(ToastService);
  private translate = inject(TranslateService);
  private cdr       = inject(ChangeDetectorRef);

  /** null for a new payout. */
  payoutId: string | null = null;
  employees: Option[] = [];
  branches: Option[] = [];
  paymentMethods: MethodOption[] = [];

  employee: Option | null = null;
  branch: Option | null = null;
  method: MethodOption | null = null;
  paymentDate: string | null = today();
  reference = '';
  notes = '';

  lines: PayoutLine[] = [];
  /** End of the last completed payment cycle; null for the manual cycle. */
  periodEnd: string | null = null;
  payablesLoaded = false;
  loadingPayables = false;
  loading = true;
  saving = false;
  dirty = false;

  /** Lines of the payout being edited, merged back into the payables. */
  private existingLines: SavedPayoutLine[] = [];

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: this.translate.instant('MENU.EMPLOYEES'), routerLink: '/employees' },
    { label: this.translate.instant('MENU.SUB.EMPLOYEE_PAYOUTS'), routerLink: '/employees/payouts' },
    { label: this.translate.instant('EMPLOYEE_PAYOUT.PAYOUT') },
  ]);

  readonly displayName = (o: Option) => o?.name ?? '';
  readonly sameId = (a: Option, b: Option) => a?.id === b?.id;

  constructor() { withTranslations('employees'); }

  get isEdit(): boolean { return this.payoutId != null; }
  get total(): number { return payoutTotal(this.lines); }
  get hasOffsets(): boolean { return this.lines.some(l => l.isOffset); }

  hasUnsavedChanges(): boolean { return this.dirty && !this.saving; }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    this.payoutId = id && id !== '0' && id !== 'new' ? id : null;

    try {
      const [employees, branches] = await Promise.all([
        this.employeesApi.getList({ page: 1, limit: 1000 }),
        this.lookups.getBranches(),
      ]);
      this.employees = (employees.list ?? []).map((e: any) => ({ id: e.id, name: e.name }));
      this.branches = (branches ?? []).map((b: any) => ({ id: b.id, name: b.name }));

      if (this.payoutId) {
        const res = await this.service.getEmployeePayout(this.payoutId);
        if (!res?.success) {
          this.toast.error('COMMON.LOAD_FAILED', res?.msg);
          void this.router.navigate(['/employees/payouts']);
          return;
        }
        const p = res.data;
        this.employee = this.employees.find(e => e.id === p.employeeId) ?? { id: p.employeeId, name: p.employeeName };
        this.branch = this.branches.find(b => b.id === p.branchId) ?? null;
        this.paymentDate = String(p.paymentDate ?? '').slice(0, 10) || today();
        this.reference = p.reference ?? '';
        this.notes = p.notes ?? '';
        this.existingLines = p.lines ?? [];
        await this.loadPaymentMethods(p.paymentMethodId ?? null);
        await this.loadPayables();
      } else if (this.branches.length === 1) {
        this.branch = this.branches[0];
        await this.loadPaymentMethods();
      }
    } catch (e: any) {
      this.toast.error('COMMON.LOAD_FAILED', e?.message);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async onEmployee(e: Option | null): Promise<void> {
    this.employee = e;
    this.dirty = true;
    await this.loadPayables();
  }

  /** The account shown next to each method can differ per branch, so the list is reloaded. */
  async onBranch(b: Option | null): Promise<void> {
    this.branch = b;
    this.dirty = true;
    await this.loadPaymentMethods(this.method?.id ?? null);
  }

  /** Aggregator methods pay nobody, so a payout can't come from one. */
  private isAggregatorMethod(m: any): boolean {
    const name = String(m?.name ?? '').toLowerCase();
    return name.startsWith('talabat') || name.startsWith('jahez') || name.startsWith('keeta');
  }
  /** Points and vouchers are promotion methods: they pay nobody either. */
  private isPromotionMethod(m: any): boolean {
    const type = String(m?.type ?? '').toLowerCase();
    return type.startsWith('point') || type.startsWith('voucher');
  }
  /** Default cash first, then cards, then other cash methods; anything else last. Ties keep the server's order. */
  private methodRank(m: any): number {
    const type = String(m?.type ?? '').toLowerCase();
    if (type === 'default cash') return 0;
    if (type === 'card') return 1;
    if (type === 'cash') return 2;
    return 3;
  }

  /** Loads the payment methods for the selected branch. Keeps the wanted method when it's still offered; a new payout starts on the first one. */
  async loadPaymentMethods(wantedId: string | null = null): Promise<void> {
    if (!this.branch) {
      this.paymentMethods = [];
      this.method = null;
      return;
    }
    try {
      // Only methods an admin has switched on for accounting (showInAccount).
      const methods = await this.lookups.getMiniPaymentMethods(this.branch.id, wantedId, undefined, true);
      this.paymentMethods = (methods ?? [])
        .filter((m: any) => !this.isPromotionMethod(m) && !this.isAggregatorMethod(m))
        .sort((a: any, b: any) => this.methodRank(a) - this.methodRank(b))
        .map((m: any) => ({ id: m.id, name: m.name, accountName: m.accountName ?? '' }));
      this.method = this.paymentMethods.find(m => m.id === wantedId) ?? (this.isEdit ? null : this.paymentMethods[0] ?? null);
    } catch (e: any) {
      this.toast.error('COMMON.LOAD_FAILED', e?.message);
    }
    this.cdr.markForCheck();
  }

  /** (Re)loads the employee's open items. Also used by Refresh: new items arrive a moment after an invoice or payment is saved. */
  async loadPayables(): Promise<void> {
    if (!this.employee) {
      this.lines = [];
      this.periodEnd = null;
      this.payablesLoaded = false;
      return;
    }
    this.loadingPayables = true;
    try {
      const res = await this.service.getEmployeePayables(this.employee.id);
      if (!res?.success) {
        this.toast.error('COMMON.LOAD_FAILED', res?.msg);
        return;
      }
      this.periodEnd = res.data?.periodEnd ?? null;
      this.lines = buildPayoutLines(res.data?.records ?? [], this.isEdit ? this.existingLines : undefined);
      this.payablesLoaded = true;
      if (!this.branch) {
        const branchId = this.lines.find(l => l.record.branchId)?.record.branchId;
        this.branch = this.branches.find(b => b.id === branchId) ?? null;
        if (this.branch) await this.loadPaymentMethods();
      }
    } catch (e: any) {
      this.toast.error('COMMON.LOAD_FAILED', e?.message);
    } finally {
      this.loadingPayables = false;
      this.cdr.markForCheck();
    }
  }

  /** The first problem as a translation key, or null. The server re-checks everything. */
  private validate(): string | null {
    if (!this.employee) return 'EMPLOYEE_PAYOUT.ERRORS.EMPLOYEE_REQUIRED';
    if (!this.branch) return 'EMPLOYEE_PAYOUT.ERRORS.BRANCH_REQUIRED';
    if (!this.paymentDate) return 'EMPLOYEE_PAYOUT.ERRORS.DATE_REQUIRED';
    if (!this.method) return 'EMPLOYEE_PAYOUT.PAYMENT_METHOD_REQUIRED';
    const selected = this.lines.filter(l => l.selected);
    if (selected.length === 0) return 'EMPLOYEE_PAYOUT.ERRORS.NO_ITEMS';
    const lineError = selected.map(l => l.amountError).find(e => e != null);
    if (lineError) return lineError;
    if (!(this.total > 0)) return 'EMPLOYEE_PAYOUT.ERRORS.TOTAL_NOT_POSITIVE';
    return null;
  }

  async save(): Promise<void> {
    const problem = this.validate();
    if (problem) {
      this.toast.error(problem);
      return;
    }

    const payload: EmployeePayoutPayload = {
      employeeId: this.employee!.id,
      branchId: this.branch!.id,
      paymentDate: this.paymentDate as string,
      paymentMethodId: this.method!.id,
      reference: this.reference.trim() || null,
      notes: this.notes.trim() || null,
      lines: toPayoutLinesPayload(this.lines),
    };
    if (this.payoutId) payload.id = this.payoutId;

    this.saving = true;
    try {
      const res = await this.service.saveEmployeePayout(payload);
      if (res?.success) {
        this.dirty = false;
        this.toast.success('COMMON.SAVED_OK');
        void this.router.navigate(['/employees/payouts/view', res.data.id]);
      } else {
        this.toast.error('COMMON.SAVE_FAILED', res?.msg);
      }
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.error?.msg ?? e?.message);
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  cancel(): void {
    void this.router.navigate(this.payoutId ? ['/employees/payouts/view', this.payoutId] : ['/employees/payouts']);
  }
}
