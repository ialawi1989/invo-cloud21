import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CompanyService } from '@core/auth/company.service';

export interface DiscountValue {
  amount: number;
  percentage: boolean;
}

/**
 * Amount + "% / fixed" input used on document lines and totals (legacy `discount-field`).
 * Emits `{ amount, percentage }` on every edit; the parent applies caps/recalculation.
 */
@Component({
  selector: 'app-discount-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="df" [class.df--disabled]="disabled()">
      <input class="df__input" type="number" inputmode="decimal" min="0" [disabled]="disabled()"
        [value]="amount()" [attr.id]="elmId() || null"
        (input)="onAmount($any($event.target).value)" />
      <button type="button" class="df__toggle" [disabled]="disabled()" (click)="togglePercentage()"
        [attr.aria-label]="percentage() ? 'percentage' : 'fixed amount'">
        {{ percentage() ? '%' : symbol() }}
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .df { display: flex; align-items: stretch; border: 1px solid #d0d5dd; border-radius: 8px; background: #fff; overflow: hidden; }
    .df:focus-within { border-color: #2691a4; box-shadow: 0 0 0 3px rgba(38, 145, 164, .15); }
    .df--disabled { background: #f8fafc; opacity: .7; }
    .df__input { flex: 1; min-width: 0; border: 0; outline: 0; padding: 8px 10px; font: inherit; background: transparent; }
    .df__toggle { border: 0 !important; border-inline-start: 1px solid #e5e7eb !important; border-radius: 0 !important; background: #f8fafc !important; box-shadow: none !important; outline: none; padding: 0 12px; font-weight: 600; color: #475569; cursor: pointer; min-width: 52px; white-space: nowrap; }
    .df__toggle:hover:not(:disabled) { background: #eef2f6; }
  `],
})
export class DiscountFieldComponent {
  amount = input<number>(0);
  percentage = input<boolean>(true);
  disabled = input<boolean>(false);
  elmId = input<string>('');
  private company = inject(CompanyService);
  /** Label of the fixed-amount mode; defaults to the company's currency symbol (BHD, SAR, $ …). */
  currencyLabel = input<string>('');
  symbol = computed(() => this.currencyLabel() || this.company.settings()?.settings?.currencySymbol || '¤');

  changed = output<DiscountValue>();

  onAmount(raw: string): void {
    const n = parseFloat(raw);
    this.changed.emit({ amount: isNaN(n) || n < 0 ? 0 : n, percentage: this.percentage() });
  }

  togglePercentage(): void {
    this.changed.emit({ amount: this.amount(), percentage: !this.percentage() });
  }
}
