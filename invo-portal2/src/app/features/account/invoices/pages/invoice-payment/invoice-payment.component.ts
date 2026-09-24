import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { MathUtils } from '@core/math/math-helpers';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { VoucherPaymentComponent } from '../../../../promotions/components/voucher-payment/voucher-payment.component';
import { VouchersService } from '../../../../promotions/services/vouchers.service';
import { VouchersSettings } from '../../../../promotions/models/vouchers.model';
import { CustomerAddress } from '../../../customers/models/customer.model';
import { CustomersService } from '../../../customers/services/customers.service';
import { Invoice } from '../../../models/invoice.model';
import { InvoicePayment, InvoicePaymentLine } from '../../../models/invoice-payment.model';
import { PaymentsService } from '../../../payments/services/payments.service';
import { SalesLookupsService } from '../../../services/sales-lookups.service';
import { InvoicesService } from '../../services/invoices.service';

/**
 * Invoices → pay (`/account/invoices/payment/:id`). Legacy `PaymentsInvoiceComponent`:
 * amount (defaults to the balance), payment method with rate / bank charge, reference,
 * date and address, saved through `accounts/saveInvoicePayment`. Paying with the Vouchers
 * method redeems a gift voucher against the new payment line afterwards.
 * (The Points method is hidden until the points module is migrated.)
 */
