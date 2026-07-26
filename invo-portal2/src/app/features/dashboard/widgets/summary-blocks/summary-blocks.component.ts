import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { SparklineComponent } from '../../components/sparkline/sparkline.component';
import { WidgetFrameComponent } from '../../components/widget-frame/widget-frame.component';
import { DashboardService } from '../../services/dashboard.service';
import { loadOnScope } from '../../services/load-on-scope';
import { DashboardScope, DashboardSummary } from '../../services/dashboard.types';

const EMPTY: DashboardSummary = {
  costOfGoodsSold: { balance: 0, trail: [] },
  payable: { balance: 0, trail: [] },
  receivable: { balance: 0, trail: [] },
  netProfit: 0,
};

/**
 * Financial summary — three balances with six-month trend, plus net profit.
 *
 * The sparkline colour encodes trend direction (last vs first point), which is
 * a *status* signal, not a categorical one — so it uses the reserved good/bad
 * pair and never a series hue. The balance is always printed beside it, so the
 * colour is reinforcement rather than the sole carrier of meaning.
 */
@Component({
  selector: 'app-summary-blocks-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe, WidgetFrameComponent, SparklineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-widget-frame
      skeleton="kpi"
      [title]="title()"
      [loading]="loading()"
      [error]="failed()"
      skeletonHeight="150px"
      (retry)="retry()">

      <div class="sb__grid">
        @for (b of blocks(); track b.label) {
          <div class="sb__block" [class]="'sb__block--' + b.tone">
            <span class="sb__head">
              <span class="sb__icon" aria-hidden="true">
                @switch (b.icon) {
                  @case ('cogs') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                  }
                  @case ('payable') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  }
                  @case ('receivable') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  }
                }
              </span>
              <span class="sb__label">{{ b.label | translate }}</span>
            </span>
            <span class="sb__value">{{ b.balance | mycurrency }}</span>
            <div class="sb__spark">
              <app-sparkline [data]="b.trail" [stroke]="b.trend >= 0 ? UP : DOWN"/>
            </div>
          </div>
        }

        <div class="sb__block sb__block--net" [class.is-negative]="data().netProfit < 0">
          <span class="sb__head">
            <span class="sb__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            </span>
            <span class="sb__label">{{ 'DASHBOARD.NET_PROFIT' | translate }}</span>
          </span>
          <span class="sb__value">{{ data().netProfit | mycurrency }}</span>
          <span class="sb__note">
            {{ (data().netProfit < 0 ? 'DASHBOARD.LOSS' : 'DASHBOARD.PROFIT') | translate }}
          </span>
        </div>

        <!-- Both counters are as-of-now, so they say so rather than letting the
             reader assume they follow the date filter. -->
        <div class="sb__block sb__block--slate">
          <span class="sb__head">
            <span class="sb__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </span>
            <span class="sb__label">{{ 'DASHBOARD.OPEN_INVOICES' | translate }}</span>
          </span>
          <span class="sb__value">{{ openInvoices().toLocaleString() }}</span>
          <span class="sb__note">{{ 'DASHBOARD.NO_DATE_FILTER' | translate }}</span>
        </div>

        <div class="sb__block sb__block--teal">
          <span class="sb__head">
            <span class="sb__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M7 15h4"/></svg>
            </span>
            <span class="sb__label">{{ 'DASHBOARD.OPEN_CASHIERS' | translate }}</span>
          </span>
          <span class="sb__value">{{ openCashiers().toLocaleString() }}</span>
          <span class="sb__note">{{ 'DASHBOARD.NO_DATE_FILTER' | translate }}</span>
        </div>
      </div>
    </app-widget-frame>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    // Six blocks as 3 x 2, matching the legacy layout's two rows.
    .sb__grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    @media (max-width: 900px) { .sb__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 560px) { .sb__grid { grid-template-columns: 1fr; } }

    .sb__block {
      display: flex; flex-direction: column; gap: 2px;
      padding: 12px 14px;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
    }

    // Each block owns a colour AND an icon AND a label — the tint groups them
    // at a glance, but never carries meaning on its own.
    .sb__block--coral  { background: #fff5f3; border-color: #fcd9d1;
      .sb__icon { background: #fde3dc; color: #b4441f; } .sb__value { color: #99381a; } }
    .sb__block--violet { background: #f8f5ff; border-color: #ddd0fe;
      .sb__icon { background: #e7dcfe; color: #6d3fd4; } .sb__value { color: #5b30bd; } }
    .sb__block--green  { background: #f2fbf6; border-color: #b9ecd0;
      .sb__icon { background: #cdf2de; color: #157347; } .sb__value { color: #10603c; } }
    .sb__block--slate  { background: #f8fafc; border-color: #e2e8f0;
      .sb__icon { background: #eaeef3; color: #52627a; } }
    .sb__block--teal   { background: #f0fbfd; border-color: #b8e8f0;
      .sb__icon { background: #d3f2f8; color: #1d7d8d; } .sb__value { color: #14606e; } }
    .sb__block--net    { background: #f2fbf6; border-color: #b9ecd0;
      .sb__icon { background: #cdf2de; color: #157347; } .sb__value { color: #10603c; } }
    .sb__block--net.is-negative { background: #fef2f2; border-color: #fecaca;
      .sb__icon { background: #fee2e2; color: #b91c1c; } .sb__value { color: #b91c1c; } }

    .sb__head { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
    .sb__icon {
      flex-shrink: 0; width: 30px; height: 30px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 9px; background: #f1f5f9; color: #64748b;
    }

    .sb__label {
      font-size: 11.5px; font-weight: 600; color: #64748b;
      text-transform: uppercase; letter-spacing: .03em;
    }
    .sb__value {
      font-size: 19px; font-weight: 800; color: #0f172a;
      font-variant-numeric: tabular-nums;
    }
    .sb__note { font-size: 11.5px; color: #94a3b8; }
    .sb__spark { height: 36px; margin-top: 4px; }
  `],
})
export class SummaryBlocksWidgetComponent {
  private service = inject(DashboardService);

  readonly title = input.required<string>();
  readonly scope = input.required<DashboardScope>();

  /** Reserved status colours — never reused as categorical series hues. */
  readonly UP = '#10b981';
  readonly DOWN = '#ef4444';

  private readonly res = loadOnScope(this.scope, (s) => this.service.summary(s), EMPTY);

  readonly loading = this.res.loading;
  readonly failed = this.res.failed;
  readonly data = this.res.data;

  readonly blocks = computed(() => {
    const d = this.data();
    const mk = (label: string, b: { balance: number; trail: number[] }) => ({
      label,
      balance: b.balance,
      trail: b.trail,
      trend: trendOf(b.trail),
    });
    return [
      { ...mk('DASHBOARD.COGS', d.costOfGoodsSold), tone: 'coral', icon: 'cogs' },
      { ...mk('DASHBOARD.PAYABLE', d.payable), tone: 'violet', icon: 'payable' },
      { ...mk('DASHBOARD.RECEIVABLE', d.receivable), tone: 'green', icon: 'receivable' },
    ];
  });

  /**
   * Branch-scoped but date-independent, so these ride their own stream keyed on
   * the branch alone — re-fetching them on every date change would be waste.
   */
  private readonly branch = computed(() => this.scope().branchId);
  readonly openInvoices = toSignal(
    toObservable(this.branch).pipe(
      switchMap((b) => this.service.openInvoicesCount(b).pipe(catchError(() => of(0)))),
    ), { initialValue: 0 });
  readonly openCashiers = toSignal(
    toObservable(this.branch).pipe(
      switchMap((b) => this.service.openCashiersCount(b).pipe(catchError(() => of(0)))),
    ), { initialValue: 0 });

  retry(): void { this.res.retry(); }
}

/** Direction of travel across the trail: positive = rising. */
function trendOf(trail: number[]): number {
  if (trail.length < 2) return 0;
  return trail[trail.length - 1] - trail[0];
}
