import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

/**
 * A single headline number.
 *
 * This is the "not a chart" case: one value has no shape to plot, so it gets
 * typographic weight instead of a mark. Deliberately dumb — the caller formats
 * nothing, it just says whether the value is money and what tone it carries.
 */
@Component({
  selector: 'app-kpi-tile',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kpi" [class.kpi--accent]="accent()" [class.kpi--bad]="tone() === 'bad'">
      <span class="kpi__label">{{ label() | translate }}</span>
      <span class="kpi__value">
        @if (money()) { {{ value() | mycurrency }} } @else { {{ value().toLocaleString() }} }
      </span>
      @if (hint()) {
        <span class="kpi__hint">{{ hint()! | translate }}</span>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .kpi {
      height: 100%;
      display: flex; flex-direction: column; gap: 2px;
      padding: 12px 14px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;

      &--accent { background: var(--color-brand-50, #effbfd); border-color: var(--color-brand-200, #afe7ef); }
      // Reserved status tone: a negative net is a state, not a series colour.
      &--bad .kpi__value { color: #b91c1c; }
    }

    .kpi__label {
      font-size: 11.5px; font-weight: 600; color: #64748b;
      text-transform: uppercase; letter-spacing: .03em;
    }
    .kpi__value {
      font-size: 21px; font-weight: 800; color: #0f172a;
      letter-spacing: -0.01em; font-variant-numeric: tabular-nums;
    }
    .kpi__hint { font-size: 11.5px; color: #94a3b8; }
  `],
})
export class KpiTileComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly money = input<boolean>(true);
  readonly accent = input<boolean>(false);
  readonly hint = input<string | null>(null);
  readonly tone = input<'normal' | 'bad'>('normal');
}
