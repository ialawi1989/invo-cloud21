import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MathUtils } from '@core/math/math-helpers';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { CustomerPickerComponent, CustomerMini } from '@shared/components/customer-picker/customer-picker.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { CustomerAdvancedSearchModalComponent } from '../../../customers/components/customer-advanced-search-modal/customer-advanced-search-modal.component';

import { CustomersService } from '../../../customers/services/customers.service';
import { CustomerQuickCreateModalComponent } from '../../../customers/components/customer-quick-create-modal/customer-quick-create-modal.component';
import { InvoicePayment, InvoicePaymentLine } from '../../../models/invoice-payment.model';
import { SalesLookupsService } from '../../../services/sales-lookups.service';
import { DocAttachment, DocAttachmentsComponent } from '../../../components/doc-attachments/doc-attachments.component';
import { PaymentsService } from '../../services/payments.service';
import { RemainingAmountModalComponent, RemainingChoice } from '../../components/remaining-amount-modal/remaining-amount-modal.component';

/**
 * Payments → create / edit (`/account/payments/new`, `/:id`). Legacy `PaymentsFormComponent`: pick a
 * customer, the tender and method, then spread the amount over the customer's open invoices (auto
 * "apply", pay-in-full, reset, per-line amounts capped at what is due). Excess tender is kept as
 * wallet credit or handed back as change (asked on save). The customer can't change once saved.
 */
