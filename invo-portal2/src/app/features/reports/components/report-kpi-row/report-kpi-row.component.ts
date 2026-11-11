import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ReportKpi } from '../../models/report.model';

/**
 * Stat-tile row shown above a report's table — an enhancement over the legacy
 * system, which rendered only raw tables. Values are pre-computed by the
 * service (summed across rows or read from `totals`).
 */
@Component({
  selector: 'app-report-kpi-row',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe],
  template: `
    <div class="kpi-row" [class.kpi-row--cols]="!!columns()" [style.--kpi-cols]="columns()">
      @for (kpi of kpis(); track kpi.label) {
        <div class="kpi-tile" [attr.data-tone]="kpi.tone ?? null">
          <div class="kpi-head">
            <span class="kpi-label">{{ kpi.label | translate }}</span>
            <span class="kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                @if (kpi.value < 0) { <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/> }
                @else { <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/> }
              </svg>
            </span>
          </div>
          <span class="kpi-value" [class.neg]="kpi.value < 0">
            @switch (kpi.type) {
              @case ('currency') { {{ kpi.value | mycurrency }} }
              @case ('percent') { {{ kpi.value | number: '1.0-1' }}% }
              @default { {{ kpi.value | number: '1.0-0' }} }
            }
            @if (kpi.suffix) { <small class="kpi-suffix">{{ kpi.suffix }}</small> }
          </span>
          @if (kpi.delta === null) {
            <span class="kpi-delta none">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="6" y1="12" x2="18" y2="12"/></svg>
              {{ 'REPORTS.KPI.NO_PREVIOUS' | translate }}
            </span>
          } @else if (kpi.delta !== undefined) {
            <span class="kpi-delta" [class.up]="kpi.delta >= 0" [class.down]="kpi.delta < 0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                @if (kpi.delta >= 0) { <polyline points="18 15 12 9 6 15"/> }
                @else { <polyline points="6 9 12 15 18 9"/> }
              </svg>
              {{ kpi.delta >= 0 ? '+' : '−' }}{{ abs(kpi.delta) | number: '1.0-1' }}%
              <span class="kpi-delta-note">{{ 'REPORTS.KPI.VS_PREVIOUS' | translate }}</span>
            </span>
          }
        </div>
      }
    </div>
  `,
  // A custom element is `display: inline` by default; the tile row is a block.
  host: { style: 'display: block' },
  styles: [`
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .kpi-row.kpi-row--cols { grid-template-columns: repeat(var(--kpi-cols), minmax(0, 1fr)); }
    @media (max-width: 900px) { .kpi-row.kpi-row--cols { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 480px) { .kpi-row.kpi-row--cols { grid-template-columns: minmax(0, 1fr); } }
    .kpi-tile {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 16px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      position: relative;
      box-shadow: 0 1px 3px rgba(15, 23, 42, .06), 0 4px 12px rgba(15, 23, 42, .04);
      transition: transform .15s, box-shadow .15s;
    }
    .kpi-tile:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(15, 23, 42, .10); }
    @media (prefers-reduced-motion: reduce) { .kpi-tile { transition: none; } .kpi-tile:hover { transform: none; } }
    .kpi-tile[data-tone="income"]    { --kpi-accent: #059669; --kpi-soft: #ecfdf5; }
    .kpi-tile[data-tone="expense"]   { --kpi-accent: #dc2626; --kpi-soft: #fef2f2; }
    .kpi-tile[data-tone="profit"]    { --kpi-accent: #0891b2; --kpi-soft: #ecfeff; }
    .kpi-tile[data-tone="asset"]     { --kpi-accent: #2563eb; --kpi-soft: #eff6ff; }
    .kpi-tile[data-tone="liability"] { --kpi-accent: #d97706; --kpi-soft: #fffbeb; }
    .kpi-tile[data-tone="equity"]    { --kpi-accent: #7c3aed; --kpi-soft: #f5f3ff; }
    .kpi-tile[data-tone] .kpi-value:not(.neg) { color: var(--kpi-accent); }
    .kpi-value.neg { color: #b91c1c; }
    .kpi-suffix { margin-inline-start: 4px; font-size: 14px; font-weight: 500; color: #6b7280; }
    .kpi-label::before {
      content: "";
      display: inline-block;
      width: 8px; height: 8px;
      margin-inline-end: 7px;
      border-radius: 50%;
      background: var(--kpi-accent, #32acc1);
      vertical-align: 1px;
    }
    .kpi-label {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .kpi-value {
      font-size: 24px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #0f172a;
      line-height: 1.1;
    }
    /* Label on the left, trend icon on the right — one row, so a long amount below never runs under the icon. */
    .kpi-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .kpi-icon {
      flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 9px;
      color: var(--kpi-accent, #0891b2);
      background: color-mix(in srgb, var(--kpi-accent, #0891b2) 14%, #fff);
      svg { width: 17px; height: 17px; }
    }
    .kpi-delta {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
      font-size: 12.5px;
      font-weight: 700;
      padding: 3px 10px 3px 8px;
      border-radius: 20px;
      svg { width: 13px; height: 13px; }
      .kpi-delta-note { font-weight: 500; color: #64748b; }
      &.up   { color: #059669; background: rgba(5, 150, 105, .12); }
      &.down { color: #dc2626; background: rgba(220, 38, 38, .12); }
      &.none { color: #64748b; font-weight: 500; background: rgba(100, 116, 139, .12); }
    }
  `],
})
export class ReportKpiRowComponent {
  kpis = input<ReportKpi[]>([]);
  /** A fixed number of tiles per row on wide screens (2 on tablets, 1 on phones); default: as many as fit. */
  columns = input<number | null>(null);
  abs(n: number): number { return Math.abs(n); }
}
