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
    <div class="kpi" [class]="'kpi--' + tone()" [class.kpi--accent]="accent()">
      <span class="kpi__head">
        <span class="kpi__label">{{ label() | translate: labelParams() }}</span>
        @if (icon()) {
          <span class="kpi__icon" aria-hidden="true">
            @switch (icon()) {
              @case ('orders') {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              }
              @case ('sales') {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              }
              @case ('discount') {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
              }
              @case ('tax') {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2h16v20l-4-2-4 2-4-2-4 2z"/><path d="M8 8h8"/><path d="M8 13h6"/></svg>
              }
              @case ('returns') {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              }
              @case ('net') {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              }
              @case ('card') {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
              }
            }
          </span>
        }
      </span>
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
    }

    // Tone tints the tile so a strip of KPIs is scannable by kind. Every tone
    // also carries its own icon and label, so colour is reinforcement and never
    // the only thing telling two figures apart.
    .kpi--neutral { background: #f8fafc; border-color: #e2e8f0;
      .kpi__label, .kpi__icon { color: #64748b; } .kpi__value { color: #0f172a; } }
    .kpi--brand { background: #f0fbfd; border-color: #b8e8f0;
      .kpi__label, .kpi__icon { color: #1d7d8d; } .kpi__value { color: #14606e; } }
    .kpi--amber { background: #fffbeb; border-color: #fde68a;
      .kpi__label, .kpi__icon { color: #b45309; } .kpi__value { color: #92400e; } }
    .kpi--violet { background: #f8f5ff; border-color: #ddd0fe;
      .kpi__label, .kpi__icon { color: #6d3fd4; } .kpi__value { color: #5b30bd; } }
    .kpi--rose { background: #fef4f4; border-color: #fbcfcf;
      .kpi__label, .kpi__icon { color: #b91c1c; } .kpi__value { color: #991b1b; } }
    .kpi--green { background: #f2fbf6; border-color: #b9ecd0;
      .kpi__label, .kpi__icon { color: #157347; } .kpi__value { color: #10603c; } }
    // A negative figure is a state, not a palette choice.
    .kpi--bad .kpi__value { color: #b91c1c; }

    .kpi__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .kpi__icon { flex-shrink: 0; display: inline-flex; opacity: .85; }

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
  /** Interpolation values for the label key, e.g. the "as on <date>" suffix. */
  readonly labelParams = input<Record<string, unknown> | undefined>(undefined);
  readonly value = input.required<number>();
  readonly money = input<boolean>(true);
  readonly accent = input<boolean>(false);
  readonly hint = input<string | null>(null);
  /** Colour family. Always paired with a distinct icon + label, never alone. */
  readonly tone = input<'neutral' | 'brand' | 'amber' | 'violet' | 'rose' | 'green' | 'bad'>('neutral');
  readonly icon = input<'orders' | 'sales' | 'discount' | 'tax' | 'returns' | 'net' | 'card' | null>(null);
}
