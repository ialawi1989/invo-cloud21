import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ApiService } from '@core/http/api.service';
import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MathUtils } from '@core/math/math-helpers';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { SupplierQuickCreateModalComponent } from '../../../suppliers/components/supplier-quick-create-modal/supplier-quick-create-modal.component';

import { BillingPayment, BillingPaymentLine } from '../../../models/billing-payment.model';
import { SalesLookupsService } from '../../../services/sales-lookups.service';
import { DocAttachment } from '../../../components/doc-attachments/doc-attachments.component';
import { DocAttachmentsCardComponent } from '../../../components/doc-attachments-card/doc-attachments-card.component';
import { SuppliersService } from '../../../suppliers/services/suppliers.service';
import { BillsPaymentService } from '../../services/bills-payment.service';
import { BillPaymentActions } from '../../services/bill-payment-actions';

/**
 * Bill payments -> create / edit (`/account/bills-payment/:id`, `new` / `0` = new) and the single-bill
 * "Pay" page (`/account/bills/pay/:billId`, which opens this form with that bill and its balance filled in).
 * Legacy `BillPaymentFormComponent`: pick a supplier, the amount paid and the method, then spread it over
 * the supplier's open bills (apply, pay in full, reset, per-bill amounts capped at what is due). Whatever is
 * paid beyond the bills stays with the supplier as a prepaid credit. The supplier can't change once saved.
 */
