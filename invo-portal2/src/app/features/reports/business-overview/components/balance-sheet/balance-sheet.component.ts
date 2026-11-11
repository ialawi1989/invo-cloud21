import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { withTranslations } from '@core/i18n/with-translations';
import { ReportChartComponent } from '../../../components/report-chart/report-chart.component';
import { ReportKpiRowComponent } from '../../../components/report-kpi-row/report-kpi-row.component';
import { ReportChartConfig, ReportKpi } from '../../../models/report.model';
import { toIso } from '../../../utils/report-period.util';
import { percentChange, shiftMonths } from '../../shared/period-compare';
import { findBoReport } from '../../config/business-overview.config';
import { BusinessOverviewService, StatementData } from '../../services/business-overview.service';
import {
  ColumnTotals, ReportRecord, fillMissingColumns, rowTotal, sumColumns, summaryValue, totalsOf, totalsOfParentType,
} from '../../shared/accounting.utils';
import { BoFilter, profitLossQueryFor } from '../../shared/bo-filter';
import { BoReportBase } from '../../shared/bo-report.base';
import { BoAmountPipe } from '../../shared/pipes/bo-amount.pipe';
import { BoAccountNamePipe, accountLabel } from '../../shared/pipes/bo-account-name.pipe';
import { BoColumnPipe } from '../../shared/pipes/bo-column.pipe';
import { BoAccountRowsComponent } from '../bo-account-rows/bo-account-rows.component';
import { BoStateComponent } from '../bo-state/bo-state.component';
import { BoTableShellComponent, periodSlot } from '../bo-table-shell/bo-table-shell.component';

/** Asset sections, then Liabilities & Equity (legacy order). */
const ASSET_SECTIONS = ['Current Assets', 'Other Current Assets', 'Non Current Assets', 'Fixed Assets'];
const LIABILITY_EQUITY_SECTIONS = ['Current Liabilities', 'Other Current Liabilities', 'Long Term Liabilities', 'Equity'];
const SECTION_ORDER = [...ASSET_SECTIONS, ...LIABILITY_EQUITY_SECTIONS];

interface TypeBlock { type: string; childs: ReportRecord[]; total: ColumnTotals; }
interface Section { parentType: string; records: ReportRecord[]; total: ColumnTotals; types: TypeBlock[] | null; isAsset: boolean; tone: 'asset' | 'liability' | 'equity'; }

@Component({
  selector: 'app-bo-balance-sheet',
  standalone: true,
  imports: [
    TranslateModule, BoAmountPipe, BoAccountNamePipe, BoColumnPipe, BoAccountRowsComponent, BoStateComponent,
    BoTableShellComponent, ReportKpiRowComponent, ReportChartComponent,
  ],
  templateUrl: './balance-sheet.component.html',
  styleUrl: './balance-sheet.component.scss',
})
export class BalanceSheetComponent extends BoReportBase<StatementData> {
  readonly cfg = findBoReport('balance-sheet')!;
  private svc = inject(BusinessOverviewService);
  private t = inject(TranslateService);

  readonly slot = periodSlot;
  readonly rowTotal = rowTotal;
  showCharts = signal(false);

  constructor() {
    super();
    withTranslations('settings/chart-of-accounts');
    // The figures one period earlier → "vs. previous period" on the KPI tiles.
    effect(() => {
      const d = this.data();
      const f = this.filter();
      untracked(() => void this.loadPrevious(d, f));
    });
  }

  private prev = signal<{ assets: number; liabEquity: number } | null>(null);
  private prevSeq = 0;

  /**
   * The same report one period earlier, asked with the same filter shape and added up the same way as the tiles.
   *  - as of a date: the date one month earlier (one year when comparing by year);
   *  - a range: the same number of days right before it.
   */
  private async loadPrevious(d: StatementData | null, f: BoFilter): Promise<void> {
    const mine = ++this.prevSeq;
    this.prev.set(null);
    if (!d || !f.to) return;
    const from = new Date(`${f.from}T00:00:00`);
    const to = new Date(`${f.to}T00:00:00`);
    let prevFrom = from, prevTo: Date;
    if (f.asOf) {
      prevTo = shiftMonths(to, f.compareType === 'period' && f.comparePeriod === 'Year' ? -12 : -1);
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
      this.prev.set({
        assets: sumColumns(totalsOfParentType(pd.records, ASSET_SECTIONS, pd.columns), pd.columns),
        liabEquity: sumColumns(totalsOfParentType(pd.records, LIABILITY_EQUITY_SECTIONS, pd.columns), pd.columns),
      });
    } catch { /* no earlier figure → the tiles simply show no change */ }
  }

  protected fetch(f: BoFilter): Promise<StatementData> { return this.svc.statement(this.cfg, f); }
  protected override afterLoad(d: StatementData): void { fillMissingColumns(d.records, d.columns); }

