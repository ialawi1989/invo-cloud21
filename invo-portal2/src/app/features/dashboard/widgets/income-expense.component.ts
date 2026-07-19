import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { DashChartComponent } from '../components/dash-chart/dash-chart.component';
import { KpiTileComponent } from '../components/kpi-tile/kpi-tile.component';
import { WidgetFrameComponent } from '../components/widget-frame/widget-frame.component';
import { DashboardService } from '../services/dashboard.service';
import { loadOnScope } from '../services/load-on-scope';
import { DashboardScope, IncomeExpense } from '../services/dashboard.types';

const EMPTY: IncomeExpense = { totalIncome: 0, totalExpense: 0, net: 0, points: [] };

/**
 * Income vs expense — two comparable series over the same months.
 *
 * Both measures are money on the same scale, so they share one axis. (Two
 * y-scales would be the single worst thing this chart could do: it lets you
 * position any two series to imply whatever relationship you like.)
 */
@Component({
  selector: 'app-income-expense-widget',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, MycurrencyPipe,
    WidgetFrameComponent, KpiTileComponent, DashChartComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MycurrencyPipe],
  template: `
    <app-widget-frame
      skeleton="bar"
      [title]="title()"
      [loading]="loading()"
      [error]="failed()"
      [empty]="isEmpty()"
      skeletonHeight="280px"
      (retry)="retry()">

      <div class="ie__kpis">
        <app-kpi-tile label="DASHBOARD.TOTAL_INCOME"  [value]="data().totalIncome"/>
        <app-kpi-tile label="DASHBOARD.TOTAL_EXPENSE" [value]="data().totalExpense"/>
        <app-kpi-tile
          label="DASHBOARD.NET"
          [value]="data().net"
          [accent]="data().net >= 0"
          [tone]="data().net < 0 ? 'bad' : 'green'"
          icon="net"/>
      </div>

      <app-dash-chart
        type="area"
        [series]="series()"
        [categories]="categories()"
        [valueFormat]="fmt"
        [height]="230"/>
    </app-widget-frame>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .ie__kpis {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px; margin-bottom: 12px;
    }
  `],
})
export class IncomeExpenseWidgetComponent {
  private service = inject(DashboardService);
  private currency = inject(MycurrencyPipe);

  readonly title = input.required<string>();
  readonly scope = input.required<DashboardScope>();

  private readonly res = loadOnScope(this.scope, (s) => this.service.incomeExpense(s), EMPTY);

  readonly loading = this.res.loading;
  readonly failed = this.res.failed;
  readonly data = this.res.data;
  readonly isEmpty = computed(() => this.data().points.length === 0);

  readonly categories = computed(() => this.data().points.map((p) => p.label));
  readonly series = computed(() => [
    { name: 'Income',  data: this.data().points.map((p) => p.income) },
    { name: 'Expense', data: this.data().points.map((p) => p.expense) },
  ]);

  fmt = (v: number) => String(this.currency.transform(v));

  retry(): void { this.res.retry(); }
}
