import {
  ChangeDetectionStrategy, Component, computed, inject, input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardScope, BranchSalesRow } from '../../services/dashboard.types';
import { loadOnScope } from '../../services/load-on-scope';
import { WidgetFrameComponent } from '../../components/widget-frame/widget-frame.component';

/**
 * Company-wide KPI strip (super-admin only). Consolidates the period totals
 * across ALL branches — orders, net sales, discounts and returns — from the
 * existing `dashboard/BranchSales` endpoint (summed client-side). The owner's
 * single-glance health line, above any per-branch drill-down.
 */
@Component({
  selector: 'app-company-kpis-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe, WidgetFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-widget-frame
      skeleton="kpi"
      [title]="title()"
      subtitle="DASHBOARD.CK_SUB"
      [loading]="res.loading()"
      [error]="res.failed()"
      skeletonHeight="120px"
      (retry)="res.retry()">

      <div class="ck">
        <div class="ck__tile">
          <div class="ck__label">{{ 'DASHBOARD.CK_ORDERS' | translate }}</div>
          <div class="ck__value">{{ totals().orders }}</div>
        </div>
        <div class="ck__tile ck__tile--accent">
          <div class="ck__label">{{ 'DASHBOARD.CK_NET_SALES' | translate }}</div>
          <div class="ck__value">{{ totals().netSales | mycurrency }}</div>
        </div>
        <div class="ck__tile">
          <div class="ck__label">{{ 'DASHBOARD.CK_DISCOUNTS' | translate }}</div>
          <div class="ck__value">{{ totals().discount | mycurrency }}</div>
        </div>
        <div class="ck__tile">
          <div class="ck__label">{{ 'DASHBOARD.CK_RETURNS' | translate }}</div>
          <div class="ck__value">{{ totals().returns | mycurrency }}</div>
        </div>
        <div class="ck__tile">
          <div class="ck__label">{{ 'DASHBOARD.CK_BRANCHES' | translate }}</div>
          <div class="ck__value">{{ totals().branches }}</div>
        </div>
      </div>
    </app-widget-frame>
  `,
  styleUrl: './company-kpis.component.scss',
})
export class CompanyKpisWidgetComponent {
  private service = inject(DashboardService);

  readonly title = input.required<string>();
  readonly scope = input.required<DashboardScope>();

  readonly res = loadOnScope<BranchSalesRow[]>(
    computed(() => this.scope()),
    (s) => this.service.branchSales(s, true),
    [],
  );

  readonly totals = computed(() => {
    const rows = this.res.data();
    return {
      orders:   rows.reduce((n, r) => n + r.numberOfInvoices, 0),
      netSales: rows.reduce((n, r) => n + r.netSales, 0),
      discount: rows.reduce((n, r) => n + r.discountTotal, 0),
      returns:  rows.reduce((n, r) => n + r.totalReturn, 0),
      branches: rows.length,
    };
  });
}