  columns = computed(() => this.data()?.columns ?? []);
  periods = computed(() => this.columns().filter(c => c !== 'Total'));
  showTotal = computed(() => this.columns().length > 1);

  /** "Current Year Net Profit" opens P&L for the year to the sheet's date. */
  profitLossLink = computed(() => ({
    commands: ['/reports/view/profit-and-loss'],
    queryParams: profitLossQueryFor(this.filter()),
  }));

  sections = computed<Section[]>(() => {
    const d = this.data();
    if (!d) return [];
    const byParent = new Map<string, ReportRecord[]>();
    for (const r of d.records) {
      const k = r.parentType ?? 'Unknown';
      (byParent.get(k) ?? byParent.set(k, []).get(k)!).push(r);
    }
    const rank = (k: string) => { const i = SECTION_ORDER.indexOf(k); return i < 0 ? SECTION_ORDER.length : i; };
    return [...byParent]
      .map(([parentType, records], i) => ({ parentType, records, i }))
      .sort((a, b) => rank(a.parentType) - rank(b.parentType) || a.i - b.i)
      .map(({ parentType, records }) => {
        let rows = records;
        let types: TypeBlock[] | null = null;
        if (parentType === 'Current Assets') {
          // Cash first, then Bank, then the rest (legacy ordering).
          const weight = (r: ReportRecord) => (r.account === 'Cash' ? 0 : r.account === 'Bank' ? 1 : 2);
          rows = records.map((r, i) => ({ r, i })).sort((a, b) => weight(a.r) - weight(b.r) || a.i - b.i).map(x => x.r);
          const byType = new Map<string, ReportRecord[]>();
          for (const r of rows) (byType.get(r.type ?? 'Unknown') ?? byType.set(r.type ?? 'Unknown', []).get(r.type ?? 'Unknown')!).push(r);
          types = [...byType].map(([type, childs]) => ({ type, childs, total: totalsOf(childs, d.columns) }));
        }
        return {
          parentType, records: rows, types,
          total: totalsOf(rows, d.columns),
          isAsset: ASSET_SECTIONS.includes(parentType),
          tone: ASSET_SECTIONS.includes(parentType) ? 'asset' : parentType === 'Equity' ? 'equity' : 'liability',
        };
      });
  });
  isEmpty = computed(() => this.loaded() && this.sections().length === 0);

  /** Index of the last asset section — "Total Assets" is rendered right after it. */
  lastAssetIndex = computed(() => {
    const s = this.sections();
    let idx = -1;
    s.forEach((x, i) => { if (x.isAsset) idx = i; });
    return idx;
  });

  assetsTotal = computed<ColumnTotals>(() => totalsOfParentType(this.data()?.records ?? [], ASSET_SECTIONS, this.columns()));
  currentAssetsTotal = computed<ColumnTotals>(() => totalsOfParentType(this.data()?.records ?? [], 'Current Assets', this.columns()));
  liabEquityTotal = computed<ColumnTotals>(() => totalsOfParentType(this.data()?.records ?? [], LIABILITY_EQUITY_SECTIONS, this.columns()));

  sum = (v: ColumnTotals) => sumColumns(v, this.columns());
  val = summaryValue;

  kpis = computed<ReportKpi[]>(() => {
    if (!this.data()) return [];
    const assets = this.sum(this.assetsTotal()), liabEquity = this.sum(this.liabEquityTotal());
    const prev = this.prev();
    return [
      { label: 'REPORTS.BO.SECTIONS.TOTAL_ASSETS', value: assets, type: 'currency', tone: 'asset', delta: percentChange(assets, prev?.assets) },
      { label: 'REPORTS.BO.SECTIONS.LIABILITIES_AND_EQUITY', value: liabEquity, type: 'currency', tone: 'equity', delta: percentChange(liabEquity, prev?.liabEquity) },
    ];
  });

  barRows = computed(() => this.columns().map(c => ({
    label: c, assets: this.assetsTotal()[c] ?? 0, liab: this.liabEquityTotal()[c] ?? 0,
  })));
  readonly barChart: ReportChartConfig = {
    type: 'bar', labelKey: 'label',
    series: [
      { key: 'assets', nameKey: 'REPORTS.BO.SECTIONS.TOTAL_ASSETS', kind: 'column' },
      { key: 'liab', nameKey: 'REPORTS.BO.SECTIONS.LIABILITIES_AND_EQUITY', kind: 'column' },
    ],
  };

  /** Asset composition donut: positive asset sections only, as in legacy. */
  donutRows = computed(() => this.sections()
    .filter(s => s.isAsset)
    .map(s => ({ label: accountLabel(this.t, s.parentType), amount: Math.abs(this.sum(s.total)), raw: this.sum(s.total) }))
    .filter(r => r.raw > 0));
  readonly donutChart: ReportChartConfig = { type: 'donut', labelKey: 'label', series: [{ key: 'amount' }] };
}
