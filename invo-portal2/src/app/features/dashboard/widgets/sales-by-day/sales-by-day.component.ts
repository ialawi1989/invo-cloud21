import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';

import { DashChartComponent } from '../../components/dash-chart/dash-chart.component';
import { WidgetFrameComponent } from '../../components/widget-frame/widget-frame.component';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardScope, LabelValue } from '../../services/dashboard.types';

type Window = '7' | '14' | '30';

/**
 * Sales by day.
 *
 * The one widget with its own window: a daily series is unreadable over a
 * year-long page scope, so it offers 7/14/30 days regardless of the page range.
 * It still follows the page's *branch* — legacy did the same, but silently,
 * which made the numbers look wrong against the page date filter. Here the
 * subtitle says so.
 */
@Component({
  selector: 'app-sales-by-day-widget',
  standalone: true,
  imports: [
    CommonModule, TranslateModule,
    WidgetFrameComponent, DashChartComponent, SegmentedToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MycurrencyPipe],
  template: `
    <app-widget-frame
      skeleton="area"
      [title]="title()"
      subtitle="DASHBOARD.OWN_WINDOW"
      [loading]="loading()"
      [error]="failed()"
      [empty]="isEmpty()"
      skeletonHeight="260px"
      (retry)="retry()">

      <app-segmented-toggle
        widgetActions
        [options]="windows"
        [value]="window()"
        (valueChange)="window.set($any($event))"/>

      <app-dash-chart
        type="bar"
        [series]="series()"
        [categories]="categories()"
        [valueFormat]="fmt"
        [height]="250"/>
    </app-widget-frame>
  `,
  styles: [`:host { display: block; height: 100%; }`],
})
export class SalesByDayWidgetComponent {
  private service = inject(DashboardService);
  private currency = inject(MycurrencyPipe);
  private destroyRef = inject(DestroyRef);

  readonly title = input.required<string>();
  readonly scope = input.required<DashboardScope>();

  readonly window = signal<Window>('7');
  readonly windows: SegmentedToggleOption<Window>[] = [
    { value: '7',  label: 'DASHBOARD.RANGE.LAST_7' },
    { value: '14', label: 'DASHBOARD.RANGE.LAST_14' },
    { value: '30', label: 'DASHBOARD.RANGE.LAST_30' },
  ];

  readonly rows = signal<LabelValue[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  private readonly nonce = signal(0);

  readonly isEmpty = computed(() => this.rows().length === 0);
  readonly categories = computed(() => this.rows().map((r) => shortDay(r.label)));
  readonly series = computed(() => [{ name: 'Sales', data: this.rows().map((r) => r.value) }]);

  fmt = (v: number) => String(this.currency.transform(v));

  constructor() {
    // Same cancellation contract as loadOnScope, but keyed on the local window
    // + the page's branch rather than the page's dates.
    toObservable(computed(() => ({
      days: Number(this.window()),
      branchId: this.scope().branchId,
      nonce: this.nonce(),
    })))
      .pipe(
        tap(() => { this.loading.set(true); this.failed.set(false); }),
        switchMap(({ days, branchId }) => {
          const end = new Date(); end.setHours(0, 0, 0, 0);
          const start = new Date(end); start.setDate(start.getDate() - (days - 1));
          return this.service.salesByDay(iso(start), iso(end), branchId).pipe(
            catchError(() => { this.failed.set(true); return of([] as LabelValue[]); }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => { this.rows.set(rows); this.loading.set(false); });
  }

  retry(): void { this.nonce.update((n) => n + 1); }
}

function iso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** '2026-07-19' → '19 Jul'; axis ticks don't need the year. */
function shortDay(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}
