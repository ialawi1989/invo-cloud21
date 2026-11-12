import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { MynumberPipe } from '@core/pipes/mynumber.pipe';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { BoTableShellComponent, periodSlot } from '../business-overview/components/bo-table-shell/bo-table-shell.component';
import { BoAmountPipe } from '../business-overview/shared/pipes/bo-amount.pipe';
import { BoColumnPipe } from '../business-overview/shared/pipes/bo-column.pipe';
import { ReportChartComponent } from '../components/report-chart/report-chart.component';
import { ReportColumnsButtonComponent } from '../columns/report-columns-button.component';
import { columnLabel, getDefaultColumnKeys } from '../columns/report-columns';
import { ReportApiFilter, ReportChartConfig } from '../models/report.model';
import { resolvePreset } from '../utils/report-period.util';
import { COMPARISON_REPORTS } from './comparison-reports';
import { ComparisonRecord, ComparisonReportData, ComparisonReportService } from './comparison-report.service';
import { ReportErrorComponent } from '../components/report-error/report-error.component';
import { ReportEmptyComponent } from '../components/report-empty/report-empty.component';
import { ReportSkeletonComponent } from '../components/report-skeleton/report-skeleton.component';

/**
 * Comparison report — one row per department / category / menu …, one column per period (a single column without a
 * comparison, plus a Total column when comparing), a Total row, and a pie of the sales distribution. It is the body of
 * the report page: the frame, filters (date, branches, opening hours, period comparison) and export come from
 * the shared report page, which hands this component the API filter.
 */
@Component({
  selector: 'app-comparison-report',
  standalone: true,
  imports: [ReportSkeletonComponent, MynumberPipe, ReportEmptyComponent,ReportErrorComponent, TranslateModule, RouterLink, BoTableShellComponent, BoAmountPipe, BoColumnPipe, ReportChartComponent, ReportColumnsButtonComponent],
  templateUrl: './comparison-report.component.html',
  styleUrl: './comparison-report.component.scss',
})
export class ComparisonReportComponent {
  private svc = inject(ComparisonReportService);
  private lang = inject(LanguageService);
  private route = inject(ActivatedRoute);

  /** The report's catalog slug — its data call comes from `COMPARISON_REPORTS`, its columns from the shared registry. */
  slug = input.required<string>();
  filter = input.required<ReportApiFilter>();
  /** Bumped by the page's Refresh button. */
  refresh = input(0);
  /** The sub-columns the page asks for (also sent with the export); the user changes them with the shared button. */
  subColumns = input<string[] | undefined>(undefined);
  subColumnsChange = output<string[]>();

  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<ComparisonReportData | null>(null);
  private seq = 0;

  readonly slot = periodSlot;

  constructor() {
    effect(() => {
      const f = this.filter();
      this.refresh();
      untracked(() => void this.load(f));
    });
  }