@Component({
  selector: 'app-payment-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, MycurrencyPipe, BreadcrumbsComponent, FormStickyFooterComponent,
    SearchDropdownComponent, DatePickerComponent, CustomerPickerComponent, DocAttachmentsComponent,
  ],
  templateUrl: './payment-form.component.html',
  styleUrl: './payment-form.component.scss',
})
export class PaymentFormComponent implements OnInit, CanLeaveComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private cdr = inject(ChangeDetectorRef);
  private privileges = inject(PrivilegeService);
  private payments = inject(PaymentsService);
  private customersService = inject(CustomersService);
  private lookups = inject(SalesLookupsService);

  private canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  private listParams: Record<string, any> = {};
  private dirty = false;

  payment = new InvoicePayment();
  formStatus: 'new' | 'edit' = 'new';
  breadcrumbs: BreadcrumbItem[] = [];
  branches: any[] = [];
  paymentMethods: any[] = [];
  customerValue: CustomerMini | null = null;
  outstandingReceivable = 0;
  bankChargeRate = 0;
  submitting = false;
  showErrors = false;
  showApplyPrompt = false;
  loaded = false;

  branchFilter = 'all';
  lineSearch = '';

  async ngOnInit(): Promise<void> {
    await Promise.all([this.lang.loadFeature('account/payments'), this.lang.loadFeature('account/components/doc-lines-table'), this.lang.loadFeature('account/customers')]);
    const q = this.route.snapshot.queryParams;
    for (const k of ['pageNum', 'pageLimit', 'searchTerm', 'filterBySource', 'filterByBranch', 'fromDate', 'toDate']) {
      if (q[k]) this.listParams[k] = q[k];
    }

    this.branches = await this.lookups.getBranches();
    const id = this.route.snapshot.paramMap.get('id');
    const isNew = !id || id === '0' || id === 'new';
    this.formStatus = isNew ? 'new' : 'edit';

    if (!isNew) {
      this.payment = await this.payments.getInvoicePayment(id!);
      this.sortLinesByDate();
      this.customerValue = this.payment.customerId && this.payment.customerId !== 'WalkIn Customer'
        ? { id: this.payment.customerId, name: this.payment.customerName, displayName: this.payment.customerName, phone: '', email: '' }
        : null;
    } else {
      this.payment = new InvoicePayment();
      if (this.branches.length) this.payment.branchId = this.branches[0].id;
      const customerId = q['customerId'];
      if (customerId) await this.selectCustomerById(customerId);
    }

    await this.loadMethods();
    if (this.payment.customerId && this.payment.customerId !== 'WalkIn Customer') await this.loadOutstanding();
    this.calculateBankCharge();

    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs = [
      { label: t('PAYMENTS.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('PAYMENTS.LIST.PAYMENTS_LIST'), routerLink: '/account/payments' },
      { label: t(isNew ? 'PAYMENTS.FORM.NEW_PAYMENT' : 'PAYMENTS.FORM.EDIT_PAYMENT') },
    ];
    this.loaded = true;
    this.cdr.detectChanges();
  }

  hasUnsavedChanges(): boolean { return !this.submitting && this.dirty; }
  markDirty(): void { this.dirty = true; }

  // ── getters ────────────────────────────────────────────────────────
  get lines(): InvoicePaymentLine[] { return this.payment.lines; }
  get visibleLines(): InvoicePaymentLine[] {
    const term = this.lineSearch.trim().toLowerCase();
    return this.lines.filter(l =>
      (this.branchFilter === 'all' || l.branchId === this.branchFilter) &&
      (!term || String(l.invoiceNumber).toLowerCase().includes(term)));
  }
  get totalPayments(): number {
    const total = this.lines.reduce((s, l) => MathUtils.add(s, l.amount), 0);
    this.payment.paidAmount = total;
    return total;
  }
  get selectedMethod(): any { return this.paymentMethods.find(m => m.id == this.payment.paymentMethodId) ?? null; }
  get hasRate(): boolean { return this.payment.rate != 1 && this.payment.rate != null; }
  get showBankCharge(): boolean { return this.payment.paymentMethodType === 'Card' || this.payment.bankCharge > 0; }
  get isCash(): boolean { return this.payment.paymentMethodType === 'Cash' || this.payment.paymentMethodType === 'Default Cash'; }
  get canRestoreChange(): boolean { return this.payment.changeEquivalentAmount <= 0 && this.payment.calculateAmountInExcess > 0; }
  get methodLocked(): boolean {
    return this.formStatus === 'edit' && !this.privileges.check('paymentMethodSecurity.actions.changePaymentMethod.access');
  }
  get issues(): string[] {
    const p = this.payment;
    const out: string[] = [];
    if (this.formStatus === 'new' && !p.customerId) out.push('PAYMENTS.REQUIRED.CUSTOMER');
    if (!p.paymentDate) out.push('PAYMENTS.REQUIRED.DATE');
    if (p.tenderAmount == null || (p.tenderAmount as any) === '') out.push('PAYMENTS.REQUIRED.AMOUNT');
    if (!p.paymentMethodId) out.push('PAYMENTS.REQUIRED.METHOD');
    return out;
  }
  fieldError(key: string): string {
    return this.showErrors && this.issues.includes('PAYMENTS.REQUIRED.' + key) ? this.lang.instant('DOC_LINES.ERR_REQUIRED') : '';
  }

  // ── customer ───────────────────────────────────────────────────────
  private async selectCustomerById(id: string): Promise<void> {
    const c: any = await this.customersService.getCustomer(id);
    if (!c) return;
    this.payment.customerId = c.id;
    this.payment.customerName = c.name;
    this.customerValue = { id: c.id, name: c.name, displayName: c.name, phone: c.phone ?? '', email: c.email ?? '' };
    await this.loadCustomerInvoices(c.id);
  }

  async onCustomer(c: CustomerMini | undefined): Promise<void> {
    this.customerValue = c ?? null;
    this.payment.customerId = c?.id ?? '';
    this.payment.customerName = c?.name ?? '';
    if (c && !this.payment.id) await this.loadCustomerInvoices(c.id);
    else if (!c) this.payment.lines = [];
    this.payment.prevPaidAmount = 0;
    if (c) await this.loadOutstanding();
    this.markDirty();
  }

  async advancedCustomerSearch(): Promise<void> {
    const c = await this.modal.open<CustomerAdvancedSearchModalComponent, void, CustomerMini | null>(
      CustomerAdvancedSearchModalComponent, { size: 'lg' },
    ).afterClosed();
    if (c) await this.onCustomer(c);
  }

  async createCustomer(): Promise<void> {
    const res = await this.modal.open<CustomerQuickCreateModalComponent, void, { customerId: string } | null>(
      CustomerQuickCreateModalComponent, { size: 'lg' },
    ).afterClosed();
    if (res?.customerId) await this.selectCustomerById(res.customerId);
  }

  private async loadCustomerInvoices(customerId: string): Promise<void> {
    const raw = (await this.payments.customerInvoices(customerId)) ?? [];
    this.payment.lines = raw.map((r: any) => { const l = new InvoicePaymentLine(); l.ParseJson(r); return l; });
    this.sortLinesByDate();
    this.applyBranchFilter();
  }

  private sortLinesByDate(): void {
    this.payment.lines.sort((a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime());
  }

  private async loadOutstanding(): Promise<void> {
    const res: any = await this.payments.getCustomerBranchReceivable(this.payment.customerId, this.payment.branchId);
    this.outstandingReceivable = res?.data?.outStandingRecivable ?? 0;
  }

  // ── branch / method ────────────────────────────────────────────────
  branchOf = () => this.branches.find(b => b.id == this.payment.branchId) ?? null;
  branchLabel = (b: any) => b?.name ?? '';
  byId = (a: any, b: any) => a?.id === b?.id;
  methodLabel = (m: any) => m?.name ?? '';

  async onBranch(b: any): Promise<void> {
    this.payment.branchId = b?.id ?? '';
    if (this.payment.customerId && this.payment.customerId !== 'WalkIn Customer') {
      await this.loadOutstanding();
      this.branchFilter = this.payment.branchId;
      await this.loadMethods();
    }
    this.applyBranchFilter();
    this.markDirty();
  }

  onBranchFilter(value: string): void { this.branchFilter = value; this.applyBranchFilter(); }
  private applyBranchFilter(): void {
    this.lines.forEach(l => l.setShowInFilter(this.branchFilter));
  }

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

  onMethod(m: any): void {
    const p = this.payment;
    const prevType = p.paymentMethodType;
    p.paymentMethodId = m?.id ?? '';
    p.paymentMethodName = m?.name ?? '';
    p.paymentMethodType = m?.type ?? '';
    p.rate = m?.rate ?? 1;
    this.showApplyPrompt = p.tenderAmount > 0;
    p.calculateChangeAmount();
    this.calculateBankCharge();
    if (prevType != m?.type) p.bankCharge = 0;
    this.markDirty();
  }

  calculateBankCharge(): void {
    const m = this.selectedMethod;
    if (m && this.payment.bankCharge == 0) {
      this.bankChargeRate = (m.bankCharge != null ? m.bankCharge : 0) / 100;
      this.payment.bankCharge = +(this.bankChargeRate * this.payment.tenderAmount);
    }
  }

  onBankCharge(v: any): void {
    const c = Number(v) || 0;
    this.payment.bankCharge = c > this.payment.tenderAmount ? this.payment.tenderAmount : c;
    this.markDirty();
  }

  onPaymentDate(v: any): void { if (v instanceof Date) { this.payment.paymentDate = v; this.markDirty(); } }
  onAttachments(list: DocAttachment[]): void { this.payment.attachment = list; this.markDirty(); }

  // ── amounts ────────────────────────────────────────────────────────
  onTender(v: any): void {
    const p = this.payment;
    p.tenderAmount = v === '' || v == null ? (null as any) : Number(v);
    this.showApplyPrompt = p.tenderAmount > 0;
    p.calculateChangeAmount();
    this.calculateBankCharge();
    this.markDirty();
  }

  /** Spreads the tender over the visible invoices, oldest first, never above what each one owes. */
  applyAmount(): void {
    const p = this.payment;
    p.isReflected = true;
    let remaining = p.equivalentAmount;
    for (const line of this.lines) {
      if (line.showInFilter === false) continue;
      if (line.calculateAmountDue > 0) {
        line.amount = remaining > 0 ? +Math.min(line.calculateAmountDue, remaining).toFixed(MathUtils.afterDecimal) : 0;
        remaining -= line.amount;
      }
    }
    this.calculateBankCharge();
    p.prevPaidAmount = p.equivalentAmount;
    p.calculateChangeAmount();
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
    for (const line of this.lines) {
      if (line.showInFilter === false) continue;
      line.amount = MathUtils.sub(line.total, line.paidAmount);
      p.paidAmount = MathUtils.add(p.paidAmount, line.amount);
    }
    if (p.tenderAmount * p.rate < p.paidAmount) {
      p.tenderAmount = +this.totalPayments.toFixed(MathUtils.afterDecimal) / p.rate;
      p.prevPaidAmount = p.tenderAmount;
    }
    p.calculateChangeAmount();
    this.markDirty();
  }

  resetAmounts(): void {
    this.lines.forEach(l => (l.amount = 0));
    this.payment.tenderAmount = 0;
    this.payment.prevPaidAmount = 0;
    this.payment.calculateChangeAmount();
    this.markDirty();
  }

  onLineAmount(line: InvoicePaymentLine, v: any): void {
    const due = line.calculateAmountDue;
    let n = Number(v) || 0;
    if (n > due) n = due;
    line.amount = n;
    if (this.totalPayments >= this.payment.equivalentAmount) this.setTenderFromLines();
    else this.payment.calculateChangeAmount();
    this.markDirty();
  }

  /** The tender follows the lines when they exceed it; otherwise the difference shows as change. */
  private setTenderFromLines(): void {
    const p = this.payment;
    p.tenderAmount = MathUtils.division(this.totalPayments, p.rate);
    p.calculateChangeAmount();
  }

  cancelChange(): void { this.payment.changeAmount = 0; this.markDirty(); }
  restoreChange(): void { this.payment.calculateChangeAmount(); this.markDirty(); }

  removeLine(line: InvoicePaymentLine): void {
    this.payment.lines = this.payment.lines.filter(l => l !== line);
    this.markDirty();
  }

  // ── save ───────────────────────────────────────────────────────────
  /** Excess tender: wallet credit or change. Returns false when the user backs out. */
  private async askRemaining(): Promise<boolean> {
    const p = this.payment;
    const remaining = MathUtils.sub(p.equivalentAmount, p.calculateTotal);
    if (remaining <= 0) return true;
    const amount = remaining.toFixed(MathUtils.afterDecimal);
    const choice = await this.modal.open<RemainingAmountModalComponent, { amount: string }, RemainingChoice>(RemainingAmountModalComponent, {
      size: 'sm', data: { amount },
    }).afterClosed();
    if (!choice || choice === 'cancel') return false;
    if (choice === 'change') p.calculateChangeAmount();
    else p.changeAmount = 0;
    return true;
  }

  async save(): Promise<void> {
    if (this.submitting) return;
    if (this.issues.length) {
      this.showErrors = true;
      this.toast.error('COMMON.OPS', this.issues.map(k => this.lang.instant(k)).join(', '));
      return;
    }
    if (!(await this.askRemaining())) return;

    const p = this.payment;
    const allLines = p.lines;
    const customerId = p.customerId;
    p.lines = allLines.filter(l => l.amount > 0);
    if (!p.lines.length) p.paidAmount = 0;
    if (p.customerId === 'WalkIn Customer') p.customerId = null;

    this.submitting = true;
    try {
      const res: any = await this.payments.saveInvoicePayment(p);
      if (res?.success) {
        this.dirty = false;
        this.toast.success('COMMON.SAVED_OK');
        void this.router.navigate(['/account/payments'], { queryParams: this.listParams });
      } else {
        p.customerId = customerId;
        p.lines = allLines;
        this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
        this.submitting = false;
      }
    } catch (e: any) {
      p.customerId = customerId;
      p.lines = allLines;
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
      this.submitting = false;
    }
  }

  cancel(): void {
    if (this.canGoBack) this.location.back();
    else void this.router.navigate(['/account/payments'], { queryParams: this.listParams });
  }

  view(): void {
    this.dirty = false;
    void this.router.navigate(['/account/payments/view', this.route.snapshot.paramMap.get('id')], { queryParams: this.listParams });
  }
}
