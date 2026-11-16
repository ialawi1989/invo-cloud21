import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { CustomerPointsSummary, PointsService, PointsSettings } from '../../services/points.service';

/**
 * "Pay with loyalty points" block of a sales payment (legacy `PointsPaymentComponent`). The user types a
 * money amount; it is converted to whole points (rounded down) and `pointsValue()` is the exact money
 * those points are worth (what the payment is saved for). Starts at the most the customer can spend
 * without exceeding the balance. The host reads `isValid()` /
 * `pointsValue()` and, after saving the payment, calls `spend()` to burn the points against it.
 */
@Component({
  selector: 'app-points-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MycurrencyPipe],
  template: `
    @if (summary()) {
      <div class="pp">
        <div class="pp__balance">
          {{ 'PROMOTIONS.PROMOTIONS_POINTS.INVOICE_BALANCE' | translate }} ({{ balance() | mycurrency }})
        </div>

        <label class="pp__label">{{ 'PROMOTIONS.PROMOTIONS_POINTS.CURRENCY_VALUE' | translate }}</label>
        <div class="pp__points">
          <input class="pp__input" type="number" min="0" step="any" [max]="maxMoney()"
            [ngModel]="moneyAmount()" (ngModelChange)="moneyAmount.set(+$event || 0)"/>
          <span>/ {{ maxMoney() | mycurrency }}</span>
        </div>

        @if (errorKey(); as key) { <div class="pp__error">{{ key | translate }}</div> }

        <label class="pp__label">{{ 'PROMOTIONS.PROMOTIONS_POINTS.POINTS' | translate }}</label>
        <div class="pp__points">
          <input class="pp__input" type="number" disabled [ngModel]="pointAmount()"/>
          <span>/ {{ summary()!.activePoints }}</span>
        </div>

        @if (pointAmount() > 0 && pointsValue() !== moneyAmount()) {
          <small class="pp__hint">{{ pointsValue() | mycurrency }}</small>
        }
      </div>
    }
  `,
  styles: [`
    .pp { display: flex; flex-direction: column; gap: 10px; }
    .pp__balance { font-weight: 600; color: #334155; }
    .pp__label { font-size: 13px; font-weight: 600; color: #475569; }
    .pp__points { display: flex; align-items: center; gap: 8px; }
    .pp__input { flex: 1; border: 1px solid #d0d5dd; border-radius: 8px; padding: 9px 12px; font: inherit; }
    .pp__input:disabled { background: #f8fafc; }
    .pp__hint { color: #64748b; }
    .pp__error { color: #dc2626; font-size: 13px; }
  `],
})
export class PointsPaymentComponent implements OnInit {
  private points = inject(PointsService);

  /** What the document still owes. */
  balance = input<number>(0);
  phoneNumber = input<string>('');

  summary = signal<CustomerPointsSummary | null>(null);
  settings = signal<PointsSettings | null>(null);
  /** Money typed by the user. */
  moneyAmount = signal(0);
  /** Most money the active points can cover, capped by the balance. */
  maxMoney = signal(0);
  readonly paymentDate = new Date();

  private rate = computed(() => {
    const s = this.settings();
    return s && s.pointsValue ? s.currencyValue / s.pointsValue : 0;
  });

  /** Whole points needed to cover the typed money (rounded down). */
  pointAmount = computed(() => this.toPoints(this.moneyAmount()));
  /** Exact money value of `pointAmount()`; the host uses it as the paid amount. */
  pointsValue = computed(() => this.toAmount(this.pointAmount()));

  /** i18n key of the current validation problem, '' when the amount is fine. */
  errorKey = computed(() => {
    const P = 'PROMOTIONS.PROMOTIONS_POINTS.';
    if (this.pointAmount() <= 0) return P + 'POINT_AMOUNT_MUST_BE_AT_LEAST_1';
    if (this.pointAmount() > (this.summary()?.activePoints ?? 0)) return P + 'POINT_AMOUNT_MORE_THAN_POINT_BALANCE';
    if (this.pointsValue() > this.balance()) return P + 'POINT_VALUE_MORE_THAN_INVOICE_BALANCE';
    return '';
  });

  async ngOnInit(): Promise<void> {
    const [summary, settings] = await Promise.all([
      this.points.getCustomerPointsSummary(this.phoneNumber()),
      this.points.getPointsSettings(),
    ]);
    this.settings.set(settings);
    this.summary.set(summary);

    // largest whole number of points whose value does not exceed the balance
    const maxPoints = Math.min(summary.activePoints, this.toPoints(Number(this.balance())));
    const max = this.toAmount(maxPoints);
    this.maxMoney.set(max);
    this.moneyAmount.set(max);
  }

  private toPoints(amount: number): number {
    const rate = this.rate();
    if (!rate || amount <= 0) return 0;
    // epsilon guards float error, e.g. 0.3 / 0.1 = 2.9999...
    return Math.floor(amount / rate + 1e-9);
  }

  private toAmount(points: number): number {
    return Math.round(points * this.rate() * 1000) / 1000;
  }

  isValid(): boolean { return !!this.summary() && this.errorKey() === ''; }

  /** Burns the points against the saved payment line. */
  async spend(orderNumber: string, invoiceId: string, paymentLineId: string, phoneNumber: string): Promise<void> {
    await this.points.updateCustomerPointsSpend(phoneNumber, {
      actionName: 'SPEND_POINTS',
      reason: {
        en: `Points redeemed to pay invoice #${orderNumber}`,
        ar: `تم صرف النقاط لتسديد جزء من الفاتورة رقم ${orderNumber}`,
      },
      note: '',
      pointsValue: this.pointAmount(),
      spentOrderNumber: orderNumber,
      spentOrderId: invoiceId,
      paymentLineId,
      paidAmount: this.pointsValue(),
    });
  }
}
