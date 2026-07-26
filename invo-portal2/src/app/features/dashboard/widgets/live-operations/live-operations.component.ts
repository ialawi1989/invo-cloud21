import {
  ChangeDetectionStrategy, Component, computed, inject, input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { DashboardService } from '../../services/dashboard.service';
import { DashboardScope } from '../../services/dashboard.types';
import { loadOnScope } from '../../services/load-on-scope';
import { WidgetFrameComponent } from '../../components/widget-frame/widget-frame.component';

/**
 * Live operations — as-of-now counts of open orders and open cashier sessions.
 * Both ignore the date filter (`scope: 'global'`); they answer "what's live
 * right now" for cashiers, waiters and supervisors. Data from the existing
 * `dashboard/getOpenInvoices` + `dashboard/numberOfOpenCashiers` endpoints.
 */
@Component({
  selector: 'app-live-operations-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, WidgetFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-widget-frame
      skeleton="kpi"
      [title]="title()"
      subtitle="DASHBOARD.CURRENT_STOCK"
      [loading]="loading()"
      [error]="failed()"
      skeletonHeight="120px"
      (retry)="retry()">

      <div class="lo">
        <div class="lo__tile">
          <span class="lo__icon lo__icon--orders" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          </span>
          <div class="lo__body">
            <div class="lo__value">{{ openOrders.data() }}</div>
            <div class="lo__label">{{ 'DASHBOARD.LO_OPEN_ORDERS' | translate }}</div>
          </div>
        </div>

        <div class="lo__tile">
          <span class="lo__icon lo__icon--cashiers" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </span>
          <div class="lo__body">
            <div class="lo__value">{{ openCashiers.data() }}</div>
            <div class="lo__label">{{ 'DASHBOARD.LO_OPEN_CASHIERS' | translate }}</div>
          </div>
        </div>
      </div>
    </app-widget-frame>
  `,
  styleUrl: './live-operations.component.scss',
})
export class LiveOperationsWidgetComponent {
  private service = inject(DashboardService);

  readonly title = input.required<string>();
  readonly scope = input.required<DashboardScope>();

  readonly openOrders = loadOnScope<number>(
    computed(() => this.scope()),
    (s) => this.service.openInvoicesCount(s.branchId),
    0,
  );
  readonly openCashiers = loadOnScope<number>(
    computed(() => this.scope()),
    (s) => this.service.openCashiersCount(s.branchId),
    0,
  );

  readonly loading = computed(() => this.openOrders.loading() || this.openCashiers.loading());
  readonly failed  = computed(() => this.openOrders.failed() && this.openCashiers.failed());
  retry(): void { this.openOrders.retry(); this.openCashiers.retry(); }
}
