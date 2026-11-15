import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { DocumentTemplate, parseTemplate } from '@features/settings/document-builder/services/document-template.types';
import { findProviderByName } from '@features/settings/payment-methods/utils/provider-registry';

import '../../e-invoice-i18n';
import { Invoice } from '../../../account/models/invoice.model';
import { EInvoiceCompany, EInvoicePaymentMethod, decodeEInvoiceToken } from '../../models/e-invoice.model';
import { EInvoiceService } from '../../services/e-invoice.service';
import { EInvoicePaperComponent } from '../../components/e-invoice-paper/e-invoice-paper.component';

/** Legacy injects its gateway scripts through `SharedService.loadExternalScript` (a script tag, skipped when its id is already on the page). */
function loadScript(src: string, id: string, extra: Record<string, unknown> = {}): Promise<void> {
  if (document.getElementById(id)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.id = id;
    Object.assign(s, extra);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load script: ' + src));
    document.body.appendChild(s);
  });
}

/**
 * Public invoice payment page (`/einvoice/:token`) - the legacy `EInvoiceComponent`. The token is
 * `base64(companyId|+|invoiceId)`; the page loads the invoice, the company's invoice template and the enabled
 * payment methods, shows the invoice paper and starts the chosen gateway's payment through `eInvoice/payInvoice`.
 * Gateways redirect back here with `?success=true|false&errorMsg=` (set by the backend callbacks).
 */
