import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { BoTableShellComponent, periodSlot } from '../business-overview/components/bo-table-shell/bo-table-shell.component';
import { BoAmountPipe } from '../business-overview/shared/pipes/bo-amount.pipe';
import { BoColumnPipe } from '../business-overview/shared/pipes/bo-column.pipe';
import { ReportChartComponent } from '../components/report-chart/report-chart.component';
import { ReportColumnsButtonComponent } from '../columns/report-columns-button.component';
import { columnLabel, getDefaultColumnKeys } from '../columns/report-columns';
import { ReportApiFilter, ReportChartConfig } from '../models/report.model';
import { COMPARISON_REPORTS } from './comparison-reports';
import { ComparisonRecord, ComparisonReportData, ComparisonReportService } from './comparison-report.service';
import { ReportErrorComponent } from '../components/report-error/report-error.component';
import { ReportEmptyComponent } from '../components/report-empty/report-empty.component';

/**
 * Comparison report — one row per department / category / menu …, one column per period (a single column without a
 * comparison, plus a Total column when comparing), a Total row, and a pie of the sales distribution. It is the body of
 * the report page: the frame, filters (date, branches, opening hours, period comparison) and export come from
 * the shared report page, which hands this component the API filter.
 */
@Component({
  selector: 'app-comparison-report',
  standalone: true,
  imports: [ReportEmptyComponent, ReportErrorComponent, TranslateModule, RouterLink, BoTableShellComponent, BoAmountPipe, BoColumnPipe, ReportChartComponent, ReportColumnsButtonComponent],
  templateUrl: './comparison-report.component.html',
  styleUrl: './comparison-report.component.scss',
})
export class ComparisonReportComponent {
  private svc = inject(ComparisonReportService);
  private lang = inject(LanguageService);

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
  groupTotal(rows: ComparisonRecord[], column: string, sub?: string): number { return rows.reduce((t, r) => t + this.value(r, column, sub), 0); }

  /** URL params that carry the period / branches / comparison of this report, plus the row's product, to the drill-through. */
  drillParams(r: ComparisonRecord): Record<string, string | null> {
    const f = this.filter();
    const d = this.config().drill!;
    return {
      preset: 'custom', fromDate: f.fromDate ?? null, toDate: f.toDate ?? null,
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
  columnTotal(column: string, sub?: string): number { return this.rows().reduce((t, r) => t + this.value(r, column, sub), 0); }

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