  async load(f: ReportApiFilter = this.filter()): Promise<void> {
    const mine = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const d = await this.svc.load(this.config().route, f);
      if (mine !== this.seq) return; // a newer request superseded this one
      this.data.set(d);
    } catch (e: any) {
      if (mine !== this.seq) return;
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.data.set(null);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  config = computed(() => COMPARISON_REPORTS[this.slug()]);
  /** The name of a row (department, category, menu …). */
  nameOf = (r: ComparisonRecord): string => r[this.config().nameField] ?? '';

  rows = computed(() => this.data()?.records ?? []);

  /** The record field the rows are grouped by (purchase-by-item's Supplier / Category), when the filter asks for one. */
  private groupField = computed(() => {
    const map = this.config().groupFields;
    const by = this.filter()['groupBy'];
    return map && typeof by === 'string' ? map[by] ?? null : null;
  });
  /** Rows in groups (one nameless group when not grouping): each group has its header name and its rows. */
  groups = computed(() => {
    const field = this.groupField();
    if (!field) return [{ name: null as string | null, rows: this.rows() }];
    const out: { name: string | null; rows: ComparisonRecord[] }[] = [];
    for (const r of this.rows()) {
      const name = r[field] ?? '';
      const last = out[out.length - 1];
      if (last && last.name === name) last.rows.push(r); else out.push({ name, rows: [r] });
    }
    return out;
  });
  /** A sub-column that counts things: shown as a whole number. */
  isCount = (sub: string): boolean => !!this.config().countSubs?.includes(sub);
  /** A duration sub-column (seconds from the API), shown as `12m 3.45s` like the legacy prepared-time reports. */
  isTime = (sub: string): boolean => /time/i.test(sub);
  seconds(v: number): string {
    if (!v) return '0m 0.00s';
    return `${Math.floor(v / 60)}m ${(v % 60).toFixed(2)}s`;
  }
  groupTotal(rows: ComparisonRecord[], column: string, sub?: string): number {
    const ratio = sub ? this.config().ratioSubs?.[sub] : undefined;
    if (ratio) { const q = this.groupTotal(rows, column, ratio.qty); return this.groupTotal(rows, column, ratio.amount) / Math.max(q, 1); }
    return rows.reduce((t, r) => t + this.value(r, column, sub), 0);
  }

  /** URL params that carry the period / branches / comparison of this report, plus the row's product, to the drill-through. */
  drillParams(r: ComparisonRecord, d = this.config().drill!): Record<string, string | null> {
    const f = this.filter();
    // While comparing, the API filter's `fromDate` is moved to the start of the last month / year (the backend steps back from it);
    // the link carries the period the user chose, as the legacy drill-throughs did.
    const q = this.route.snapshot.queryParams;
    const range = f['allowComparison']
      ? resolvePreset(q['preset'] ?? 'thisMonth', { from: q['fromDate'], to: q['toDate'] })
      : { from: f.fromDate ?? null, to: f.toDate ?? null };
    return {
      preset: 'custom', fromDate: range.from, toDate: range.to,
      branches: f.branches?.length ? f.branches.join(',') : null,
      openingHour: f.applyOpeningHour ? '1' : null,
      // the product drill-through shows the same comparison; the aggregator list is not a comparison
      ...(d.param ? { [d.param]: r[d.idField] ?? null, ...(d.nameParam ? { [d.nameParam]: this.nameOf(r) || null } : {}) } : {
        cmp: f['allowComparison'] ? String(f['period'] ?? '') || null : null,
        cmpQty: f['allowComparison'] ? String(f['periodQty'] ?? '') || null : null,
        itemProductId: r[d.idField] ?? null, itemProductName: this.nameOf(r) || null,
      }),
    };
  }
  columns = computed(() => this.data()?.columns ?? []);
  /** Sub-columns under every column; none means the amounts are plain numbers. */
  subs = computed(() => this.data()?.subColumns ?? []);
  /** Without a comparison there is one "Total" period, so its header band is redundant: the sub-columns head the table directly. */
  flatHeader = computed(() => this.subs().length > 0 && this.columns().length === 1 && this.columns()[0] === 'Total');
  /** Comparison columns for the legend / chips (the synthetic "Total" is not a period). */
  periods = computed(() => this.columns().filter(c => c !== 'Total'));
  /** A comparison is on: the columns are periods, not the single `Total`. */
  comparing = computed(() => this.periods().length > 0);
  /** Legacy's per-row Total column: when comparing periods without sub-columns, on the amount reports that had it. */
  showRowTotal = computed(() => !!this.config().rowTotal && this.subs().length === 0 && this.columns().length > 1);
  /** A row's periods added up (plain amounts only, never averages). */
  rowTotal(r: ComparisonRecord): number { return this.columns().reduce((t, c) => t + this.value(r, c), 0); }
  groupRowTotal(rows: ComparisonRecord[]): number { return rows.reduce((t, r) => t + this.rowTotal(r), 0); }
  isEmpty = computed(() => !!this.data() && this.rows().length === 0);

  /** What the user picked (the report's defaults — all of them — until they change it). */
  selected = computed(() => this.subColumns() ?? getDefaultColumnKeys(this.slug()));
  subLabel = (key: string): string => columnLabel(this.slug(), key, this.lang.current());

  private entry(r: ComparisonRecord, column: string): Record<string, number> | number | undefined {
    return r.summary.find(s => Object.prototype.hasOwnProperty.call(s, column))?.[column];
  }
  /** Amount of a department in a column; `sub` picks the sub-column (the single value when there are none). */
  value(r: ComparisonRecord, column: string, sub?: string): number {
    const e = this.entry(r, column);
    if (e == null) return 0;
    if (typeof e === 'object') return +(sub ? e[sub] : 0) || 0;
    return +e || 0;
  }
  columnTotal(column: string, sub?: string): number { return this.groupTotal(this.rows(), column, sub); }

  /** Sales distribution by row — like the legacy: the `total` of every column added up (every sub-value when `total` is not shown). */
  chartRows = computed(() => this.rows()
    .map(r => {
      let amount = 0;
      for (const c of this.columns()) {
        const e = this.entry(r, c);
        if (e == null) continue;
        if (typeof e !== 'object') amount += +e || 0;
        else if (e['total'] !== undefined) amount += +e['total'] || 0;
        else amount += Object.values(e).reduce((t, v) => t + (typeof v === 'number' ? v : 0), 0);
      }
      return { label: this.nameOf(r), amount };
    })
    .filter(r => r.amount > 0));
  readonly chart: ReportChartConfig = { type: 'donut', labelKey: 'label', series: [{ key: 'amount' }] };
}
