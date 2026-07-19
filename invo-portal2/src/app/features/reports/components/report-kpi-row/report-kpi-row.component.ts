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
    <div class="kpi-row">
      @for (kpi of kpis(); track kpi.label) {
        <div class="kpi-tile">
          <span class="kpi-label">{{ kpi.label | translate }}</span>
          <span class="kpi-value">
            @switch (kpi.type) {
              @case ('currency') { {{ kpi.value | mycurrency }} }
              @case ('percent') { {{ kpi.value | number: '1.0-1' }}% }
              @default { {{ kpi.value | number: '1.0-0' }} }
            }
          </span>
          @if (kpi.delta !== undefined && kpi.delta !== null) {
            <span class="kpi-delta" [class.up]="kpi.delta >= 0" [class.down]="kpi.delta < 0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                @if (kpi.delta >= 0) { <polyline points="18 15 12 9 6 15"/> }
                @else { <polyline points="6 9 12 15 18 9"/> }
              </svg>
              {{ abs(kpi.delta) | number: '1.0-1' }}%
            </span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .kpi-tile {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 16px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      position: relative;
    }
    .kpi-label {
      font-size: 12px;
      font-weight: 500;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .kpi-value {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.1;
    }
    .kpi-delta {
      position: absolute;
      top: 14px;
      inset-inline-end: 14px;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 20px;
      svg { width: 13px; height: 13px; }
      &.up   { color: #059669; background: rgba(5, 150, 105, .1); }
      &.down { color: #dc2626; background: rgba(220, 38, 38, .1); }
    }
  `],
})
export class ReportKpiRowComponent {
  kpis = input<ReportKpi[]>([]);
  abs(n: number): number { return Math.abs(n); }
}