@Component({
  selector: 'app-invoice-payment',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, MycurrencyPipe, BreadcrumbsComponent, FormStickyFooterComponent,
    SearchDropdownComponent, DatePickerComponent, VoucherPaymentComponent,
  ],
  templateUrl: './invoice-payment.component.html',
  styleUrl: './invoice-payment.component.scss',
})
export class InvoicePaymentComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private invoices = inject(InvoicesService);
  private payments = inject(PaymentsService);
  private lookups = inject(SalesLookupsService);
  private vouchers = inject(VouchersService);
  private customers = inject(CustomersService);

  @ViewChild(VoucherPaymentComponent) voucherPayment?: VoucherPaymentComponent;

  private canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;

  invoice: Invoice | null = null;
  payment = new InvoicePayment();
  paymentMethods: any[] = [];
  vouchersSettings: VouchersSettings | null = null;
  vouchersMethodId = '';
  balance = 0;
  bankChargeRate = 0;
  submitting = false;
  breadcrumbs: BreadcrumbItem[] = [];
  addresses: CustomerAddress[] = [];
  addressValue: CustomerAddress | null = null;
  private invoiceId = '';
  private invoiceNumber = '';

  async ngOnInit(): Promise<void> {
    await Promise.all([this.lang.loadFeature('account/invoices'), this.lang.loadFeature('promotions')]);
    this.invoiceId = this.route.snapshot.paramMap.get('id') ?? '';

    const [due, invoice, settings] = await Promise.all([
      this.invoices.getInvoiceBalance(this.invoiceId),
      this.invoices.getInvoice(this.invoiceId),
      this.vouchers.getVouchersSettings().catch(() => null),
    ]);
    this.invoice = invoice;
    this.vouchersSettings = settings;
    this.vouchersMethodId = settings?.paymentMethodId ?? '';

    const line = new InvoicePaymentLine();
    line.invoiceNumber = due.invoiceNumber;
    line.amount = +due.balance;
    this.invoiceNumber = due.invoiceNumber;
    this.balance = due.balance;
    this.payment.lines.push(line);

    const methods = await this.lookups.getMiniPaymentMethods(due.branchId);
    this.paymentMethods = methods.filter(m => m.name !== 'Points' && (settings?.enabled || m.name !== 'Vouchers'));

    if (invoice.customerId) {
      const raw = await this.customers.customerAddresses(invoice.customerId);
      this.addresses = (raw ?? []).map((r: any) => { const a = new CustomerAddress(); a.ParseJson(r); return a; });
    }

    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs = [
      { label: t('INVOICES.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('INVOICES.LIST.INVOICES_LIST'), routerLink: '/account/invoices' },
      { label: t('INVOICES.PAYMENT.PAYMENT') },
    ];
  }

  get line(): InvoicePaymentLine { return this.payment.lines[0]; }
  get selectedMethod(): any { return this.paymentMethods.find(m => m.id == this.payment.paymentMethodId) ?? null; }
  get isVoucher(): boolean { return !!this.payment.paymentMethodId && this.payment.paymentMethodId === this.vouchersMethodId; }
  get hasRate(): boolean { const r = this.selectedMethod?.rate; return r != null && r != 1; }
  get showBankCharge(): boolean { return (this.line.amount != null && this.payment.paymentMethodType == 'Card') || this.payment.bankCharge > 0; }
  get canSave(): boolean {
    if (this.submitting || !this.payment.paymentMethodId) return false;
    return this.isVoucher ? (this.voucherPayment?.isValid() ?? false) : true;
  }

  methodLabel = (m: any) => m?.name ?? '';
  byId = (a: any, b: any) => a?.id === b?.id;
  addressLabel = (a: CustomerAddress) => a?.title ?? '';

  // Memoised so the date-picker input keeps one Date instance between change-detection passes.
  onPaymentDate(v: any): void { if (v instanceof Date) this.payment.paymentDate = v; }

  onAmount(v: any): void {
    this.line.amount = Number(v) || 0;
    this.payment.equivalentAmountSinglePayment();
    this.calculateBankCharge();
  }

  onMethod(m: any): void {
    const p = this.payment;
    const prevType = p.paymentMethodType;
    p.paymentMethodId = m?.id ?? '';
    p.paymentMethodName = m?.name ?? '';
    p.paymentMethodType = m?.type ?? '';
    p.rate = m?.rate ?? 1;
    p.equivalentAmountSinglePayment();
    this.calculateBankCharge();
    if (prevType != p.paymentMethodType && p.paymentMethodType != 'Card') p.bankCharge = 0;
  }

  private calculateBankCharge(): void {
    const m = this.selectedMethod;
    if (!m) return;
    this.bankChargeRate = (m.bankCharge != null ? m.bankCharge : 0) / 100;
    this.payment.bankCharge = +(this.bankChargeRate * this.line.amount);
  }

  onBankCharge(v: any): void {
    const c = Number(v) || 0;
    this.payment.bankCharge = c > this.line.amount ? this.line.amount : c;
  }

  onAddress(a: CustomerAddress | null): void {
    this.addressValue = a;
    this.payment.customerAddress = a ?? new CustomerAddress();
  }

  // ── save ───────────────────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave) return;
    this.submitting = true;
    try {
      const res = this.isVoucher ? await this.saveWithVoucher() : await this.saveCash();
      if (res?.success) {
        this.toast.success('COMMON.SAVED_OK');
        void this.router.navigate(['/account/invoices']);
      } else {
        this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
        this.submitting = false;
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
      this.submitting = false;
    }
  }

  private async saveCash(): Promise<any> {
    const p = this.payment;
    const req = new InvoicePayment();
    const line = new InvoicePaymentLine();
    req.paymentMethodId = p.paymentMethodId;
    if (this.selectedMethod) req.rate = this.selectedMethod.rate;
    req.mediaId = p.mediaId;
    req.customerAddress = p.customerAddress;
    line.amount = p.equivalentAmounts;
    line.total = +this.line.amount;
    line.invoiceId = this.invoiceId;
    req.paymentDate = p.paymentDate;
    req.bankCharge = p.bankCharge;
    req.attachment = p.attachment;
    req.tenderAmount = +this.line.amount;
    req.paidAmount = p.equivalentAmounts;
    req.lines[0] = line;
    req.referenceNumber = p.referenceNumber;
    return this.payments.saveInvoicePayment(req);
  }

  /** Saves a payment for the voucher amount, then redeems the voucher against that payment line. */
  private async saveWithVoucher(): Promise<any> {
    const vp = this.voucherPayment!;
    const amount = vp.voucherAmount();
    const equivalent = +(amount * 1).toFixed(MathUtils.afterDecimal);

    const req = new InvoicePayment();
    const line = new InvoicePaymentLine();
    req.mediaId = this.payment.mediaId;
    req.paymentMethodId = this.payment.paymentMethodId;
    req.rate = 1;
    req.customerAddress = this.payment.customerAddress;
    line.amount = equivalent;
    line.total = amount;
    line.invoiceId = this.invoiceId;
    req.paymentDate = vp.paymentDate;
    req.tenderAmount = amount;
    req.paidAmount = equivalent;
    req.lines[0] = line;

    const res = await this.payments.saveInvoicePayment(req);
    if (res?.success) {
      await vp.spend(this.invoiceNumber, this.invoiceId, res.data.id);
    }
    return res;
  }

  cancel(): void {
    if (this.canGoBack) this.location.back();
    else void this.router.navigate(['/account/invoices']);
  }
}
