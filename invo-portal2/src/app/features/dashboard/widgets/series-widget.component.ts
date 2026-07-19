import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, of, switchMap, tap } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { DashChartComponent, DashChartType } from '../components/dash-chart/dash-chart.component';
import { WidgetFrameComponent } from '../components/widget-frame/widget-frame.component';
import { DashboardScope, LabelValue } from '../services/dashboard.types';

export type SeriesLoader = (scope: DashboardScope) => Observable<LabelValue[]>;

/**
 * One component behind every ranked/charted widget.
 *
 * Eleven of the legacy widgets — top items, top customers, sales by
 * category/department/brand/service/source/employee, payment methods, online
 * invoices, sales by time — were separate components differing only in an
 * endpoint, a chart type and a couple of field names. Legacy carried eleven
 * copies of the same fetch/map/chart/empty-state logic, which is why they had
 * drifted (some sorted, some didn't; two rendered a table with the chart config
 * left dead in the file; one leaked a raw SQL column name into the UI).
 *
 * Here the differences are inputs. A widget is a slug, a loader, a chart type.
 *
 * Every chart also gets a table view, which is what discharges the palette's
 * contrast obligation: three of the seven hues sit below 3:1 against the card,
 * so identity can never rest on colour alone.
 */
@Component({
  selector: 'app-series-widget',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    MycurrencyPipe,
    DashChartComponent,
    WidgetFrameComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // A pipe listed in `imports` is only usable in the template; injecting it
  // additionally needs it provided. Without this the component throws NG0201
  // at construction and takes the whole page down with it.
  providers: [MycurrencyPipe],
  templateUrl: './series-widget.component.html',
  styleUrl: './series-widget.component.scss',
})
export class SeriesWidgetComponent {
  private currency = inject(MycurrencyPipe);

  readonly title = input.required<string>();
  readonly scope = input.required<DashboardScope>();
  readonly load = input.required<SeriesLoader>();
  readonly chart = input<DashChartType>('bar');
  /** Values are money unless told otherwise (invoice counts, quantities). */
  readonly money = input<boolean>(true);
  /** Cap the plotted series; the rest fold into "Other" rather than inventing hues. */
  readonly maxSlices = input<number>(8);

  readonly rows = signal<LabelValue[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  /** Table is the alternate view of the same data, not a different dataset. */
  readonly showTable = signal(false);

  readonly isEmpty = computed(() => this.rows().length === 0);

  /**
   * Pie and donut can't carry an unbounded number of slices without cycling
   * hues, so anything past the cap becomes a single "Other" slice.
   */
  readonly plotted = computed<LabelValue[]>(() => {
    const rows = [...this.rows()].sort((a, b) => b.value - a.value);
    const isPie = this.chart() === 'pie' || this.chart() === 'donut';
    if (!isPie || rows.length <= this.maxSlices()) return rows;

    const head = rows.slice(0, this.maxSlices() - 1);
    const tail = rows.slice(this.maxSlices() - 1);
    const otherValue = tail.reduce((s, r) => s + r.value, 0);
    const total = rows.reduce((s, r) => s + r.value, 0);
    return [
      ...head,
      { label: 'DASHBOARD.OTHER', value: otherValue, share: total ? (otherValue / total) * 100 : 0 },
    ];
  });

  readonly categories = computed(() => this.plotted().map((r) => r.label));
  readonly series = computed(() => [{ name: this.title(), data: this.plotted().map((r) => r.value) }]);

  readonly fmt = computed(() => (v: number) =>
    this.money() ? String(this.currency.transform(v)) : v.toLocaleString());

  private destroyRef = inject(DestroyRef);
  /** Bumped to force a refetch on retry without changing the scope. */
  private readonly reload = signal(0);

  constructor() {
    // The whole fetch lifecycle in one stream:
    //   switchMap          - a scope change cancels the in-flight request
    //                        instead of racing it (legacy raced, so a slow
    //                        earlier response could overwrite a newer one)
    //   takeUntilDestroyed - navigating away unsubscribes, and HttpClient
    //                        aborts the XHR; nothing resolves into a dead view
    //   catchError -> of() - keeps the stream alive so a failed load doesn't
    //                        kill the widget for the rest of the session
    toObservable(computed(() => ({ scope: this.scope(), nonce: this.reload() })))
      .pipe(
        tap(() => { this.loading.set(true); this.failed.set(false); }),
        switchMap(({ scope }) =>
          this.load()(scope).pipe(
            catchError(() => { this.failed.set(true); return of([] as LabelValue[]); }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      });
  }

  retry(): void { this.reload.update((n) => n + 1); }

  toggleTable(): void { this.showTable.update((v) => !v); }
}
