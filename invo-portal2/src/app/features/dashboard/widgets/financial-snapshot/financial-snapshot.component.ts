import {
  ChangeDetectionStrategy, Component, computed, inject, input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardScope, DashboardSummary } from '../../services/dashboard.types';
import { loadOnScope } from '../../services/load-on-scope';
import { WidgetFrameComponent } from '../../components/widget-frame/widget-frame.component';

const EMPTY: DashboardSummary = {
  costOfGoodsSold: { balance: 0, trail: [] },
  payable:         { balance: 0, trail: [] },
  receivable:      { balance: 0, trail: [] },
  netProfit:       0,
};

/**
 * Financial snapshot — net profit, receivables (A/R), payables (A/P) and cost
 * of goods sold for the period. The accountant/owner headline; data comes from
 * the existing `accounts/getDashboardSummary` endpoint (already used by the
 * summary blocks), so no backend work.
 */
@Component({
  selector: 'app-financial-snapshot-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe, WidgetFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-widget-frame
      skeleton="kpi"
      [title]="title()"
      subtitle="DASHBOARD.FS_SUB"
      [loading]="res.loading()"
      [error]="res.failed()"
      skeletonHeight="130px"
      (retry)="res.retry()">

      <div class="fs">
        <div class="fs__tile fs__tile--profit" [class.fs__tile--neg]="d().netProfit < 0">
          <div class="fs__label">{{ 'DASHBOARD.FS_NET_PROFIT' | translate }}</div>
          <div class="fs__value">{{ d().netProfit | mycurrency }}</div>
        </div>
        <div class="fs__tile">
          <div class="fs__label">{{ 'DASHBOARD.FS_RECEIVABLE' | translate }}</div>
          <div class="fs__value">{{ d().receivable.balance | mycurrency }}</div>
        </div>
        <div class="fs__tile">
          <div class="fs__label">{{ 'DASHBOARD.FS_PAYABLE' | translate }}</div>
          <div class="fs__value">{{ d().payable.balance | mycurrency }}</div>
        </div>
        <div class="fs__tile">
          <div class="fs__label">{{ 'DASHBOARD.FS_COGS' | translate }}</div>
          <div class="fs__value">{{ d().costOfGoodsSold.balance | mycurrency }}</div>
        </div>
      </div>
    </app-widget-frame>
  `,
  styleUrl: './financial-snapshot.component.scss',
})
export class FinancialSnapshotWidgetComponent {
  private service = inject(DashboardService);

  readonly title = input.required<string>();
  readonly scope = input.required<DashboardScope>();

  readonly res = loadOnScope<DashboardSummary>(
    computed(() => this.scope()),
    (s) => this.service.summary(s),
    EMPTY,
  );
  readonly d = computed(() => this.res.data());
}
