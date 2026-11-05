import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { CustomerPointsSummary, PointsService, PointsSettings } from '../../services/points.service';

/**
 * "Pay with loyalty points" block of a sales payment (legacy `PointsPaymentComponent`). Starts at the
 * most points the customer can spend without exceeding the balance. The host reads `isValid()` /
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

        <label class="pp__label">{{ 'PROMOTIONS.PROMOTIONS_POINTS.POINTS' | translate }}</label>
        <div class="pp__points">
          <input class="pp__input" type="number" min="1" [max]="maxPoints()"
            [ngModel]="pointAmount()" (ngModelChange)="pointAmount.set(+$event || 0)"/>
          <span>/ {{ summary()!.activePoints }}</span>
        </div>

        @if (errorKey(); as key) { <div class="pp__error">{{ key | translate }}</div> }

        <label class="pp__label">{{ 'PROMOTIONS.PROMOTIONS_POINTS.CURRENCY_VALUE' | translate }}</label>
        <input class="pp__input" type="number" disabled [ngModel]="pointsValue()"/>
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
  pointAmount = signal(0);
  maxPoints = signal(0);
  readonly paymentDate = new Date();

  private rate = computed(() => {
    const s = this.settings();
    return s && s.pointsValue ? s.currencyValue / s.pointsValue : 0;
  });

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

    let points = summary.activePoints + 1;
    do { points--; } while (points > 0 && this.toAmount(points) > this.balance());
    this.pointAmount.set(points);
    this.maxPoints.set(points);
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
    });
  }
}
