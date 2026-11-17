import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NgApexchartsModule } from 'ng-apexcharts';

import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { MynumberPipe } from '@core/pipes/mynumber.pipe';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';

import { ReportCrumb, ReportPageShellComponent } from '../../../reports/components/report-page-shell/report-page-shell.component';
import { ReportFilterBarComponent } from '../../../reports/components/report-filter-bar/report-filter-bar.component';
import { ReportKpiRowComponent } from '../../../reports/components/report-kpi-row/report-kpi-row.component';
import { ReportSkeletonComponent } from '../../../reports/components/report-skeleton/report-skeleton.component';
import { ReportExportButtonComponent } from '../../../reports/components/report-export-button/report-export-button.component';
import { ReportFilterState, ReportKpi } from '../../../reports/models/report.model';
import { resolvePreset } from '../../../reports/utils/report-period.util';
import {
  CompaniesOverviewService, CompaniesPayments, CompaniesSales, CompanySalesRow,
} from '../../services/companies-overview.service';

type Tab = 'sales' | 'payments';
type Measure = 'netSales' | 'sales' | 'total' | 'numberOfInvoices' | 'discountTotal' | 'taxTotal' | 'totalReturn';
const MEASURE_LABELS: Record<Measure, string> = {
  netSales: 'COMPANIES_OVERVIEW.NET_SALES', sales: 'COMPANIES_OVERVIEW.SALES', total: 'COMPANIES_OVERVIEW.TOTAL',
  numberOfInvoices: 'COMPANIES_OVERVIEW.INVOICES', discountTotal: 'COMPANIES_OVERVIEW.DISCOUNT',
  taxTotal: 'COMPANIES_OVERVIEW.TAX', totalReturn: 'COMPANIES_OVERVIEW.RETURN',
};
const PALETTE = ['#32acc1', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981', '#14b8a6', '#6366f1', '#a855f7', '#f97316'];

/** Title-cases a payment-method key ("creditCard" / "credit_card" → "Credit Card"). */
const titleCase = (s: string): string =>
  s.split(/(?=[A-Z])|_/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/**
 * Companies Overview (`/companies-overview`) — the legacy company-group dashboard + reports as one report-style page:
 * a Sales tab (headline figures, per-company table with expandable branches, top-companies chart) and a Payments tab
 * (payment methods per company). Frame, period picker and export buttons are the shared ones from `/reports`.
 * The tab and period live in the URL.
 */
@Component({
  selector: 'app-companies-overview',
  standalone: true,
  imports: [
    FormsModule, TranslateModule, NgApexchartsModule, MycurrencyPipe, MynumberPipe,
    SearchDropdownComponent, EmptyStateComponent,
    ReportPageShellComponent, ReportFilterBarComponent, ReportKpiRowComponent, ReportSkeletonComponent, ReportExportButtonComponent,
  ],
  templateUrl: './companies-overview.component.html',
  styleUrl: './companies-overview.component.scss',
})
export class CompaniesOverviewComponent implements OnInit {
  private svc = inject(CompaniesOverviewService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private lang = inject(LanguageService);

  /** `dashboard` = headline figures + table + chart; `sales` / `payments` = the matching report (table only). */
  readonly mode: 'dashboard' | 'sales' | 'payments' = this.route.snapshot.data['mode'] ?? 'dashboard';
  readonly isDashboard = this.mode === 'dashboard';
  readonly tab: Tab = this.mode === 'payments' ? 'payments' : 'sales';
  readonly titleKey = this.isDashboard ? 'COMPANIES_OVERVIEW.NAV_DASHBOARD'
    : this.mode === 'sales' ? 'COMPANIES_OVERVIEW.REPORT_SALES' : 'COMPANIES_OVERVIEW.REPORT_PAYMENTS';
  readonly crumbs: ReportCrumb[] = this.isDashboard ? [] : [
    { label: this.lang.instant('COMPANIES_OVERVIEW.NAV_REPORTS'), url: '/companies-overview/reports' },
    { label: this.lang.instant(this.titleKey) },
  ];

  filterState = signal<ReportFilterState>({ preset: 'thisMonth' });
  range = computed(() => resolvePreset(this.filterState().preset, { from: this.filterState().from, to: this.filterState().to }));

  loading = signal(false);
  error = signal<string | null>(null);
  sales = signal<CompaniesSales | null>(null);
  payments = signal<CompaniesPayments | null>(null);
  spinning = signal(false);
  exporting = signal<'pdf' | 'xlsx' | null>(null);
  private seq = 0;

  search = signal('');
  expanded = signal<ReadonlySet<string>>(new Set());
  chartMeasure = signal<Measure>('netSales');
  readonly measures = (Object.keys(MEASURE_LABELS) as Measure[]).map(value => ({ value }));
  readonly measureLabel = (m: { value: Measure }): string => this.lang.instant(MEASURE_LABELS[m.value]);
  readonly sameMeasure = (a: { value: Measure }, b: { value: Measure }): boolean => a?.value === b?.value;
  readonly methodLabel = titleCase;

  ngOnInit(): void {
    const q = this.route.snapshot.queryParams;
    const preset = (q['preset'] as ReportFilterState['preset']) ?? 'thisMonth';
    const r = resolvePreset(preset, { from: q['fromDate'], to: q['toDate'] });
    this.filterState.set({ preset, from: q['fromDate'] ?? r.from, to: q['toDate'] ?? r.to });
    void this.load();
  }

  private syncUrl(): void {
    const s = this.filterState();
    void this.router.navigate([], {
      relativeTo: this.route, replaceUrl: true, queryParamsHandling: 'merge',
      queryParams: {
        preset: s.preset,
        fromDate: s.preset === 'custom' ? s.from : null,
        toDate: s.preset === 'custom' ? s.to : null,
      },
    });
  }

  onFilterApply(state: ReportFilterState): void {
    this.filterState.set({ ...this.filterState(), ...state });
    this.syncUrl();
    void this.load();
  }

  refresh(): void {
    this.spinning.set(true);
    setTimeout(() => this.spinning.set(false), 750);
    void this.load();
  }

  async load(): Promise<void> {
    const mine = ++this.seq;
    const { from, to } = this.range();
    this.loading.set(true);
    this.error.set(null);
    try {
      if (this.tab === 'sales') {
        const d = await this.svc.sales(from, to);
        if (mine !== this.seq) return;
        this.sales.set(d);
      } else {
        const d = await this.svc.payments(from, to);
        if (mine !== this.seq) return;
        this.payments.set(d);
      }
    } catch (e: any) {
      if (mine !== this.seq) return;
      this.error.set(e?.message ?? this.lang.instant('COMPANIES_OVERVIEW.LOAD_ERROR'));
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  async export(type: 'pdf' | 'xlsx' | 'csv'): Promise<void> {
    if (type === 'csv') return;
    const { from, to } = this.range();
    this.exporting.set(type);
    try {
      await this.svc.export(this.tab, type, from, to);
    } catch (e: any) {
      this.error.set(e?.message ?? this.lang.instant('COMPANIES_OVERVIEW.EXPORT_ERROR'));
    } finally {
      this.exporting.set(null);
    }
  }

  // ── Sales tab ──────────────────────────────────────────────────────────
  kpis = computed<ReportKpi[]>(() => {
    const d = this.sales();
    if (!d) return [];
    return [
      { label: 'COMPANIES_OVERVIEW.TOTAL_COMPANIES', value: d.companies.length, type: 'number', tone: 'asset' },
      { label: 'COMPANIES_OVERVIEW.TOTAL_ORDERS', value: d.totals.numberOfInvoices, type: 'number', tone: 'equity' },
      { label: 'COMPANIES_OVERVIEW.TOTAL_SALES', value: d.totals.sales, type: 'currency', tone: 'income' },
      { label: 'COMPANIES_OVERVIEW.NET_SALES', value: d.totals.netSales, type: 'currency', tone: 'profit' },
    ];
  });

  visibleCompanies = computed<CompanySalesRow[]>(() => {
    const all = this.sales()?.companies ?? [];
    const term = this.search().trim().toLowerCase();
    if (!term) return all;
    return all.filter(c => c.companyName.toLowerCase().includes(term) || c.branches.some(b => b.branchName.toLowerCase().includes(term)));
  });

  toggle(id: string): void {
    this.expanded.update(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  /** The ten best companies by the chosen measure. */
  private top = computed(() => {
    const m = this.chartMeasure();
    return [...(this.sales()?.companies ?? [])].sort((a, b) => b[m] - a[m]).slice(0, 10);
  });
  chartSeries = computed(() => [{ name: this.lang.instant(MEASURE_LABELS[this.chartMeasure()]), data: this.top().map(c => +c[this.chartMeasure()].toFixed(3)) }]);
  chartXaxis = computed(() => ({
    categories: this.top().map(c => c.companyName),
    labels: { rotate: -35, style: { fontSize: '11px', colors: '#64748b' } },
    axisBorder: { show: false }, axisTicks: { show: false },
  }));
  readonly chartMeta = { type: 'bar' as const, height: 320, fontFamily: 'Inter, sans-serif', toolbar: { show: false } };
  readonly palette = PALETTE;
  readonly plot = { bar: { columnWidth: '55%', borderRadius: 6, distributed: true } };
  readonly legend = { show: false };
  readonly grid = { borderColor: '#f1f5f9' };
  readonly dataLabels = { enabled: false };
  readonly yaxis = { labels: { style: { fontSize: '11px', colors: '#64748b' } } };

  // ── Payments tab ───────────────────────────────────────────────────────
  paymentRows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const rows = this.payments()?.rows ?? [];
    return term ? rows.filter(r => r.companyName.toLowerCase().includes(term)) : rows;
  });
}
