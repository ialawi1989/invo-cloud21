import { Component, computed, effect, inject, untracked } from '@angular/core';
import { signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { withTranslations } from '@core/i18n/with-translations';
import { ReportChartComponent } from '../../../components/report-chart/report-chart.component';
import { ReportKpiRowComponent } from '../../../components/report-kpi-row/report-kpi-row.component';
import { ReportChartConfig, ReportKpi } from '../../../models/report.model';
import { toIso } from '../../../utils/report-period.util';
import { percentChange, shiftMonths } from '../../shared/period-compare';
import { findBoReport } from '../../config/business-overview.config';
import { BusinessOverviewService, StatementData } from '../../services/business-overview.service';
import {
  ParentGroup, computeProfitLines, fillMissingColumns, groupByParentType, rowTotal, sumColumns, summaryValue,
} from '../../shared/accounting.utils';
import { BoFilter } from '../../shared/bo-filter';
import { BoReportBase } from '../../shared/bo-report.base';
import { BoAmountPipe } from '../../shared/pipes/bo-amount.pipe';
import { BoAccountNamePipe } from '../../shared/pipes/bo-account-name.pipe';
import { BoColumnPipe } from '../../shared/pipes/bo-column.pipe';
import { BoAccountRowsComponent } from '../bo-account-rows/bo-account-rows.component';
import { BoStateComponent } from '../bo-state/bo-state.component';
import { BoTableShellComponent, periodSlot } from '../bo-table-shell/bo-table-shell.component';

type Tone = 'income' | 'expense' | 'profit';

interface SectionDef {
  key: string;
  kind: 'section' | 'profit';
  labelKey: string;
  totalKey?: string;
  tone: Tone;
}

/** Legacy section order: Income → COGS → Gross → Expenses → Operating → Net (Equity). */
const SECTIONS: SectionDef[] = [
  { key: 'Operating Income', kind: 'section', labelKey: 'REPORTS.BO.SECTIONS.INCOME', tone: 'income', totalKey: 'REPORTS.BO.SECTIONS.TOTAL_INCOME' },
  { key: 'Costs Of Goods Sold', kind: 'section', labelKey: 'REPORTS.BO.SECTIONS.COST_OF_GOODS_SOLD', tone: 'expense', totalKey: 'REPORTS.BO.SECTIONS.TOTAL_COGS' },
  { key: 'Gross Profit', kind: 'profit', labelKey: 'REPORTS.BO.SECTIONS.GROSS_PROFIT', tone: 'profit' },
  { key: 'Operating Expense', kind: 'section', labelKey: 'REPORTS.BO.SECTIONS.EXPENSES', tone: 'expense', totalKey: 'REPORTS.BO.SECTIONS.TOTAL_EXPENSES' },
  { key: 'Operating Profit', kind: 'profit', labelKey: 'REPORTS.BO.SECTIONS.OPERATING_PROFIT', tone: 'profit' },
  { key: 'Equity', kind: 'profit', labelKey: 'REPORTS.BO.SECTIONS.NET_PROFIT', tone: 'profit' },
];

@Component({
  selector: 'app-bo-profit-and-loss',
  standalone: true,
  imports: [
    TranslateModule, BoAmountPipe, BoAccountNamePipe, BoColumnPipe, BoAccountRowsComponent, BoStateComponent,
    BoTableShellComponent, ReportKpiRowComponent, ReportChartComponent,
  ],
  templateUrl: './profit-and-loss.component.html',
  styleUrl: './profit-and-loss.component.scss',
})
export class ProfitAndLossComponent extends BoReportBase<StatementData> {
  readonly cfg = findBoReport('profit-and-loss')!;
  private svc = inject(BusinessOverviewService);

  readonly sections = SECTIONS;
  readonly slot = periodSlot;
  readonly value = summaryValue;
  readonly rowTotal = rowTotal;

  showCharts = signal(false);

  constructor() {
    super();
    withTranslations('settings/chart-of-accounts');
    // Previous period (same length, right before the picked range) → "vs. previous period" on the KPI tiles.
    effect(() => {
      const d = this.data();
      const f = this.filter();
      untracked(() => void this.loadPrevious(d, f));
    });
  }

  /** Income / gross / net of the picked period and of the one before it (null until loaded). */
  private prev = signal<{ income: number; gross: number; net: number } | null>(null);
  private prevSeq = 0;

  /** Totals of a statement response (every column added up). */
  private totalsOf(pd: StatementData) {
    const p = computeProfitLines(pd.records, pd.columns);
    return { income: sumColumns(p.income, pd.columns), gross: sumColumns(p.gross, pd.columns), net: sumColumns(p.net, pd.columns) };
  }

  /**
   * "Previous period" = the window of EXACTLY the same length right before what the table shows,
   * asked with the same filter shape, and added up the same way as the tile (every column).
   *  - no comparison / branch comparison: the same number of days right before the picked range;
   *  - period comparison: the table spans (qty + 1) months / years → the (qty + 1) before that.
   * So tile and percentage always compare like with like, and the tile equals the table's Total column.
   */
  private async loadPrevious(d: StatementData | null, f: BoFilter): Promise<void> {
    const mine = ++this.prevSeq;
    this.prev.set(null);
    if (!d || !f.from || !f.to) return;
    const from = new Date(`${f.from}T00:00:00`);
    const to = new Date(`${f.to}T00:00:00`);
    let prevFrom: Date, prevTo: Date;
    if (f.compareType === 'period') {
      const qty = Math.min(10, Math.max(1, Math.trunc(Number(f.compareQty)) || 1));
      const months = (qty + 1) * (f.comparePeriod === 'Year' ? 12 : 1);
      prevFrom = shiftMonths(from, -months);
      prevTo = shiftMonths(to, -months);
    } else {
      const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
      if (!(days > 0)) return;
      prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1);
      prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - (days - 1));
    }
    try {
      const pd = await this.svc.statement(this.cfg, { ...f, from: toIso(prevFrom), to: toIso(prevTo) });
      if (mine !== this.prevSeq) return;
      fillMissingColumns(pd.records, pd.columns);
      this.prev.set(this.totalsOf(pd));
    } catch { /* no previous-period data → tiles simply show no delta */ }
  }

  protected fetch(f: BoFilter): Promise<StatementData> { return this.svc.statement(this.cfg, f); }

  protected override afterLoad(d: StatementData): void {
    fillMissingColumns(d.records, d.columns);
  }

  columns = computed(() => this.data()?.columns ?? []);
  /** Comparison columns for the legend/headers (the synthetic "Total" is not a period). */
  periods = computed(() => this.columns().filter(c => c !== 'Total'));
  showTotal = computed(() => this.columns().length > 1);
  groups = computed<ParentGroup[]>(() => {
    const d = this.data();
    return d ? groupByParentType(d.records, d.columns, SECTIONS.map(s => s.key)) : [];
  });
  isEmpty = computed(() => this.loaded() && this.groups().length === 0);

  group(key: string): ParentGroup | undefined { return this.groups().find(g => g.parentType === key); }
  profit = computed(() => {
    const d = this.data();
    return d ? computeProfitLines(d.records, d.columns) : null;
  });

  /** A profit row shows the API's own line (legacy), read from the section's first account. */
  profitValue(key: string, column: string): number {
    return summaryValue(this.group(key)?.childs[0]?.childs[0]?.summary, column);
  }
  profitTotal(key: string): number {
    return sumColumns(this.group(key)?.total, this.columns());
  }
  /** Row colour: Net Profit turns green when positive and red when it is a loss. */
  tone(def: SectionDef): Tone {
    if (def.key !== 'Equity') return def.tone;
    return this.profitTotal(def.key) < 0 ? 'expense' : 'income';
  }
  sectionTotal(key: string): number { return sumColumns(this.group(key)?.total, this.columns()); }

  kpis = computed<ReportKpi[]>(() => {
    const p = this.profit();
    if (!p) return [];
    const cols = this.columns();
    const prev = this.prev();
    const income = sumColumns(p.income, cols), gross = sumColumns(p.gross, cols), net = sumColumns(p.net, cols);
    return [
      { label: 'REPORTS.BO.SECTIONS.TOTAL_INCOME', value: income, type: 'currency', tone: 'income', delta: percentChange(income, prev?.income) },
      { label: 'REPORTS.BO.SECTIONS.GROSS_PROFIT', value: gross, type: 'currency', tone: 'profit', delta: percentChange(gross, prev?.gross) },
      { label: 'REPORTS.BO.SECTIONS.NET_PROFIT', value: net, type: 'currency', tone: net < 0 ? 'expense' : 'income', delta: percentChange(net, prev?.net) },
    ];
  });

  chartRows = computed(() => {
    const p = this.profit();
    return p ? this.columns().map(c => ({ label: c, net: p.net[c] ?? 0, gross: p.gross[c] ?? 0 })) : [];
  });
  readonly netChart: ReportChartConfig = {
    type: 'bar', labelKey: 'label', series: [{ key: 'net', nameKey: 'REPORTS.BO.SECTIONS.NET_PROFIT', kind: 'column' }],
  };
  readonly grossChart: ReportChartConfig = {
    type: 'area', labelKey: 'label', series: [{ key: 'gross', nameKey: 'REPORTS.BO.SECTIONS.GROSS_PROFIT' }],
  };
}
