import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { SearchDropdownComponent } from '@shared/components/dropdown';

import { VouchersService } from '../../services/vouchers.service';
import { Voucher, VouchersSettings, VouchersStatues } from '../../models/vouchers.model';
import { translate } from '../../models/common.model';

/**
 * "Pay with gift voucher" block of a sales payment (legacy `VouchersPaymentComponent`).
 * The customer's active vouchers are picked from a list or found by code; a one-time-use
 * voucher is spent in full (capped at the balance). The host reads `isValid()` / `voucherAmount`
 * and, after saving the payment, calls `spend()` to burn the voucher against it.
 */
@Component({
  selector: 'app-voucher-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MycurrencyPipe, SearchDropdownComponent],
  template: `
    <div class="vp">
      <div class="vp__balance">
        {{ 'PROMOTIONS.PROMOTIONS_VOUCHERS.INVOICE_BALANCE' | translate }} ({{ balance() | mycurrency }})
      </div>

      @if (!selected()) {
        <label class="vp__label">{{ 'PROMOTIONS.PROMOTIONS_VOUCHERS.CODE' | translate }}</label>
        <div class="vp__code">
          <input class="vp__input" type="text" [ngModel]="code()" (ngModelChange)="code.set($event)" (keydown.enter)="verify()"/>
          <button type="button" class="vp__btn vp__btn--primary" [disabled]="!code().trim()" (click)="verify()">
            {{ 'PROMOTIONS.PROMOTIONS_VOUCHERS.VERIFY' | translate }}
          </button>
        </div>
        @if (codeError()) { <div class="vp__error">{{ codeError() }}</div> }

        <div class="vp__or">{{ 'PROMOTIONS.PROMOTIONS_VOUCHERS.SELECT_VOUCHER_FROM_LIST_INSTEAD' | translate }}</div>

        <label class="vp__label">{{ 'PROMOTIONS.PROMOTIONS_VOUCHERS.VOUCHERS' | translate }}</label>
        <app-search-dropdown
          [items]="vouchers()" [displayWith]="voucherLabel" [compareWith]="byId" [searchable]="false"
          [value]="null" (valueChange)="pick($any($event))" [clearable]="false"
          [placeholder]="'PROMOTIONS.PROMOTIONS_VOUCHERS.SELECT_VOUCHER' | translate"/>
      } @else {
        @let v = selected()!;
        <div class="vp__card">
          <div class="vp__card-head">
            <div>
              <h5>{{ voucherName() }}</h5>
              <div class="vp__muted">{{ v.code }}</div>
            </div>
            <button type="button" class="vp__btn" (click)="clear()">{{ 'PROMOTIONS.PROMOTIONS_VOUCHERS.CLEAR' | translate }}</button>
          </div>
          <div class="vp__facts">
            <div><small>{{ 'PROMOTIONS.PROMOTIONS_VOUCHERS.BALANCE' | translate }}</small><b>{{ v.balance | mycurrency }}</b></div>
            <div><small>{{ 'PROMOTIONS.PROMOTIONS_VOUCHERS.EXPIRY_DATE' | translate }}</small><b>{{ v.expiryDate | date: 'yyyy-MM-dd' }}</b></div>
          </div>

          <label class="vp__label">{{ 'PROMOTIONS.PROMOTIONS_VOUCHERS.SPENT_AMOUNT' | translate }}</label>
          <input class="vp__input" type="number" min="0.01" [max]="v.balance" [disabled]="v.oneTimeUse"
            [ngModel]="voucherAmount()" (ngModelChange)="voucherAmount.set(+$event || 0)"/>

          @if (v.oneTimeUse) {
            <div class="vp__error">
              @if (lost() > 0) {
                {{ 'PROMOTIONS.PROMOTIONS_VOUCHERS.ONE_TIME_USE_REMAINDER_LOST' | translate: { used: (voucherAmount() | mycurrency), remaining: (lost() | mycurrency) } }}
              } @else {
                {{ 'PROMOTIONS.PROMOTIONS_VOUCHERS.ONE_TIME_USE_FULL_AMOUNT' | translate: { used: (voucherAmount() | mycurrency) } }}
              }
            </div>
          }
          @if (errorKey(); as key) { <div class="vp__error">{{ key | translate }}</div> }
        </div>
      }
    </div>
  `,
  styles: [`
    .vp { display: flex; flex-direction: column; gap: 10px; }
    .vp__balance { font-weight: 600; color: #334155; }
    .vp__label { font-size: 13px; font-weight: 600; color: #475569; }
    .vp__code { display: flex; gap: 8px; }
    .vp__input { flex: 1; border: 1px solid #d0d5dd; border-radius: 8px; padding: 9px 12px; font: inherit; }
    .vp__input:disabled { background: #f8fafc; }
    .vp__btn { padding: 8px 16px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; font-weight: 600; cursor: pointer; }
    .vp__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
    .vp__btn:disabled { opacity: .5; cursor: not-allowed; }
    .vp__or { text-align: center; color: #94a3b8; font-size: 13px; }
    .vp__error { color: #dc2626; font-size: 13px; }
    .vp__muted { color: #64748b; }
    .vp__card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; background: #fff; }
    .vp__card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .vp__card-head h5 { margin: 0 0 2px; font-size: 16px; }
    .vp__facts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .vp__facts small { display: block; color: #64748b; }
  `],
})
export class VoucherPaymentComponent implements OnInit {
  private vouchersService = inject(VouchersService);
  private lang = inject(LanguageService);