@Component({
  selector: 'app-bill-payment-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, MycurrencyPipe, BreadcrumbsComponent, FormStickyFooterComponent,
    SearchDropdownComponent, DatePickerComponent, DocAttachmentsCardComponent, DropdownMenuBtnComponent,
  ],
  templateUrl: './bill-payment-form.component.html',
  styleUrl: './bill-payment-form.component.scss',
})
export class BillPaymentFormComponent implements OnInit, CanLeaveComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private cdr = inject(ChangeDetectorRef);
  private api = inject(ApiService);
  private privileges = inject(PrivilegeService);
  private payments = inject(BillsPaymentService);
  private suppliers = inject(SuppliersService);
  private lookups = inject(SalesLookupsService);
  private actions = inject(BillPaymentActions);

  private canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  private listParams: Record<string, any> = {};
  private dirty = false;

  payment = new BillingPayment();
  formStatus: 'new' | 'edit' = 'new';
  breadcrumbs: BreadcrumbItem[] = [];
  branches: any[] = [];
  paymentMethods: any[] = [];
  supplierValue: { id: string; name: string } | null = null;
  outstandingPayable = 0;
  submitting = false;
  showErrors = false;
  showApplyPrompt = false;
  loaded = false;
  /** Opened from a bill's "Pay": the supplier is fixed. */
  locked = false;

  branchFilter = 'all';
  lineSearch = '';

  async ngOnInit(): Promise<void> {
    await Promise.all([this.lang.loadFeature('account/bills-payment'), this.lang.loadFeature('account/components/doc-lines-table'), this.lang.loadFeature('account/suppliers')]);
    const q = this.route.snapshot.queryParams;
    for (const k of ['pageNum', 'pageLimit', 'searchTerm', 'filterByBranch', 'fromDate', 'toDate']) {
      if (q[k]) this.listParams[k] = q[k];
    }

    this.branches = await this.lookups.getBranches();
    const id = this.route.snapshot.paramMap.get('id');
    const billId = this.route.snapshot.paramMap.get('billId');
    const isNew = !id || id === '0' || id === 'new';
    this.formStatus = isNew ? 'new' : 'edit';

    if (!isNew) {
      this.payment = await this.payments.getBillingPayment(id!);
      this.sortLinesByDate();
      this.supplierValue = this.payment.supplierId ? { id: this.payment.supplierId, name: this.payment.supplierName } : null;
    } else {
      this.payment = new BillingPayment();
      this.payment.lines = [];
      this.payment.paymentDate = BillingPayment.today();
      if (this.branches.length) this.payment.branchId = this.branches[0].id;
      const supplierId = q['supplierId'];
      if (supplierId) await this.selectSupplierById(supplierId);
      if (billId) await this.prepareForBill(billId);
    }

    await this.loadMethods();
    await this.refreshBalances();

    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs = [
      { label: t('BILLS_PAYMENT.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('BILLS_PAYMENT.LIST.PAYMENTS_LIST'), routerLink: '/account/bills-payment' },
      { label: t(isNew ? 'BILLS_PAYMENT.FORM.NEW_PAYMENT' : 'BILLS_PAYMENT.FORM.EDIT_PAYMENT') },
    ];
    this.loaded = true;
    this.cdr.detectChanges();
  }

  /** "Pay" on a bill: the supplier's open bills are loaded, only that bill keeps an amount (its balance) and the tender equals it. */
  private async prepareForBill(billId: string): Promise<void> {
    const bill: any = await this.api.request<any>(this.api.get('accounts/getBill/' + billId)).then(r => r?.data);
    if (!bill?.id) return;
    this.locked = true;
    this.payment.branchId = bill.branchId || this.payment.branchId;
    await this.selectSupplierById(bill.supplierId);
    const line = this.payment.lines.find(l => l.billingId === bill.id);
    if (line) {
      line.amount = line.calculateAmountDue;
      this.payment.tenderAmount = line.amount;
      this.payment.prevPaidAmount = line.amount;
    }
  }

  actionsMenu(): DropdownMenuBtnItem[] {
    if (this.formStatus !== 'edit' || !this.payment.id) return [];
    return this.actions.menu(this.payment, this.payment.id, () => { this.dirty = false; void this.router.navigate(['/account/bills-payment'], { queryParams: this.listParams }); });
  }

  hasUnsavedChanges(): boolean { return !this.submitting && this.dirty; }
  markDirty(): void { this.dirty = true; }

  // ── getters ────────────────────────────────────────────────────────
  get lines(): BillingPaymentLine[] { return this.payment.lines; }
  get visibleLines(): BillingPaymentLine[] {
    const term = this.lineSearch.trim().toLowerCase();
    return this.lines.filter(l =>
      (this.branchFilter === 'all' || l.branchId === this.branchFilter) &&
      (!term || String(l.billingNumber).toLowerCase().includes(term)));
  }
  get totalPayments(): number {
    const total = this.lines.reduce((s, l) => MathUtils.add(s, l.amount), 0);
    this.payment.paidAmount = total;
    return total;
  }
  get selectedMethod(): any { return this.paymentMethods.find(m => m.id == this.payment.paymentMethodId) ?? null; }
  get hasRate(): boolean { return this.payment.rate != 1 && this.payment.rate != null; }
  get methodLocked(): boolean {
    return this.formStatus === 'edit' && !this.privileges.check('paymentMethodSecurity.actions.changePaymentMethod.access');
  }
  get issues(): string[] {
    const p = this.payment;
    const out: string[] = [];
    if (!p.supplierId) out.push('BILLS_PAYMENT.REQUIRED.SUPPLIER');
    if (!p.paymentDate) out.push('BILLS_PAYMENT.REQUIRED.DATE');
    if (p.tenderAmount == null || (p.tenderAmount as any) === '') out.push('BILLS_PAYMENT.REQUIRED.AMOUNT');
    if (!p.paymentMethodId) out.push('BILLS_PAYMENT.REQUIRED.METHOD');
    return out;
  }
  fieldError(key: string): string {
    return this.showErrors && this.issues.includes('BILLS_PAYMENT.REQUIRED.' + key) ? this.lang.instant('DOC_LINES.ERR_REQUIRED') : '';
  }

  // ── supplier ───────────────────────────────────────────────────────
  loadSuppliers = async (p: { page: number; pageSize: number; search: string }) => {
    const d: any = await this.suppliers.getSuppliersMiniList({ page: p.page, limit: p.pageSize, searchTerm: p.search, supplierId: this.payment.supplierId || null });
    return { items: d?.list ?? [], hasMore: p.page < (d?.pageCount ?? 1) };
  };
  supplierLabel = (s: any) => s?.name ?? '';

  /** "New supplier" (legacy `addSupplier`): the quick-create dialog, then the new supplier is picked. */
  async createSupplier(): Promise<void> {
    const res = await this.modal.open<SupplierQuickCreateModalComponent, void, { supplierId: string; supplierName: string } | null>(
      SupplierQuickCreateModalComponent, { size: 'lg' },
    ).afterClosed();
    if (!res?.supplierId) return;
    await this.onSupplier({ id: res.supplierId, name: res.supplierName });
  }

  private async selectSupplierById(id: string): Promise<void> {
    const s: any = await this.suppliers.getSupplier(id);
    if (!s) return;
    this.payment.supplierId = s.id;
    this.payment.supplierName = s.name;
    this.supplierValue = { id: s.id, name: s.name };
    await this.loadSupplierBills(s.id);
  }

  async onSupplier(s: { id: string; name: string } | undefined): Promise<void> {
    this.supplierValue = s ?? null;
    this.payment.supplierId = s?.id ?? '';
    this.payment.supplierName = s?.name ?? '';
    if (s && !this.payment.id) await this.loadSupplierBills(s.id);
    else if (!s) this.payment.lines = [];
    this.payment.prevPaidAmount = 0;
    if (s) await this.refreshBalances();
    this.markDirty();
  }

  private async loadSupplierBills(supplierId: string): Promise<void> {
    const raw = (await this.payments.getSupplierBills(supplierId)) ?? [];
    this.payment.lines = raw.map((r: any) => { const l = new BillingPaymentLine(); l.ParseJson(r); return l; });
    this.sortLinesByDate();
    this.applyBranchFilter();
  }

  private sortLinesByDate(): void {
    this.payment.lines.sort((a, b) => new Date(a.billingDate).getTime() - new Date(b.billingDate).getTime());
  }

  /** What is still owed to the supplier at the branch + the chosen method's account balance. */
  private async refreshBalances(): Promise<void> {
    const p = this.payment;
    if (p.supplierId && p.branchId) {
      const res: any = await this.payments.getSupplierPayableByBranch(p.supplierId, p.branchId);
      this.outstandingPayable = res?.data?.outStandingPayable ?? 0;
    }
    if (p.paymentMethodId) {
      const res: any = await this.api.request<any>(this.api.get(`accounts/getPaymentMethodBalance/${p.paymentMethodId}${p.branchId ? '/' + p.branchId : ''}`));
      p.accountBalance = res?.data?.accountBalance ?? 0;
    }
  }

  // ── branch / method ────────────────────────────────────────────────
  branchOf = () => this.branches.find(b => b.id == this.payment.branchId) ?? null;
  branchLabel = (b: any) => b?.name ?? '';
  byId = (a: any, b: any) => a?.id === b?.id;
  methodLabel = (m: any) => m?.name ?? '';

  async onBranch(b: any): Promise<void> {
    this.payment.branchId = b?.id ?? '';
    if (this.payment.supplierId) {
      this.branchFilter = this.payment.branchId;
      await this.loadMethods();
      await this.refreshBalances();
    }
    this.applyBranchFilter();
    this.markDirty();
  }

  onBranchFilter(value: string): void { this.branchFilter = value; this.applyBranchFilter(); }
  private applyBranchFilter(): void { this.lines.forEach(l => l.setShowInFilter(this.branchFilter)); }

  private async loadMethods(): Promise<void> {
    this.paymentMethods = await this.lookups.getMiniPaymentMethods(this.payment.branchId, this.payment.paymentMethodId || null);
    if (this.paymentMethods.length && this.formStatus !== 'edit') {
      const m = this.paymentMethods[0];
      this.payment.paymentMethodId = m.id || this.payment.paymentMethodId;
      this.payment.paymentMethodType = m.type || this.payment.paymentMethodType;
      this.payment.paymentMethodName = m.name || this.payment.paymentMethodName;
      this.payment.rate = m.rate ?? 1;
    }
  }

  async onMethod(m: any): Promise<void> {
    const p = this.payment;
    p.paymentMethodId = m?.id ?? '';
    p.paymentMethodName = m?.name ?? '';
    p.paymentMethodType = m?.type ?? '';
    p.rate = m?.rate ?? 1;
    this.showApplyPrompt = p.tenderAmount > 0;
    await this.refreshBalances();
    this.markDirty();
  }

  private dateCache: { raw: string; date: Date } | null = null;
  /** The payment date as a `Date` for the picker (kept as `yyyy-MM-dd` on the record, like legacy). */
  get paymentDateValue(): Date {
    const raw = this.payment.paymentDate instanceof Date ? this.payment.paymentDate.toISOString() : String(this.payment.paymentDate);
    if (!this.dateCache || this.dateCache.raw !== raw) this.dateCache = { raw, date: new Date(this.payment.paymentDate) };
    return this.dateCache.date;
  }
  onPaymentDate(v: any): void {
    if (!(v instanceof Date)) return;
    const p = (n: number) => String(n).padStart(2, '0');
    this.payment.paymentDate = `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
    this.markDirty();
  }
  onAttachments(list: DocAttachment[]): void { this.payment.attachment = list; this.markDirty(); }

  // ── amounts ────────────────────────────────────────────────────────
  onTender(v: any): void {
    const p = this.payment;
    p.tenderAmount = v === '' || v == null ? (null as any) : Number(v);
    this.showApplyPrompt = p.tenderAmount > 0;
    this.markDirty();
  }

  /** Spreads the amount over the visible bills, oldest first, never above what each one owes. */
  applyAmount(): void {
    const p = this.payment;
    p.isReflected = true;
    let remaining = p.equivalentAmount;
    for (const line of this.visibleLines) {
      if (line.calculateAmountDue > 0) {
        line.amount = remaining > 0 ? +Math.min(line.calculateAmountDue, remaining).toFixed(MathUtils.afterDecimal) : 0;
        remaining -= line.amount;
      }
    }
    p.prevPaidAmount = p.equivalentAmount;
    this.showApplyPrompt = false;
    this.markDirty();
  }

  doNotApply(): void {
    const p = this.payment;
    this.showApplyPrompt = false;
    if (p.tenderAmount != 0 && p.tenderAmount * p.rate < p.paidAmount) this.lines.forEach(l => (l.amount = 0));
    p.prevPaidAmount = p.equivalentAmount;
  }

  fillAmounts(): void {
    const p = this.payment;
    p.paidAmount = 0;
    for (const line of this.visibleLines) {
      line.amount = MathUtils.sub(line.total, line.paidAmount);
      p.paidAmount = MathUtils.add(p.paidAmount, line.amount);
    }
    if (p.tenderAmount * p.rate < p.paidAmount) {
      p.tenderAmount = MathUtils.division(this.totalPayments, p.rate);
      p.prevPaidAmount = p.tenderAmount;
    }
    this.markDirty();
  }

  resetAmounts(): void {
    this.lines.forEach(l => (l.amount = 0));
    this.payment.tenderAmount = 0;
    this.payment.prevPaidAmount = 0;
    this.markDirty();
  }

  onLineAmount(line: BillingPaymentLine, v: any): void {
    const due = line.calculateAmountDue;
    let n = Number(v) || 0;
    if (n > due) n = due;
    line.amount = n;
    if (this.totalPayments > this.payment.equivalentAmount) this.payment.tenderAmount = MathUtils.division(this.totalPayments, this.payment.rate);
    this.markDirty();
  }

  removeLine(line: BillingPaymentLine): void {
    this.payment.lines = this.payment.lines.filter(l => l !== line);
    this.markDirty();
  }

  // ── save ───────────────────────────────────────────────────────────
  async save(): Promise<void> {
    if (this.submitting) return;
    const p = this.payment;
    if (this.issues.length) {
      this.showErrors = true;
      this.toast.error('COMMON.OPS', this.issues.map(k => this.lang.instant(k)).join(', '));
      return;
    }
    // Legacy: a payment can't be smaller than what it settles.
    if (p.tenderAmount > 0 && !(p.equivalentAmount >= p.calculateTotal())) {
      this.toast.error('COMMON.OPS', this.lang.instant('BILLS_PAYMENT.FORM.AMOUNT_BELOW_LINES'));
      return;
    }

    const allLines = p.lines;
    p.lines = allLines.filter(l => l.amount > 0);
    if (!p.lines.length) p.paidAmount = 0;
    p.accountId = null;
    p.unusedAmount = p.calculateAmountInExcess;

    this.submitting = true;
    try {
      const res: any = await this.payments.saveBillingPayment(p);
      if (res?.success) {
        this.dirty = false;
        this.toast.success('COMMON.SAVED_OK');
        void this.router.navigate(['/account/bills-payment'], { queryParams: this.listParams });
      } else {
        p.lines = allLines;
        this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
        this.submitting = false;
      }
    } catch (e: any) {
      p.lines = allLines;
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
      this.submitting = false;
    }
  }

  cancel(): void {
    if (this.canGoBack) this.location.back();
    else void this.router.navigate(['/account/bills-payment'], { queryParams: this.listParams });
  }

  view(): void {
    this.dirty = false;
    void this.router.navigate(['/account/bills-payment/view', this.route.snapshot.paramMap.get('id')], { queryParams: this.listParams });
  }
}
