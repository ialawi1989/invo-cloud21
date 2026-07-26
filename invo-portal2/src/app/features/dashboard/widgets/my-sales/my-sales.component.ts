import {
  ChangeDetectionStrategy, Component, computed, inject, input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { AuthService } from '@core/auth/auth.service';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardScope, LabelValue } from '../../services/dashboard.types';
import { loadOnScope } from '../../services/load-on-scope';
import { WidgetFrameComponent } from '../../components/widget-frame/widget-frame.component';

/**
 * My sales — the signed-in employee's own sales this period, plus their rank
 * among the team. Reuses the existing `getSalesByEmployee` endpoint and picks
 * the current employee's row (matched by name); no backend work.
 */
@Component({
  selector: 'app-my-sales-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe, WidgetFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-widget-frame
      skeleton="kpi"
      [title]="title()"
      subtitle="DASHBOARD.MS_SUB"
      [loading]="res.loading()"
      [error]="res.failed()"
      [empty]="isEmpty()"
      emptyText="DASHBOARD.MS_EMPTY"
      skeletonHeight="140px"
      (retry)="res.retry()">

      <div class="ms">
        <div class="ms__main">
          <div class="ms__value">{{ mine()?.value ?? 0 | mycurrency }}</div>
          <div class="ms__label">{{ 'DASHBOARD.MS_MY_SALES' | translate }}</div>
        </div>
        <div class="ms__side">
          <div class="ms__chip"><b>{{ mine()?.secondary ?? 0 }}</b><span>{{ 'DASHBOARD.MS_ITEMS' | translate }}</span></div>
          @if (rank()) {
            <div class="ms__chip"><b>#{{ rank() }}</b><span>{{ 'DASHBOARD.MS_RANK' | translate:{ total: total() } }}</span></div>
          }
        </div>
      </div>
    </app-widget-frame>
  `,
  styleUrl: './my-sales.component.scss',
})
export class MySalesWidgetComponent {
  private service = inject(DashboardService);
  private auth = inject(AuthService);

  readonly title = input.required<string>();
  readonly scope = input.required<DashboardScope>();

  readonly res = loadOnScope<LabelValue[]>(
    computed(() => this.scope()),
    (s) => this.service.salesByEmployee(s),
    [],
  );

  /** Rows sorted by sales desc — for rank. */
  private ranked = computed(() => [...this.res.data()].sort((a, b) => b.value - a.value));
  private myName = computed(() => String((this.auth.currentEmployee as any)?.name ?? '').trim().toLowerCase());

  readonly mine = computed(() =>
    this.ranked().find((r) => String(r.label).trim().toLowerCase() === this.myName()) ?? null);
  readonly rank = computed(() => {
    const i = this.ranked().findIndex((r) => String(r.label).trim().toLowerCase() === this.myName());
    return i >= 0 ? i + 1 : 0;
  });
  readonly total = computed(() => this.ranked().length);
  readonly isEmpty = computed(() => !this.res.loading() && this.mine() === null);
}
