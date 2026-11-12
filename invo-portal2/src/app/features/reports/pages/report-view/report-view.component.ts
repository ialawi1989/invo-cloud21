import { Component, OnDestroy, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ApiService } from '@core/http/api.service';
import { LanguageService } from '@core/i18n/language.service';
import { LayoutService } from '@core/layout/services/layout.service';
import { ModalService } from '@shared/modal/modal.service';

import { findReport, SUB_REPORTS } from '../../models/report-catalog';
import { CompanyService } from '@core/auth/company.service';
import { isEmployeeEarningsEnabled } from '@core/auth/employee-earnings';
import { reportIcon } from '../../models/report-icons';
import {
  ReportApiFilter,
  ReportFilterState,
  ReportGroup,
  ReportMeta,
  ReportResult,
} from '../../models/report.model';
import { ReportsService } from '../../services/reports.service';
import { defaultFilter } from '../../business-overview/shared/bo-filter';
import { carryFilterQuery, carryTargetFor } from '../../business-overview/shared/carry-filter';
import {
  ReportsBrowseData, ReportsBrowseModalComponent,
} from '../../components/reports-browse-modal/reports-browse-modal.component';
import {
  ExportFormat, ReportExportButtonComponent,
} from '../../components/report-export-button/report-export-button.component';
import { ReportPageShellComponent } from '../../components/report-page-shell/report-page-shell.component';
import { ReportsRecentService } from '../../services/reports-recent.service';
import { ReportsFavoritesService } from '../../services/reports-favorites.service';
import { resolvePreset } from '../../utils/report-period.util';

import { ReportFilterBarComponent, BranchOption } from '../../components/report-filter-bar/report-filter-bar.component';
import { ReportKpiRowComponent } from '../../components/report-kpi-row/report-kpi-row.component';
import { ReportDataTableComponent } from '../../components/report-data-table/report-data-table.component';
import { SalesSummaryComponent } from '../../sales/sales-summary/sales-summary.component';
import { ComparisonReportComponent } from '../../comparison/comparison-report.component';
import { SalesByProductComponent } from '../../sales/sales-by-product/sales-by-product.component';
import { SalesByItemTransactionsComponent } from '../../sales/sales-by-item-transactions/sales-by-item-transactions.component';
import { VoidedSalesComponent } from '../../sales/voided-sales/voided-sales.component';
import { SalesByProductVsServiceComponent } from '../../sales/sales-by-product-vs-service/sales-by-product-vs-service.component';
import { SalesByHoursByProductComponent } from '../../sales/sales-by-hours-by-product/sales-by-hours-by-product.component';
import { DepartmentSalesPaymentsComponent } from '../../sales/department-sales-payments/department-sales-payments.component';
import { DailyClosingComponent } from '../../sales/daily-closing/daily-closing.component';
import { DailySalesSubComponent } from '../../sales/daily-closing/daily-sales-sub.component';
import { SalesByAggregatorSubComponent } from '../../sales/sales-by-aggregator-sub/sales-by-aggregator-sub.component';
import { ReportScheduleButtonComponent } from '../../components/report-schedule-button/report-schedule-button.component';
import { ReportNoteComponent } from '../../components/report-note/report-note.component';
import { SalesByInvoiceComponent } from '../../sales/sales-by-invoice/sales-by-invoice.component';
import { GeneralInventoryComponent } from '../../inventory/general-inventory/general-inventory.component';
import { ProductMovementComponent } from '../../inventory/product-movement/product-movement.component';
import { FlatReportComponent } from '../../flat/flat-report.component';
import { ReportSelectPromptComponent } from '../../components/report-select-prompt/report-select-prompt.component';
import { AttendanceAbsenceComponent } from '../../attendance/attendance-absence/attendance-absence.component';
import { AttendanceAuditComponent } from '../../attendance/attendance-audit/attendance-audit.component';
import { AttendanceTrendsComponent } from '../../attendance/attendance-trends/attendance-trends.component';
import { EmployeeAttendanceDetailComponent } from '../../attendance/employee-detail/employee-detail.component';
import { CashierShiftsComponent } from '../../employee/cashier-shifts/cashier-shifts.component';
import { CustomerAgingComponent } from '../../customer/customer-aging/customer-aging.component';
import { SalesByTerminalComponent } from '../../sales/sales-by-terminal/sales-by-terminal.component';
import { SalesByDeliveryAreaComponent } from '../../sales/sales-by-delivery-area/sales-by-delivery-area.component';
import { SalesByProductsCategoryComponent } from '../../sales/sales-by-products-category/sales-by-products-category.component';
import { SalesByProductsVsOptionsComponent } from '../../sales/sales-by-products-vs-options/sales-by-products-vs-options.component';
import { isDefaultColumns, pickReportColumns } from '../../columns/report-columns';
import { ReportChartComponent } from '../../components/report-chart/report-chart.component';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';

