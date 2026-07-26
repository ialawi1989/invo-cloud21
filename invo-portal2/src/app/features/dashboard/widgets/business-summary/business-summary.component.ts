import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { KpiTileComponent } from '../../components/kpi-tile/kpi-tile.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { WidgetFrameComponent } from '../../components/widget-frame/widget-frame.component';
import { DashboardService } from '../../services/dashboard.service';
import { loadOnScope } from '../../services/load-on-scope';
import { BranchSalesRow, DashboardScope } from '../../services/dashboard.types';

type SortKey = keyof Pick<BranchSalesRow,
  'branchName' | 'numberOfInvoices' | 'sales' | 'discountTotal' | 'taxTotal' | 'total' | 'totalReturn' | 'netSales' | 'share'>;

/**
 * Business summary — headline KPIs plus a per-branch breakdown.
 *
 * The share column is a bar, not the legacy 36×36 radial gauge: a bar is
 * comparable down the column at a glance, which is the actual question ("which
 * branch is pulling weight"), and it costs one div instead of a chart instance
 * per row.
 */
@Component({
  selector: 'app-business-summary-widget',
  standalone: true,
  imports: [CommonModule, RouterLink, TooltipDirective, TranslateModule, MycurrencyPipe, WidgetFrameComponent, KpiTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './business-summary.component.html',
  styleUrl: './business-summary.component.scss',
})
export class BusinessSummaryWidgetComponent {
  private service = inject(DashboardService);

  readonly title = input.required<string>();
  readonly scope = input.required<DashboardScope>();

  /**
   * Whether to bucket by the branch's configured opening hour rather than
   * midnight — matters for venues trading past 00:00. Persisted because it's a
   * property of how the business reads its own numbers, not a per-visit choice.
   */
  readonly byOpeningHour = signal<boolean>(localStorage.getItem(OPENING_HOUR_KEY) === '1');

  private readonly res = loadOnScope(
    computed(() => ({ ...this.scope(), _oh: this.byOpeningHour() }) as DashboardScope),
    (s) => this.service.branchSales(s, this.byOpeningHour()),
    [] as BranchSalesRow[],
  );

  readonly loading = this.res.loading;
  readonly failed = this.res.failed;
  readonly rows = this.res.data;
  readonly isEmpty = computed(() => this.rows().length === 0);

  readonly sortKey = signal<SortKey | null>(null);
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  readonly sorted = computed<BranchSalesRow[]>(() => {
    const key = this.sortKey();
    const rows = [...this.rows()];
    if (!key) return rows;
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      const x = a[key];
      const y = b[key];
      if (typeof x === 'string' || typeof y === 'string') {
        return String(x).localeCompare(String(y)) * dir;
      }
      return ((x as number) - (y as number)) * dir;
    });
  });

  /** Column totals — the row users actually look for first. */
  readonly totals = computed(() => {
    const rows = this.rows();
    const sum = (pick: (r: BranchSalesRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
    return {
      numberOfInvoices: sum((r) => r.numberOfInvoices),
      sales: sum((r) => r.sales),
      discountTotal: sum((r) => r.discountTotal),
      taxTotal: sum((r) => r.taxTotal),
      total: sum((r) => r.total),
      totalReturn: sum((r) => r.totalReturn),
      netSales: sum((r) => r.netSales),
    };
  });

  toggleOpeningHour(): void {
    this.byOpeningHour.update((v) => {
      localStorage.setItem(OPENING_HOUR_KEY, v ? '0' : '1');
      return !v;
    });
  }

  /** asc → desc → unsorted, so a user can always get back to server order. */
  sort(key: SortKey): void {
    if (this.sortKey() !== key) { this.sortKey.set(key); this.sortDir.set('desc'); return; }
    if (this.sortDir() === 'desc') { this.sortDir.set('asc'); return; }
    this.sortKey.set(null);
  }

  /**
   * Query params the reports shell understands, so a branch row opens the same
   * period the dashboard is showing rather than the report's own default.
   */
  reportParams(branchId: string): Record<string, string> {
    const s = this.scope();
    return { preset: 'custom', fromDate: s.from, toDate: s.to, branches: branchId };
  }

  /** Legacy showed this under the sales figure; it answers "per order?". */
  avgSales(row: BranchSalesRow): number {
    return row.numberOfInvoices > 0 ? row.sales / row.numberOfInvoices : 0;
  }

  retry(): void { this.res.retry(); }
}

const OPENING_HOUR_KEY = 'dashboard:businessSummary:openingHour';
