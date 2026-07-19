import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';

import { DashChartComponent } from '../components/dash-chart/dash-chart.component';
import { KpiTileComponent } from '../components/kpi-tile/kpi-tile.component';
import { WidgetFrameComponent } from '../components/widget-frame/widget-frame.component';
import { DashboardService } from '../services/dashboard.service';
import { loadOnScope } from '../services/load-on-scope';
import { DashboardScope, PaymentsFlow } from '../services/dashboard.types';

const EMPTY: PaymentsFlow = {
  openingBalance: 0, incoming: 0, outgoing: 0, closingBalance: 0, points: [],
};

type Channel = 'all' | 'cash' | 'bank';

/**
 * Payments flow — opening/closing balances with monthly cash and bank movement.
 *
 * The cash/bank filter uses the shared segmented toggle rather than the legacy
 * hand-rolled pill strip, so it behaves like every other filter in the app.
 */
@Component({
  selector: 'app-payments-flow-widget',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, MycurrencyPipe,
    WidgetFrameComponent, KpiTileComponent, DashChartComponent, SegmentedToggleComponent,
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
      skeletonHeight="300px"
      (retry)="retry()">

      <app-segmented-toggle
        widgetActions
        [options]="channels"
        [value]="channel()"
        (valueChange)="channel.set($any($event))"/>

      <div class="pf__kpis">
        <app-kpi-tile label="DASHBOARD.OPENING"  [value]="data().openingBalance"/>
        <app-kpi-tile label="DASHBOARD.INCOMING" [value]="data().incoming"/>
        <app-kpi-tile label="DASHBOARD.OUTGOING" [value]="data().outgoing"/>
        <app-kpi-tile label="DASHBOARD.CLOSING"  [value]="data().closingBalance" [accent]="true"/>
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
    .pf__kpis {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px; margin-bottom: 12px;
    }
  `],
})
export class PaymentsFlowWidgetComponent {
  private service = inject(DashboardService);
  private currency = inject(MycurrencyPipe);

  readonly title = input.required<string>();
  readonly scope = input.required<DashboardScope>();

  readonly channel = signal<Channel>('all');
  readonly channels: SegmentedToggleOption<Channel>[] = [
    { value: 'all',  label: 'DASHBOARD.CHANNEL_ALL' },
    { value: 'cash', label: 'DASHBOARD.CHANNEL_CASH' },
    { value: 'bank', label: 'DASHBOARD.CHANNEL_BANK' },
  ];

  private readonly res = loadOnScope(this.scope, (s) => this.service.paymentsFlow(s), EMPTY);

  readonly loading = this.res.loading;
  readonly failed = this.res.failed;
  readonly data = this.res.data;
  readonly isEmpty = computed(() => this.data().points.length === 0);

  readonly categories = computed(() => this.data().points.map((p) => p.label));

  /** The channel filter is a client-side view of data already fetched. */
  readonly series = computed(() => {
    const pts = this.data().points;
    const cash = { name: 'Cash', data: pts.map((p) => p.cash) };
    const bank = { name: 'Bank', data: pts.map((p) => p.bank) };
    switch (this.channel()) {
      case 'cash': return [cash];
      case 'bank': return [bank];
      default:     return [cash, bank];
    }
  });

  fmt = (v: number) => String(this.currency.transform(v));

  retry(): void { this.res.retry(); }
}
