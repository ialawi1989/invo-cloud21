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
 * Branch comparison — net sales, invoice count and share per branch for the
 * selected period, ranked. The all-branches view managers and owners ask for;
 * data comes from the existing `dashboard/BranchSales` endpoint.
 */
@Component({
  selector: 'app-branch-comparison-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe, WidgetFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-widget-frame
      skeleton="table"
      [title]="title()"
      subtitle="DASHBOARD.BC_SUB"
      [loading]="res.loading()"
      [error]="res.failed()"
      [empty]="isEmpty()"
      emptyText="DASHBOARD.BC_EMPTY"
      skeletonHeight="240px"
      (retry)="res.retry()">

      <div class="bc__wrap">
        <table class="bc__table">
          <thead>
            <tr>
              <th>{{ 'DASHBOARD.BC_BRANCH' | translate }}</th>
              <th class="bc__num">{{ 'DASHBOARD.BC_INVOICES' | translate }}</th>
              <th class="bc__num">{{ 'DASHBOARD.BC_NET_SALES' | translate }}</th>
              <th class="bc__share">{{ 'DASHBOARD.BC_SHARE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.branchId) {
              <tr>
                <td class="bc__name">{{ r.branchName }}</td>
                <td class="bc__num">{{ r.numberOfInvoices }}</td>
                <td class="bc__num bc__strong">{{ r.netSales | mycurrency }}</td>
                <td class="bc__share">
                  <span class="bc__bar"><span class="bc__barFill" [style.width.%]="r.share"></span></span>
                  <span class="bc__pct">{{ r.share | number:'1.0-0' }}%</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </app-widget-frame>
  `,
  styleUrl: './branch-comparison.component.scss',
})
export class BranchComparisonWidgetComponent {
  private service = inject(DashboardService);

  readonly title = input.required<string>();
  readonly scope = input.required<DashboardScope>();

  readonly res = loadOnScope<BranchSalesRow[]>(
    computed(() => this.scope()),
    (s) => this.service.branchSales(s, true),
    [],
  );

  /** Ranked by net sales, highest first. */
  readonly rows = computed(() =>
    [...this.res.data()].sort((a, b) => b.netSales - a.netSales));

  readonly isEmpty = computed(() => this.res.data().length === 0);
}