  /** What the document still owes. */
  balance = input<number>(0);
  phoneNumber = input<string>('');

  vouchers = signal<Voucher[]>([]);
  settings = signal<VouchersSettings | null>(null);
  selected = signal<Voucher | null>(null);
  voucherAmount = signal(0);
  code = signal('');
  codeError = signal('');
  readonly paymentDate = new Date();

  voucherName = computed(() => {
    const s = this.settings();
    return s ? translate(s.vouchersName, this.lang.current()) : '';
  });

  lost = computed(() => {
    const v = this.selected();
    return v?.oneTimeUse ? Math.max(v.balance - this.voucherAmount(), 0) : 0;
  });

  /** i18n key of the current validation problem, '' when the amount is fine. */
  errorKey = computed(() => {
    const v = this.selected();
    const P = 'PROMOTIONS.PROMOTIONS_VOUCHERS.';
    if (!v) return P + 'SELECT_VOUCHER';
    const a = this.voucherAmount();
    if (a <= 0) return P + 'VOUCHER_AMOUNT_MUST_BE_AT_LEAST_1';
    if (a > v.balance) return P + 'VOUCHER_AMOUNT_MORE_THAN_VOUCHER_BALANCE';
    if (a > this.balance()) return P + 'VOUCHER_VALUE_MORE_THAN_INVOICE_BALANCE';
    return '';
  });

  async ngOnInit(): Promise<void> {
    const [vouchers, settings] = await Promise.all([
      this.vouchersService.getCustomerVouchers(this.phoneNumber(), VouchersStatues.ACTIVE),
      this.vouchersService.getVouchersSettings(),
    ]);
    this.vouchers.set(vouchers ?? []);
    this.settings.set(settings);
  }

  byId = (a: Voucher, b: Voucher) => a?.id === b?.id;
  voucherLabel = (v: Voucher) => (v ? `${v.code} - ${this.voucherName()} (${v.balance})` : '');

  /** A one-time-use voucher is spent in one go: the whole balance, capped at what the document owes. */
  private oneTimeAmount(v: Voucher): number {
    return v.oneTimeUse ? Math.min(v.balance, this.balance()) : 0;
  }

  pick(v: Voucher | null): void {
    if (!v) return;
    this.code.set('');
    this.selected.set(v);
    this.voucherAmount.set(this.oneTimeAmount(v));
  }

  async verify(): Promise<void> {
    const code = this.code().trim();
    if (!code) return;
    this.codeError.set('');
    const res = await this.vouchersService.checkTheVoucher(code);
    if (!res?.success || !res.result) {
      this.selected.set(null);
      this.voucherAmount.set(0);
      this.codeError.set(res?.message || this.lang.instant('PROMOTIONS.PROMOTIONS_VOUCHERS.INVALID_VOUCHER'));
      return;
    }
    this.selected.set(res.result);
    this.voucherAmount.set(this.oneTimeAmount(res.result));
  }

  clear(): void {
    this.selected.set(null);
    this.code.set('');
    this.codeError.set('');
    this.voucherAmount.set(0);
  }

  isValid(): boolean { return this.errorKey() === ''; }

  /** Burns the voucher against the saved payment line. Returns the amount spent. */
  async spend(orderNumber: string, invoiceId: string, paymentLineId: string): Promise<number> {
    const v = this.selected();
    if (!v) return 0;
    const reason = {
      en: `Vouchers redeemed to pay invoice #${orderNumber}`,
      ar: `تم الصرف  لتسديد جزء من الفاتورة رقم ${orderNumber}`,
    };
    await this.vouchersService.spendCustomerVouchers(v.id, reason, '', this.voucherAmount(), orderNumber, invoiceId, paymentLineId);
    return this.voucherAmount();
  }
}