/**
 * Generic report shell — the single host for every report in the catalog
 * (the modern replacement for InvoCloudFront2's per-report components +
 * `ViewReportComponent`). Reads `:slug`, resolves the `ReportMeta`, renders the
 * filter-bar / KPI row / chart / table, and keeps filter state in the URL.
 */
/** An id from a URL list — drops blanks and the "[object Object]" an earlier picker bug left in saved links. */
const isId = (v: string): boolean => !!v && !v.includes('[object');

@Component({
  selector: 'app-report-view',
  standalone: true,
  imports: [ReportErrorComponent, 
    CommonModule,
    TranslateModule,
    ReportPageShellComponent,
    SalesSummaryComponent,
    ComparisonReportComponent,
    SalesByProductComponent,
    SalesByItemTransactionsComponent,
    VoidedSalesComponent,
    SalesByTerminalComponent,
    CustomerAgingComponent,
    CashierShiftsComponent,
    AttendanceTrendsComponent,
    AttendanceAuditComponent,
    AttendanceAbsenceComponent,
    ReportSelectPromptComponent,
    EmployeeAttendanceDetailComponent,
    FlatReportComponent,
    ProductMovementComponent,
    GeneralInventoryComponent,
    SalesByInvoiceComponent,
    ReportNoteComponent,
    ReportScheduleButtonComponent,
    SalesByAggregatorSubComponent,
    DailyClosingComponent,
    DailySalesSubComponent,
    DepartmentSalesPaymentsComponent,
    SalesByHoursByProductComponent,
    SalesByProductVsServiceComponent,
    SalesByDeliveryAreaComponent,
    SalesByProductsCategoryComponent,
    SalesByProductsVsOptionsComponent,
    ReportExportButtonComponent,
    ReportFilterBarComponent,
    ReportKpiRowComponent,
    ReportDataTableComponent,
    ReportChartComponent,
  ],
  templateUrl: './report-view.component.html',
  styleUrl: './report-view.component.scss',
})
export class ReportViewComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private lang = inject(LanguageService);
  private company = inject(CompanyService);
  private service = inject(ReportsService);
  private favs = inject(ReportsFavoritesService);
  private layout = inject(LayoutService);
  private api = inject(ApiService);
  private modal = inject(ModalService);

  /** Route param, bound via `withComponentInputBinding()`. */
  slug = input<string>('');

  meta = signal<ReportMeta | null>(null);
  group = signal<ReportGroup | null>(null);
  notFound = signal(false);

  loading = signal(false);
  error = signal<string | null>(null);
  result = signal<ReportResult | null>(null);

  filterState = signal<ReportFilterState>({ preset: 'thisMonth' });

  /** Branch options — wire to the branch endpoint when available. */
  branchOptions = signal<BranchOption[]>([]);

  icon = (name?: string) => reportIcon(name);

  isFavorite = computed(() => {
    const m = this.meta();
    return m ? this.favs.isFavorite(m.slug) : false;
  });

  /**
   * True when this report requires a single branch selection (`requireBranch`)
   * and the filter state doesn't have exactly one chosen yet. Mirrors
   * InvoCloudFront2's required-entity-filter gate (`required-filters.util.ts`):
   * calling the API before the mandatory selection is made either errors or
   * returns garbage, so the fetch is held back and a prompt is shown instead.
   */
  requiredFiltersMissing = computed(() => {
    const m = this.meta();
    if (m?.filters?.requireProduct && !(this.filterState().productIds?.length)) return true;
    if (m?.filters?.requireEmployee && !(this.filterState().employeeIds?.length)) return true;
    if (m?.filters?.requireDiscount && !(this.filterState().discountIds?.length)) return true;
    if (!m?.filters?.requireBranch) return false;
    return (this.filterState().branches?.length ?? 0) !== 1;
  });

  /** The export formats this report offers (the shared export button also lists Print). */
  exportFormats = computed<ExportFormat[]>(() => {
    const e = this.meta()?.export;
    return e ? (['pdf', 'xlsx', 'csv'] as const).filter(f => !!e[f]) : [];
  });

  constructor() {
    // The route reuses this component when only `:slug` changes (Browse Reports → another report), so the report is
    // (re)initialised whenever the slug changes — not only once in ngOnInit.
    effect(() => {
      const slug = this.slug();
      untracked(() => void this.init(slug));
    });
  }

  ngOnInit(): void {
    // Edge-to-edge page like the Business Overview reports: the layout drops its padding and the page scrolls its content.
    this.layout.setNoPadding(true);
    void this.loadBranches();
  }

  /** Counts the initialisations, so a slow earlier one can't overwrite a newer report. */
  private initSeq = 0;

  private recent = inject(ReportsRecentService);

  private async init(slug: string): Promise<void> {
    if (findReport(slug) && !SUB_REPORTS.some(r => r.slug === slug)) this.recent.push(slug);
    if (!slug) return;
    const mine = ++this.initSeq;
    // Clear the previous report right away (its filters, result and errors must not show under the new title).
    this.notFound.set(false);
    this.result.set(null);
    this.error.set(null);
    this.loading.set(false);
    await this.lang.loadFeature('reports');
    if (mine !== this.initSeq) return;

    const found = findReport(slug);
    if (!found) {
      this.meta.set(null);
      this.notFound.set(true);
      return;
    }
    if (found.meta.earningsFeature
        && !isEmployeeEarningsEnabled(await this.company.loadSettings(), found.meta.earningsFeature)) {
      if (mine !== this.initSeq) return;
      this.meta.set(null);
      this.notFound.set(true);
      return;
    }
    if (mine !== this.initSeq) return;
    this.meta.set(found.meta);
    this.group.set(found.group);

    this.filterState.set(this.readFilterFromUrl(found.meta));
    await this.load();
  }

  /** Restore filter state from the URL, defaulting sensibly per report. */
  private readFilterFromUrl(meta: ReportMeta): ReportFilterState {
    const q = this.route.snapshot.queryParams;
    const preset = (q['preset'] as ReportFilterState['preset']) ?? 'thisMonth';
    const range = resolvePreset(preset, { from: q['fromDate'], to: q['toDate'] });
    return {
      preset,
      from: q['fromDate'] ?? range.from,
      to: q['toDate'] ?? range.to,
      branches: q['branches'] ? String(q['branches']).split(',').filter(Boolean) : [],
      compare: q['compare'] === 'true',
      applyOpeningHour: meta.filters?.applyOpeningHour ? q['openingHour'] === '1' : undefined,
      productIds: meta.filters?.products ? (q['products'] ? String(q['products']).split(',').filter(isId) : []) : undefined,
      categoryIds: meta.filters?.categories ? (q['categories'] ? String(q['categories']).split(',').filter(isId) : []) : undefined,
      filterBy: meta.filters?.filterBy?.length ? (meta.filters.filterBy.includes(String(q['filterBy'])) ? String(q['filterBy']) : meta.filters.filterBy[0]) : undefined,
      customerType: meta.filters?.customerType ? (['Individual', 'Business'].includes(String(q['customerType'])) ? String(q['customerType']) : '') : undefined,
      discountIds: meta.filters?.discount ? (q['discount'] ? String(q['discount']).split(',').filter(x => x === 'others' || isId(x)).slice(0, 1) : []) : undefined,
      supplierIds: meta.filters?.suppliers ? (q['suppliers'] ? String(q['suppliers']).split(',').filter(isId) : []) : undefined,
      customerIds: meta.filters?.customers ? (q['customers'] ? String(q['customers']).split(',').filter(isId) : []) : undefined,
      hasBalanceOnly: meta.filters?.hasBalanceOnly ? q['balanceOnly'] === '1' : undefined,
      salesEmployee: meta.filters?.salesEmployee ? q['salesEmployee'] === '1' : undefined,
      productTypes: meta.filters?.productTypes?.length ? (q['types'] ? String(q['types']).split(',').filter(t => meta.filters!.productTypes!.includes(t)) : []) : undefined,
      locationIds: meta.filters?.locations ? (q['locations'] ? String(q['locations']).split(',').filter(isId) : []) : undefined,
      hideDeleted: meta.filters?.hideDeleted ? q['hideDeleted'] === '1' : undefined,
      mode: meta.filters?.purchaseMode ? (['planned', 'forecast'].includes(String(q['mode'])) ? String(q['mode']) : 'actual') : undefined,
      employeeIds: meta.filters?.voidedBy ? (q['voidedBy'] ? String(q['voidedBy']).split(',').filter(isId) : [])
        : meta.filters?.singleEmployee ? (q['employee'] ? String(q['employee']).split(',').filter(isId).slice(0, 1) : []) : undefined,
      voidReasons: meta.filters?.voidReasons ? (q['voidReasons'] ? String(q['voidReasons']).split('|').filter(Boolean) : []) : undefined,
      voidTimings: meta.filters?.voidTimings ? (q['voidTimings'] ? String(q['voidTimings']).split(',').filter(Boolean) : []) : undefined,
      sources: meta.filters?.sources?.length
        ? (q['sources'] ? String(q['sources']).split(',').filter(s => meta.filters!.sources!.includes(s)) : []) : undefined,
      subColumns: meta.filters?.subColumns ? pickReportColumns(meta.slug, q['cols']) : undefined,
      comparison: meta.filters?.comparePeriods && (q['cmp'] === 'Month' || q['cmp'] === 'Year')
        ? { period: q['cmp'] as 'Month' | 'Year', qty: Math.min(10, Math.max(1, Math.trunc(Number(q['cmpQty'])) || 1)) }
        : (meta.filters?.comparePeriods ? null : undefined),
      asOf: meta.filters?.asOf ? !(meta.filters.asOfOptional && q['range'] === '1') : undefined,
      sortValue: q['sortValue'],
      sortDirection: q['sortDirection'] as 'asc' | 'desc' | undefined,
    };
  }

  onFilterApply(state: ReportFilterState): void {
    this.filterState.set({ ...this.filterState(), ...state });
    this.syncUrl();
    this.load();
  }

  /** "Customize columns" of a `subColumns` report: keep the choice in the state and the URL; the body reloads itself. */
  onSubColumns(cols: string[]): void {
    this.filterState.update(st => ({ ...st, subColumns: cols }));
    this.syncUrl();
  }

  onSortChange(sort: { key: string; direction: 'asc' | 'desc' } | null): void {
    this.filterState.update(s => ({
      ...s,
      sortValue: sort?.key,
      sortDirection: sort?.direction,
    }));
    this.syncUrl();
    // Client-side sort already applied by the table; no refetch needed unless
    // the backend paginates. Kept in the URL for shareability.
  }

  /** Push the current filter state onto the URL (shareable/bookmarkable). */
  private syncUrl(): void {
    const s = this.filterState();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        preset: s.preset,
        fromDate: s.preset === 'custom' ? s.from : null,
        toDate: s.preset === 'custom' ? s.to : null,
        branches: s.branches?.length ? s.branches.join(',') : null,
        compare: s.compare ? 'true' : null,
        openingHour: this.meta()?.filters?.applyOpeningHour && s.applyOpeningHour ? '1' : null,
        products: this.meta()?.filters?.products && s.productIds?.length ? s.productIds.join(',') : null,
        sources: this.meta()?.filters?.sources?.length && s.sources?.length ? s.sources.join(',') : null,
        categories: this.meta()?.filters?.categories && s.categoryIds?.length ? s.categoryIds.join(',') : null,
        filterBy: this.meta()?.filters?.filterBy?.length && s.filterBy && s.filterBy !== this.meta()!.filters!.filterBy![0] ? s.filterBy : null,
        customerType: this.meta()?.filters?.customerType && s.customerType ? s.customerType : null,
        discount: this.meta()?.filters?.discount && s.discountIds?.length ? s.discountIds[0] : null,
        suppliers: this.meta()?.filters?.suppliers && s.supplierIds?.length ? s.supplierIds.join(',') : null,
        customers: this.meta()?.filters?.customers && s.customerIds?.length ? s.customerIds.join(',') : null,
        balanceOnly: this.meta()?.filters?.hasBalanceOnly && s.hasBalanceOnly ? '1' : null,
        salesEmployee: this.meta()?.filters?.salesEmployee && s.salesEmployee ? '1' : null,
        types: this.meta()?.filters?.productTypes?.length && s.productTypes?.length ? s.productTypes.join(',') : null,
        locations: this.meta()?.filters?.locations && s.locationIds?.length ? s.locationIds.join(',') : null,
        hideDeleted: this.meta()?.filters?.hideDeleted && s.hideDeleted ? '1' : null,
        mode: this.meta()?.filters?.purchaseMode && s.mode && s.mode !== 'actual' ? s.mode : null,
        voidedBy: this.meta()?.filters?.voidedBy && s.employeeIds?.length ? s.employeeIds.join(',') : null,
        employee: this.meta()?.filters?.singleEmployee && s.employeeIds?.length ? s.employeeIds[0] : null,
        // reasons are free text (may hold commas), so they are joined with a pipe
        voidReasons: this.meta()?.filters?.voidReasons && s.voidReasons?.length ? s.voidReasons.join('|') : null,
        voidTimings: this.meta()?.filters?.voidTimings && s.voidTimings?.length ? s.voidTimings.join(',') : null,
        // the report's default columns are not written
        cols: this.meta()?.filters?.subColumns && s.subColumns && !isDefaultColumns(this.meta()!.slug, s.subColumns) ? s.subColumns.join(',') : null,
        cmp: this.meta()?.filters?.comparePeriods && s.comparison ? s.comparison.period : null,
        cmpQty: this.meta()?.filters?.comparePeriods && s.comparison ? String(s.comparison.qty) : null,
        range: this.meta()?.filters?.asOfOptional && s.asOf === false ? '1' : null,
        sortValue: s.sortValue ?? null,
        sortDirection: s.sortDirection ?? null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Map the UI filter state → backend `ReportApiFilter`. */
  private toApiFilter(): ReportApiFilter {
    const s = this.filterState();
    let range = resolvePreset(s.preset, { from: s.from, to: s.to });
    if (this.meta()?.filters?.monthOnly) {
      // a longer range (carried over from another report) becomes its last month up to today
      const today = new Date().toISOString().slice(0, 10);
      const [y, m] = (range.to < today ? range.to : today).split('-').map(Number);
      const last = new Date(y, m, 0).getDate();
      range = { ...range, from: `${y}-${String(m).padStart(2, '0')}-01`, to: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
    }
    const filter: ReportApiFilter = {
      fromDate: range.from,
      toDate: range.to,
      branches: s.branches?.length ? s.branches : undefined,
    };
    if (s.compare) filter.compareType = 'previousPeriod';
    if (this.meta()?.filters?.applyOpeningHour && s.applyOpeningHour) filter.applyOpeningHour = true;
    // Product / source filters (the API names are `productIds` and `sources`, as in the legacy).
    if (this.meta()?.filters?.products && s.productIds?.length) filter['productIds'] = s.productIds;
    if (this.meta()?.filters?.sources?.length && s.sources?.length) filter[this.meta()!.filters!.sourcesKey ?? 'sources'] = s.sources;
    if (this.meta()?.filters?.categories && s.categoryIds?.length) filter['categoryIds'] = s.categoryIds;
    if (this.meta()?.filters?.voidTimings && s.voidTimings?.length) filter['voidTimings'] = s.voidTimings;
    if (this.meta()?.filters?.voidedBy && s.employeeIds?.length) filter['employeeIds'] = s.employeeIds;
    if (this.meta()?.filters?.singleEmployee && s.employeeIds?.length) filter[this.meta()!.filters!.singleEmployeeKey ?? 'employeeId'] = s.employeeIds[0];
    if (this.meta()?.filters?.singleBranch && s.branches?.length) filter['branchId'] = s.branches[0];
    if (this.meta()?.filters?.voidReasons && s.voidReasons?.length) filter['voidReasons'] = s.voidReasons;
    // The aggregator drill-through carries the aggregator's name in the URL (the export needs it too).
    if (this.meta()?.customBody === 'service-details') filter['serviceId'] = this.route.snapshot.queryParams['serviceId'];
    if (this.meta()?.customBody === 'aggregator-sub') filter['aggregatorName'] = this.route.snapshot.queryParams['aggregatorName'];
    // Cashier Report: the export is the chosen shift's report
    if (this.meta()?.customBody === 'cashier-shifts') { const c = this.route.snapshot.queryParams['cashierId']; if (c) filter['cashierId'] = c; }
    // Product Movement is one product's stock card — the backend takes a single `productId`.
    if (this.meta()?.customBody === 'product-movement') filter['productId'] = s.productIds?.[0];
    // Daily Closing (and the sales behind it): one business day of one branch, always with the branch's opening hour.
    if (this.meta()?.customBody === 'daily-closing' || this.meta()?.customBody === 'daily-sales-sub') {
      filter['date'] = range.to;
      filter['branchId'] = s.branches?.[0];
      filter.applyOpeningHour = true;
    }
    if (this.meta()?.filters?.filterBy?.length) {
      const opts = this.meta()!.filters!.filterBy!;
      const key = this.meta()!.filters!.filterByKey;
      const v = s.filterBy ?? opts[0];
      // With its own API key the first value means "none" and is left out; otherwise the choice is always sent.
      if (!key) filter['filterBy'] = v; else if (v !== opts[0]) filter[key] = v;
    }
    if (this.meta()?.filters?.locations && s.locationIds?.length) filter[this.meta()!.filters!.locationsKey ?? 'locationIds'] = s.locationIds;
    if (this.meta()?.filters?.productTypes?.length && s.productTypes?.length) filter['types'] = s.productTypes;
    if (this.meta()?.filters?.customerType && s.customerType) filter['type'] = s.customerType;
    if (this.meta()?.filters?.suppliers && s.supplierIds?.length) filter['supplierIds'] = s.supplierIds;
    // Monthly BLD Breakdown: the month, as the first day of it
    if (this.meta()?.slug === 'monthly-bld-breakdown') filter['date'] = filter.fromDate;
    // one discount's documents; `others` = documents with no discount
    if (this.meta()?.filters?.discount) { const d = s.discountIds?.[0]; filter['discountId'] = d && d !== 'others' ? d : null; }
    if (this.meta()?.filters?.customers && s.customerIds?.length) filter['customerIds'] = s.customerIds;
    if (this.meta()?.filters?.hasBalanceOnly) filter['hasBalanceOnly'] = !!s.hasBalanceOnly;
    if (this.meta()?.filters?.salesEmployee) filter['isSalesEmployee'] = !!s.salesEmployee;
    if (this.meta()?.filters?.hideDeleted) filter['hideDeleted'] = !!s.hideDeleted;
    if (this.meta()?.filters?.purchaseMode) filter['mode'] = s.mode ?? 'actual';
    // A drill-through carries its row (the product of a Sales by Product row) in the URL; the export needs it too.
    if (this.meta()?.customBody === 'item-transactions' || this.meta()?.slug === 'purchase-by-item-sub') {
      const q = this.route.snapshot.queryParams;
      if (q['itemProductId']) filter['productId'] = q['itemProductId'];
      else if (q['itemProductName']) filter['productName'] = q['itemProductName'];
    }
    // The report's sub-columns (the backend honours them while comparing; the export carries them too).
    if (this.meta()?.filters?.subColumns && s.subColumns?.length) filter['subColumns'] = s.subColumns;
    // Period comparison: the same payload the legacy filter converter builds (and the Business Overview reports send).
    if (this.meta()?.filters?.comparePeriods) {
      if (s.comparison) {
        Object.assign(filter, {
          allowComparison: true, compareType: 'Period', compareWith: s.comparison.period,
          period: s.comparison.period, periodQty: s.comparison.qty,
        });
        // The comparison looks back from the period's END: N previous months/years plus the last month/year of the range (the backend
        // steps back from `fromDate`, so a long range would otherwise add a column for every month inside it).
        const to = String(filter.toDate ?? '');
        if (/^\d{4}-\d{2}-\d{2}/.test(to)) filter.fromDate = s.comparison.period === 'Year' ? `${to.slice(0, 4)}-01-01` : `${to.slice(0, 7)}-01`;
      } else {
        Object.assign(filter, { allowComparison: false, periodQty: 1 });
      }
    }
    Object.assign(filter, this.meta()?.requestFilter ?? {});
    if (s.sortValue) filter.sortBy = [{ sortValue: s.sortValue, sortDirection: s.sortDirection ?? 'asc' }];
    // An as-of report switched to a range ("As of" unticked) is a plain from–to request.
    if (this.meta()?.filters?.asOf && this.filterState().asOf !== false) { filter.allowAsOf = true; filter['asOfChoosed'] = true; }
    return filter;
  }

  async load(): Promise<void> {
    const meta = this.meta();
    if (!meta) return;
    if (meta.customBody) return; // the body loads its own data
    if (this.requiredFiltersMissing()) {
      // Required branch not chosen yet — don't call the API (it would error
      // or return unscoped data); clear any stale result and wait for the
      // filter bar to supply one.
      this.result.set(null);
      this.error.set(null);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.service.getReport(meta, this.toApiFilter());
      this.result.set(result);
    } catch (e: any) {
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.result.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void { this.layout.setNoPadding(false); }

  /** The company's branches for the Filters dialog (same call the Business Overview reports make). */
  private async loadBranches(): Promise<void> {
    try {
      const res = await this.api.request<any>(
        this.api.post('branch/getBranches/', { page: 1, limit: 500, searchTerm: '', sortBy: {} }),
      );
      const list: any[] = res?.data?.list ?? [];
      this.branchOptions.set(list.map(b => ({ value: b.id, label: b.name })));
    } catch {
      this.branchOptions.set([]); // the branch section simply hides; the report still runs for all branches
    }
  }

  spinning = signal(false);
  /** Bumped by Refresh — the reports that render their own body (`customBody`) reload on it. */
  refreshTick = signal(0);
  /** The API filter for a `customBody` component. */
  bodyFilter = computed(() => this.toApiFilter());

  refresh(): void {
    this.refreshTick.update(n => n + 1);
    this.spinning.set(true);
    setTimeout(() => this.spinning.set(false), 750);
    void this.load();
  }

  /** "Browse Reports": open another report and take the filters (dates / as-of, branches) along, as the legacy app did. */
  async openBrowse(): Promise<void> {
    const ref = this.modal.open<ReportsBrowseModalComponent, ReportsBrowseData, string>(ReportsBrowseModalComponent, {
      size: 'md', data: { currentSlug: this.slug() },
    });
    const slug = await ref.afterClosed();
    if (!slug || slug === this.slug()) return;
    void this.router.navigate(['/reports/view', slug], { queryParams: this.carryQuery(slug) });
  }

  private carryQuery(slug: string): Record<string, string | null> {
    const own = this.meta();
    const s = this.filterState();
    const range = resolvePreset(s.preset, { from: s.from, to: s.to });
    const asOf = !!own?.filters?.asOf && s.asOf !== false;
    const f = {
      ...defaultFilter(asOf),
      from: range.from, to: range.to, asOf,
      branches: s.branches ?? [],
      // the generic "compare" toggle (previous period) is not a period comparison of the other reports
      compareType: 'none' as const,
    };
    const target = carryTargetFor(slug);
    return target ? carryFilterQuery(f, target, {
      applyOpeningHour: s.applyOpeningHour, comparison: s.comparison,
      productIds: s.productIds, categoryIds: s.categoryIds, sources: s.sources, voidTimings: s.voidTimings,
    }) : {};
  }

  toggleFavorite(): void {
    const m = this.meta();
    if (m) this.favs.toggle(m.slug);
  }

  async export(type: 'pdf' | 'xlsx' | 'csv'): Promise<void> {
    const meta = this.meta();
    if (!meta || this.requiredFiltersMissing()) return;
    try {
      await this.service.export(meta, type, this.toApiFilter());
    } catch (e: any) {
      this.error.set(e?.message ?? this.lang.instant('REPORTS.EXPORT.ERROR'));
    }
  }

  print(): void {
    window.print();
  }

  back(): void {
    this.router.navigate(['/reports']);
  }
}