@Component({
  selector: 'app-e-invoice-pay',
  standalone: true,
  imports: [CommonModule, TranslateModule, EmptyStateComponent, SegmentedToggleComponent, EInvoicePaperComponent],
  templateUrl: './e-invoice-pay.component.html',
  styleUrl: '../../e-invoice-public.scss',
})
export class EInvoicePayComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(EInvoiceService);
  readonly lang = inject(LanguageService);

  private payBox = viewChild<ElementRef<HTMLElement>>('payBox');

  loading = signal(true);
  invalid = signal(false);
  paying = signal(false);
  invoice = signal<Invoice | null>(null);
  company = signal<EInvoiceCompany | null>(null);
  template = signal<DocumentTemplate | null>(null);
  methods = signal<EInvoicePaymentMethod[]>([]);
  methodName = signal('');
  notice = signal<{ kind: 'success' | 'error'; text: string } | null>(null);

  token = '';
  private companyId = '';
  private invoiceId = '';
  private benefitPayOpen = false;

  readonly balance = computed(() => Number(this.invoice()?.balance ?? 0));
  readonly enabledMethods = computed(() => this.methods().filter(m => m.isEnabled));
  readonly langOptions: SegmentedToggleOption<string>[] = [
    { value: 'en', label: 'English', translate: false },
    { value: 'ar', label: 'العربية', translate: false },
  ];

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('e-invoice');
    this.route.paramMap.subscribe(async p => {
      this.token = p.get('token') ?? '';
      const ids = decodeEInvoiceToken(this.token);
      if (!ids) { this.fail(); return; }
      this.companyId = ids.companyId;
      this.invoiceId = ids.invoiceId;
      this.readCallbackResult();
      await this.load();
    });
  }

  private fail(): void { this.invalid.set(true); this.loading.set(false); }

  /** The backend's gateway callbacks come back with `?success=false&errorMsg=` / `?success=true`. */
  private readCallbackResult(): void {
    const q = this.route.snapshot.queryParamMap;
    if (q.get('success') === 'false') this.notice.set({ kind: 'error', text: q.get('errorMsg') || this.lang.instant('COMMON.OPS') });
    else if (q.get('success') === 'true') this.notice.set({ kind: 'success', text: this.lang.instant('EINVOICE.PAID') });
    else if (q.get('errorMsg')) this.notice.set({ kind: 'error', text: q.get('errorMsg')! });
  }

  private async load(): Promise<void> {
    let data;
    try {
      data = await this.api.getInvoice(this.companyId, this.invoiceId);
    } catch { this.fail(); return; }
    // A wrong invoice/company id answers HTTP 200 with an empty body, so check for a real id (legacy).
    if (!data?.invoice?.id || !data.company?.id) { this.fail(); return; }

    this.invoice.set(data.invoice);
    this.company.set(data.company);

    // `getInvoiceTemplate` answers `{ invoiceBuilder: {...} }`; a missing/invalid one falls back to a fresh invoice template.
    const tr = await this.api.getInvoiceTemplate(this.companyId);
    this.template.set(parseTemplate(tr?.invoiceBuilder ?? {}, 'invoice'));
    this.loading.set(false);

    try {
      this.methods.set(await this.api.getPaymentMethods(this.companyId));
    } catch {
      this.methods.set([]); // show the invoice without payment options
    }
  }

  setLanguage(code: string): void { void this.lang.use(code); }

  scrollToPay(): void { this.payBox()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'center' }); }

  methodLabel(m: EInvoicePaymentMethod): string {
    return m.translation?.name?.[this.lang.current()] || m.translation?.name?.['en'] || m.name;
  }

  /** `icon` is `default` | `Debit Card` | `Credit Card` (the picker of the payment-method connect page). */
  methodIcon(m: EInvoicePaymentMethod): string | null {
    if (m.icon === 'Debit Card') return 'images/payment-icons/card.svg';
    if (m.icon === 'Credit Card') return 'images/payment-icons/credit-card.svg';
    return findProviderByName(m.name)?.logo ?? null;
  }

  async pay(): Promise<void> {
    if (!this.methodName() || this.paying()) return;
    this.paying.set(true);
    this.notice.set(null);
    try {
      if (this.methodName().toLowerCase() === 'applepay') {
        await this.applePay();
      } else {
        const res = await this.api.payInvoice({ companyId: this.companyId, invoiceId: this.invoiceId, paymentName: this.methodName() });
        if (res.success) await this.openGateway(res);
        else {
          this.paying.set(false);
          this.notice.set({ kind: 'error', text: res.ms ?? res.msg ?? this.lang.instant('COMMON.OPS') });
        }
      }
    } catch (e: any) {
      this.paying.set(false);
      this.notice.set({ kind: 'error', text: e?.error?.msg ?? e?.message ?? this.lang.instant('COMMON.OPS') });
    }
  }

  /** Per-gateway hand-off, exactly the legacy `loadPaymentMethod`. */
  private async openGateway(res: any): Promise<void> {
    const name = this.methodName();
    const w = window as any;

    if (name === 'BenefitPay') {
      await loadScript('./assets/js/InApp.min.js', 'InApp');
      this.benefitPayOpen = true;
      const temp = res.data;
      await w.InApp.open({ ...temp },
        () => void this.checkBenefitPayStatus(temp.referenceNumber),
        () => void this.checkBenefitPayStatus(temp.referenceNumber),
        () => { if (this.benefitPayOpen) void this.checkBenefitPayStatus(temp.referenceNumber, true); });
      return;
    }
    if (name === 'MaxWallet') {
      await loadScript('./assets/js/MaxWallet.min.js', 'MaxWallet');
      return;
    }
    if (name === 'afs' || name === 'CrediMax') {
      const src = name === 'afs'
        ? 'https://afs.gateway.mastercard.com/static/checkout/checkout.min.js'
        : 'https://credimax.gateway.mastercard.com/static/checkout/checkout.min.js';
      await loadScript(src, 'checkout-' + name, { 'data-error': 'errorCallback', 'data-cancel': 'cancelCallback' });
      if (typeof w.Checkout === 'undefined') {
        this.paying.set(false);
        this.notice.set({ kind: 'error', text: this.lang.instant('EINVOICE.GATEWAY_UNAVAILABLE') });
        return;
      }
      await w.Checkout.configure({ session: { id: res.data.sessionId } });
      await w.Checkout.showPaymentPage();
      return;
    }
    window.location.href = res.data.url;
  }

  private async checkBenefitPayStatus(referenceNumber: string, skipClose = false): Promise<void> {
    const w = window as any;
    try {
      const res = await this.api.checkBenefitPayStatus({ referenceId: referenceNumber, companyId: this.companyId });
      if (res.success) {
        this.notice.set({ kind: 'success', text: this.lang.instant('EINVOICE.PAID') });
        await this.load();
      } else {
        this.notice.set({ kind: 'error', text: res.msg ?? this.lang.instant('COMMON.OPS') });
      }
      this.benefitPayOpen = false;
      if (!skipClose) w.InApp?.close();
    } catch (e: any) {
      this.benefitPayOpen = false;
      this.notice.set({ kind: 'error', text: e?.error?.msg ?? e?.message ?? this.lang.instant('COMMON.OPS') });
      if (!skipClose) w.InApp?.close();
    } finally {
      this.paying.set(false);
    }
  }

  /** Apple Pay sheet (legacy `applePayButtonClicked`): merchant validation and the authorized payment both go through the backend. */
  private async applePay(): Promise<void> {
    const Session = (window as any).ApplePaySession;
    if (!Session || !Session.canMakePayments()) { this.paying.set(false); return; }

    // Legacy request values (country / currency are fixed to Bahrain there).
    const request = {
      countryCode: 'BH',
      currencyCode: 'BHD',
      supportedNetworks: ['visa', 'masterCard', 'amex'],
      merchantCapabilities: ['supports3DS'],
      total: { label: 'Invoice Payment', amount: Number(this.invoice()?.balance ?? 0).toFixed(2).toString() },
    };

    let session: any;
    try { session = new Session(3, request); } catch { this.paying.set(false); return; }

    session.onvalidatemerchant = async (event: any) => {
      try {
        const v = await this.api.validateApplePay({ companyId: this.companyId, validationURL: event.validationURL });
        if (v?.success && v.data) session.completeMerchantValidation(v.data);
        else session.abort();
      } catch { session.abort(); }
    };
    session.onpaymentauthorized = async (event: any) => {
      try {
        const res = await this.api.payInvoice({
          companyId: this.companyId, invoiceId: this.invoiceId, paymentName: 'ApplePay', applePayTokendata: event.payment.token,
        });
        if (res?.success) {
          session.completePayment(Session.STATUS_SUCCESS);
          this.notice.set({ kind: 'success', text: this.lang.instant('EINVOICE.PAID') });
          await this.load();
        } else {
          session.completePayment(Session.STATUS_FAILURE);
        }
      } catch { session.completePayment(Session.STATUS_FAILURE); }
      this.paying.set(false);
    };
    session.oncancel = () => this.paying.set(false);
    session.begin();
  }
}
