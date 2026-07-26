import {
  ChangeDetectionStrategy, Component, computed, inject, input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { DashboardService } from '../../services/dashboard.service';
import { DashboardScope, StatusCount } from '../../services/dashboard.types';
import { loadOnScope } from '../../services/load-on-scope';
import { WidgetFrameComponent } from '../../components/widget-frame/widget-frame.component';

/**
 * Generic status → count breakdown, shared by Purchase-Order Status and the
 * Delivery board (both are `{status,count}[]` from their own endpoints). `kind`
 * selects the source; the scope computed folds `kind` in so switching source
 * refetches (the `{...scope, _k}` trick used elsewhere in this dashboard).
 */
@Component({
  selector: 'app-status-breakdown-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, WidgetFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-widget-frame
      skeleton="table"
      [title]="title()"
      [subtitle]="kind() === 'po' ? 'DASHBOARD.SB_PO_SUB' : 'DASHBOARD.SB_DELIVERY_SUB'"
      [loading]="res.loading()"
      [error]="res.failed()"
      [empty]="isEmpty()"
      emptyText="DASHBOARD.SB_EMPTY"
      skeletonHeight="200px"
      (retry)="res.retry()">

      <ul class="sb__list">
        @for (r of rows(); track r.status) {
          <li class="sb__row">
            <span class="sb__status">{{ r.status }}</span>
            <span class="sb__bar"><span class="sb__barFill" [style.width.%]="pct(r.count)"></span></span>
            <span class="sb__count">{{ r.count }}</span>
          </li>
        }
      </ul>
    </app-widget-frame>
  `,
  styleUrl: './status-breakdown.component.scss',
})
export class StatusBreakdownWidgetComponent {
  private service = inject(DashboardService);

  readonly title = input.required<string>();
  readonly scope = input.required<DashboardScope>();
  readonly kind  = input<'po' | 'delivery'>('po');

  readonly res = loadOnScope<StatusCount[]>(
    computed(() => ({ ...this.scope(), _k: this.kind() }) as DashboardScope),
    (s) => (this.kind() === 'po'
      ? this.service.purchaseOrderStatus(s.branchId)
      : this.service.deliveryStatus(s.branchId)),
    [],
  );

  readonly rows = computed(() => this.res.data());
  readonly isEmpty = computed(() => this.res.data().length === 0);
  private readonly max = computed(() => Math.max(1, ...this.res.data().map((r) => r.count)));
  pct(count: number): number { return (count / this.max()) * 100; }
}
