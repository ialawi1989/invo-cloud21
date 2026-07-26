import {
  ChangeDetectionStrategy, Component, computed, inject, input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardScope, RefundsVoids } from '../../services/dashboard.types';
import { loadOnScope } from '../../services/load-on-scope';
import { WidgetFrameComponent } from '../../components/widget-frame/widget-frame.component';

const EMPTY: RefundsVoids = { refundCount: 0, refundTotal: 0, voidCount: 0, voidTotal: 0 };

/**
 * Refunds & voids for the period — count and value of credit-note refunds and
 * voided invoices. A loss/leakage watch for managers; from `dashboard/refundsVoids`.
 */
@Component({
  selector: 'app-refunds-voids-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe, WidgetFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-widget-frame
      skeleton="kpi"
      [title]="title()"
      subtitle="DASHBOARD.RV_SUB"
      [loading]="res.loading()"
      [error]="res.failed()"
      skeletonHeight="130px"
      (retry)="res.retry()">

      <div class="rv">
        <div class="rv__tile rv__tile--refund">
          <div class="rv__value">{{ d().refundTotal | mycurrency }}</div>
          <div class="rv__label">{{ 'DASHBOARD.RV_REFUNDS' | translate }}</div>
          <div class="rv__count">{{ d().refundCount }} {{ 'DASHBOARD.RV_COUNT' | translate }}</div>
        </div>
        <div class="rv__tile rv__tile--void">
          <div class="rv__value">{{ d().voidTotal | mycurrency }}</div>
          <div class="rv__label">{{ 'DASHBOARD.RV_VOIDS' | translate }}</div>
          <div class="rv__count">{{ d().voidCount }} {{ 'DASHBOARD.RV_COUNT' | translate }}</div>
        </div>
      </div>
    </app-widget-frame>
  `,
  styleUrl: './refunds-voids.component.scss',
})
export class RefundsVoidsWidgetComponent {
  private service = inject(DashboardService);

  readonly title = input.required<string>();
  readonly scope = input.required<DashboardScope>();

  readonly res = loadOnScope<RefundsVoids>(
    computed(() => this.scope()),
    (s) => this.service.refundsVoids(s),
    EMPTY,
  );
  readonly d = computed(() => this.res.data());
}
