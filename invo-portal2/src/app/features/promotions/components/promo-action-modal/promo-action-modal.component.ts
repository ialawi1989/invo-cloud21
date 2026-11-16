import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { ModalRef, ModalService } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { LanguageService } from '@core/i18n/language.service';

import { TranslatedString } from '../../models/common.model';
import { InvoiceInfo } from '../../services/promotions-accounting.service';
import { InvoicePickerComponent } from '../invoice-picker/invoice-picker.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { TranslatedStringInputComponent } from '../translated-string-input/translated-string-input.component';

export type PromoActionKind = 'reason' | 'extend' | 'spend' | 'refund' | 'email' | 'stamp';

export interface PromoActionData {
  kind: PromoActionKind;
  /** Which i18n namespace / validation set applies; default is gift vouchers. */
  domain?: 'vouchers' | 'points' | 'tiers' | 'coupons' | 'campaigns';
  /** stamp / unstamp: highest stamp count allowed. */
  validateStampCount?: number;
  /** points spend: the customer's active points (upper limit). */
  activePoints?: number;
  /** points refund: points that may still be refunded (upper limit). */
  validRefundPoint?: number;
  /** i18n key of the modal title. */
  title: string;
  /** extend: current expiry (also the minimum). */
  endDate?: Date | string;
  /** spend / refund: amount limits, mirroring the legacy forms. */
  amount?: number;
  activeVouchers?: number;
  validRefundVoucher?: number;
  oneTimeUse?: boolean;
  /** spend: narrow the invoice search to this customer. */
  phoneNumber?: string;
}

export interface PromoActionResult {
  reason: TranslatedString;
  note: string;
  amount?: number;
  endDate?: Date | string;
  email?: string;
  stampCount?: number;
  spentOrderNumber?: string;
  spentOrderId?: string;
}

/**
 * The small reason-and-note dialogs of the promotions module (cancel / restore /
 * activate / enable-disable, extend, spend, refund, send email) as one modal.
 * Fields, validation and messages are the legacy per-form ones; `kind` picks which apply.
 */
@Component({
  selector: 'app-promo-action-modal',
  standalone: true,
  imports: [
    FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent,
    TranslatedStringInputComponent, InvoicePickerComponent, DatePickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './promo-action-modal.component.html',
  styleUrl: './promo-action-modal.component.scss',
})
export class PromoActionModalComponent {
  data = inject<PromoActionData>(MODAL_DATA);
  private ref = inject<ModalRef<PromoActionResult | null>>(MODAL_REF);
  private modal = inject(ModalService);
  private company = inject(CompanyService);
  private translate = inject(TranslateService);
  private lang = inject(LanguageService);

  reason = signal<TranslatedString>({ en: '' });
  note = signal('');
  amount = signal<number | null>(this.data.amount ?? null);
  email = signal('');
  stampCount = signal<number | null>(1);
  endDate = signal<Date | null>(this.data.endDate ? new Date(this.data.endDate) : null);
  invoice = signal<InvoiceInfo | null>(null);

  today = (() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; })();

  get kind(): PromoActionKind { return this.data.kind; }
  get domain(): 'vouchers' | 'points' | 'tiers' | 'coupons' | 'campaigns' { return this.data.domain ?? 'vouchers'; }
  /** i18n namespace of the labels/messages for the current domain. */
  get ns(): string {
    return this.domain === 'points'
      ? 'PROMOTIONS.PROMOTIONS_POINTS.'
      : this.domain === 'campaigns'
        ? 'PROMOTIONS.CAMPAIGNS.'
      : this.domain === 'coupons'
        ? 'PROMOTIONS.COUPONS.'
      : this.domain === 'tiers'
        ? 'PROMOTIONS.CUSTOMER_TIERS.'
        : 'PROMOTIONS.PROMOTIONS_VOUCHERS.';
  }

  // ── decimals (legacy MathHelpers.afterDecimal) ───────────────────
  private afterDecimal = computed(() => this.company.settings()?.settings?.afterDecimal ?? 3);
  amountStep = computed(() =>
    this.afterDecimal() > 0 ? (1 / Math.pow(10, this.afterDecimal())).toFixed(this.afterDecimal()) : '1');

  onAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const [intPart, decPart] = input.value.split('.');
    const dec = this.afterDecimal();
    if (decPart === undefined || decPart.length <= dec) return;
    const trimmed = dec > 0 ? `${intPart}.${decPart.slice(0, dec)}` : intPart;
    input.value = trimmed;
    this.amount.set(Number(trimmed));
  }

  // ── validation (legacy, per form) ────────────────────────────────
  reasonValid = computed(() => (this.reason()[this.lang.current() || 'en'] ?? '') !== '');

  amountError = computed<string | null>(() => {
    const a = this.amount();
    if (this.domain === 'points') {
      // legacy SpendPointsComponent / RefundPointsComponent.validateAmount
      if (a === null) return 'REQUIRED';
      if (a < 1) return 'LESS_THAN_1';
      if (this.kind === 'spend' && a > (this.data.activePoints ?? 0)) return 'MORE_THAN_BALANCE';
      if (this.kind === 'refund' && a > (this.data.validRefundPoint ?? 0)) return 'MORE_THAN_REFUND';
      return null;
    }
    if (this.kind === 'spend') {
      if (a === null || a === 0) return 'REQUIRED';
      if (a < 0) return 'LESS_THAN_0';
      if (a > (this.data.activeVouchers ?? 0)) return 'MORE_THAN_BALANCE';
      return null;
    }
    if (this.kind === 'refund') {
      if (a === null) return 'REQUIRED';
      if (a < 1) return 'LESS_THAN_1';
      return null;
    }
    return null;
  });

  emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.email().trim()));

  dateValid = computed(() => {
    const d = this.endDate();
    if (!d) return false;
    return d >= this.today;
  });

  /** Legacy StampCardActionComponent.stampCardNumberValidate. */
  stampError = computed<string | null>(() => {
    const c = this.stampCount();
    if (c === null || c === undefined || c === 0) return 'STAMP_CARD_COUNT_REQUIRED';
    if (c > (this.data.validateStampCount ?? 0)) return 'STAMP_CARD_COUNT_EXCEEDS_LIMIT';
    return null;
  });

  valid = computed(() => {
    if (!this.reasonValid()) return false;
    switch (this.kind) {
      case 'spend':
      case 'refund': return this.amountError() === null;
      case 'email': return this.emailValid();
      case 'stamp': return this.stampError() === null;
      case 'extend': return this.dateValid();
      default: return true;
    }
  });

  onDate(d: any): void {
    this.endDate.set(d instanceof Date ? d : null);
  }

  onInvoice(inv?: InvoiceInfo): void {
    this.invoice.set(inv ?? null);
  }

  cancel(): void {
    this.ref.close(null);
  }

  async save(): Promise<void> {
    if (!this.valid()) return;

    // Refund above what was actually spent needs an explicit go-ahead (legacy confirm).
    if (this.domain === 'vouchers' && this.kind === 'refund' && (this.amount() ?? 0) > (this.data.validRefundVoucher ?? 0)) {
      const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        size: 'sm',
        data: {
          title: this.translate.instant('PROMOTIONS.PROMOTIONS_VOUCHERS.REFUND_VOUCHERS'),
          message: this.translate.instant('PROMOTIONS.PROMOTIONS_VOUCHERS.CONFIRM_REFUND_ABOVE_SPENT'),
        },
      }).afterClosed();
      if (!ok) return;
    }

    // Spending points against an invoice: warn about invoices that look wrong (legacy SpendPointsComponent).
    if (this.domain === 'points' && this.kind === 'spend' && this.invoice()) {
      const inv = this.invoice()!;
      const confirmKey = inv.isGavePoints
        ? 'CONFIRM_POINTS_ALREADY_GIVEN'
        : inv.status === 'Paid'
          ? 'CONFIRM_INVOICE_PAID'
          : inv.status === 'Cancel'
            ? 'CONFIRM_INVOICE_CANCEL'
            : '';
      if (confirmKey) {
        const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
          size: 'sm',
          data: { title: this.translate.instant(this.ns + confirmKey), message: '' },
        }).afterClosed();
        if (!ok) return;
      }
    }

    const result: PromoActionResult = { reason: this.reason(), note: this.note() };
    if (this.kind === 'spend' || this.kind === 'refund') result.amount = this.amount() ?? 0;
    if (this.kind === 'spend') {
      result.spentOrderId = this.invoice()?.id ?? '';
      result.spentOrderNumber = this.invoice()?.invoiceNumber ?? '';
    }
    if (this.kind === 'extend') result.endDate = this.endDate() ?? undefined;
    if (this.kind === 'email') result.email = this.email().trim();
    if (this.kind === 'stamp') result.stampCount = this.stampCount() ?? 0;
    this.ref.close(result);
  }

}
