import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { NgApexchartsModule } from 'ng-apexcharts';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { BranchConnectionService } from '@core/layout/services/branch.service';
import { LayoutService } from '@core/layout/services/layout.service';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { SegmentedToggleComponent } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import type { DateRange } from '@shared/components/datepicker/date-picker.types';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ReportsService } from '@features/reports/services/reports.service';

import { Supplier } from '../../models/supplier.model';
import { SuppliersService } from '../../services/suppliers.service';
import { SupplierActions } from '../../services/supplier-actions';
import { SupplierStatementComponent } from '../../components/supplier-statement/supplier-statement.component';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import type { DocRailItem } from '../../../services/document-view-base';
import { DOC_RAIL_ICONS, docSortMenu } from '../../../services/doc-rail-menu';

type Tab = 'overview' | 'transactions' | 'supplierItem' | 'statementHistory';
type TxKind = 'bills' | 'purchases' | 'credits' | 'payments';
interface TxState { list: any[]; pageCount: number; count: number; page: number; limit: number; loaded: boolean }
const emptyTx = (): TxState => ({ list: [], pageCount: 0, count: 0, page: 1, limit: 15, loaded: false });
const emptyTxs = (): Record<TxKind, TxState> => ({ bills: emptyTx(), purchases: emptyTx(), credits: emptyTx(), payments: emptyTx() });
interface BranchOpt { value: string; label: string }

/** Same value → label list the supplier form offers for the payment term. */
const PAYMENT_TERM_LABELS: Record<string, string> = {
  net7: 'Net 7', net10: 'Net 10', net15: 'Net 15', net30: 'Net 30', net60: 'Net 60', net90: 'Net 90',
  endOfTheMonth: 'End of the month', onReceiptDue: 'On Receipt Due',
};

const ymd = (d: Date | null | undefined): string | null => {
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Age buckets of the aging report — same grouping and order as legacy. */
const bucket = (age: number): string =>
  age >= 1 && age <= 15 ? '1 - 15' : age >= 16 && age <= 30 ? '16 - 30' : age >= 31 && age <= 45 ? '31 - 45' : age > 45 ? '> 45' : '< 0';
const BUCKET_ORDER = ['1 - 15', '16 - 30', '31 - 45', '> 45', '< 0'];

/**
 * Supplier dashboard (`/account/suppliers/view/:id`). Legacy `SupplierDashboardComponent`: overview (outstanding
 * payable, unused credit, last payment made, aging report), transactions (bills / purchase orders / credits /
 * payments, server-paged), the supplier's items (with export), and the statement of account (date range, filter,
 * export to PDF / Excel). The active tab lives in the URL fragment and the branch filter applies to the aging
 * report and the statement, like legacy.
 */
@Component({
  selector: 'app-supplier-dashboard',
  standalone: true,
  imports: [StatusBadgeComponent, 
    CommonModule, RouterLink, TranslateModule, MycurrencyPipe, PaginationComponent,
    NgApexchartsModule, SegmentedToggleComponent, DatePickerComponent, DropdownMenuBtnComponent, SearchDropdownComponent, SupplierStatementComponent,
    DocViewShellComponent,
  ],
  providers: [MycurrencyPipe],
  templateUrl: './supplier-dashboard.component.html',
  styleUrl: './supplier-dashboard.component.scss',
  // The shell must be the effective flex child of the no-padding main area (same as the document views).
  host: { style: 'display: contents' },
})
export class SupplierDashboardComponent implements OnInit, OnDestroy {
  private service = inject(SuppliersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);
  private branchSvc = inject(BranchConnectionService);
  private reports = inject(ReportsService);
  private layout = inject(LayoutService);
  private currency = inject(MycurrencyPipe);
  readonly actions = inject(SupplierActions);

  supplierId = '';
  supplier = signal<Supplier | null>(null);
  overview = signal<any>(null);
  lastPayment = signal<any>(null);
  aging = signal<{ ageGroup: string; data: any[]; totalAmount: number; totalBalanceDue: number }[] | null>(null);

  // ── record rail (Zoho-style supplier list beside the open supplier) ──
  readonly railPageSize = 15;
  railItems = signal<DocRailItem[]>([]);
  railLoading = signal(false);
  railPage = signal(1);
  railPageCount = signal(1);
  railTerm = signal('');
  private railSeq = 0;
  /** Sort of the rail list (`column:DIRECTION`), chosen from the rail ⋯ menu's "Sort by" like the invoice rail. */
  railSort = signal('name:ASC');
  railMoreItems(): DropdownMenuBtnItem[] {
    const t = (k: string) => this.lang.instant('SUPPLIERS.DASHBOARD_PAGE.' + k);
    const [value, direction] = this.railSort().split(':');
    return [
      docSortMenu({
        label: t('SORT_BY'),
        fields: [
          { value: 'name', label: t('SORT_FIELD_NAME') },
          { value: 'outStandingPayable', label: t('SORT_FIELD_PAYABLE') },
          { value: 'createdAt', label: t('SORT_FIELD_CREATED') },
        ],
        current: { value, direction: direction === 'DESC' ? 'DESC' : 'ASC' },
        pick: sort => { this.railSort.set(`${sort.value}:${sort.direction}`); void this.loadRail(1); },
      }),
      { label: this.lang.instant('COMMON.REFRESH'), click: () => void this.loadRail(this.railPage()), disabled: false, danger: false, separator: true, iconPath: DOC_RAIL_ICONS.refresh, iconViewBox: DOC_RAIL_ICONS.viewBox16 },
    ];
  }
  private railTimer: ReturnType<typeof setTimeout> | null = null;

  // ── income chart (bills raised per month, like the legacy "Income" card) ──
  readonly incomeRanges = [
    { value: '6', label: 'SUPPLIERS.DASHBOARD_PAGE.LAST_SIX_MONTHS' },
    { value: '12', label: 'SUPPLIERS.DASHBOARD_PAGE.LAST_TWELVE_MONTHS' },
    { value: 'lastYear', label: 'SUPPLIERS.DASHBOARD_PAGE.LAST_YEAR' },
  ];
  incomeRange = signal(this.incomeRanges[0]);
  incomeLabel = (o: { label: string }) => this.lang.instant(o?.label ?? '');
  sameRange = (a: { value: string }, b: { value: string }) => a?.value === b?.value;
  incomeMonths = signal<string[]>([]);
  incomeAmounts = signal<number[]>([]);
  incomeSeries = computed(() => [{ name: this.lang.instant('SUPPLIERS.DASHBOARD_PAGE.INCOME_AMOUNT'), data: this.incomeAmounts() }]);
  incomeXaxis = computed(() => ({ categories: this.incomeMonths() }));
  readonly incomeChart: any = { type: 'area', height: 240, toolbar: { show: false }, fontFamily: 'inherit' };
  readonly incomeStroke: any = { curve: 'smooth', width: 2 };
  readonly incomeFill: any = { type: 'solid', opacity: 0.15 };
  readonly incomeLabels: any = { enabled: false };
  readonly incomeColors = ['#f1b44c'];

  tab = signal<Tab>('overview');
  branchId = signal<string>('all');

  tx = signal<Record<TxKind, TxState>>(emptyTxs());
  /** Transaction sections currently expanded (Zoho shows them as stacked collapsible cards). */
  txOpen = signal<ReadonlySet<TxKind>>(new Set<TxKind>(['bills']));

  items = signal<TxState & { list: any[] }>(emptyTx());
  itemSort = signal<{ sortValue?: string; sortDirection?: string }>({});
  itemTerm = signal('');
  /** Product-type filter (`null` = all); sent as `filter.type`. */
  itemType = signal<string | null>(null);
  private itemTimer: ReturnType<typeof setTimeout> | null = null;
  readonly itemTypeOptions = [
    { value: null, label: 'SUPPLIERS.DASHBOARD_PAGE.ITEM_TYPE_ALL' },
    { value: 'inventory', label: 'SUPPLIERS.DASHBOARD_PAGE.ITEM_TYPE_INVENTORY' },
    { value: 'batch', label: 'SUPPLIERS.DASHBOARD_PAGE.ITEM_TYPE_BATCH' },
    { value: 'serialized', label: 'SUPPLIERS.DASHBOARD_PAGE.ITEM_TYPE_SERIALIZED' },
  ];
  itemTypeLabel = (o: { label: string }) => this.lang.instant(o?.label ?? '');
  /** Translated product type of a row (falls back to the raw value for a type the filter doesn't list). */
  itemTypeName = (type: string | null | undefined): string => {
    const o = this.itemTypeOptions.find(x => x.value === type);
    return o ? this.lang.instant(o.label) : (type ?? '');
  };
  itemTypeOf = () => this.itemTypeOptions.find(o => o.value === this.itemType()) ?? this.itemTypeOptions[0];
  sameValue = (a: { value: string | null }, b: { value: string | null }) => a?.value === b?.value;

  filterType = signal<'all' | 'outstanding'>('all');
  stateRange = signal<DateRange>(this.defaultRange());
  stateRows = signal<any[] | null>(null);
  stateLoading = signal(false);

  readonly tabs = [
    { value: 'overview' as Tab, label: 'SUPPLIERS.DASHBOARD_PAGE.OVERVIEW' },
    { value: 'transactions' as Tab, label: 'SUPPLIERS.DASHBOARD_PAGE.TRANSACTIONS' },
    { value: 'supplierItem' as Tab, label: 'SUPPLIERS.DASHBOARD_PAGE.SUPPLIER_ITEMS' },
    { value: 'statementHistory' as Tab, label: 'SUPPLIERS.DASHBOARD_PAGE.STATEMENT_HISTORY' },
  ];
  readonly txTabs = [
    { value: 'bills' as TxKind, label: 'SUPPLIERS.DASHBOARD_PAGE.BILLS' },
    { value: 'purchases' as TxKind, label: 'SUPPLIERS.DASHBOARD_PAGE.PURCHASES' },
    { value: 'credits' as TxKind, label: 'SUPPLIERS.DASHBOARD_PAGE.CREDITS' },
    { value: 'payments' as TxKind, label: 'SUPPLIERS.DASHBOARD_PAGE.PAYMENTS' },
  ];
  readonly filterOptions = [
    { value: 'all', label: 'SUPPLIERS.DASHBOARD_PAGE.ALL_TRANSACTIONS' },
    { value: 'outstanding', label: 'SUPPLIERS.DASHBOARD_PAGE.OUTSTANDING_ONLY' },
  ];

  // Creating documents for this supplier needs each document's own add privilege (legacy shows all four buttons).
  readonly canNewBill = this.privileges.check('billingSecurity.actions.add.access');
  readonly canNewPayment = this.privileges.check('billingPaymentsSecurity.actions.add.access');
  readonly canNewCredit = this.privileges.check('supplierCredit.actions.add.access');
  readonly canNewPurchase = this.privileges.check('purchaseOrderSecurity.actions.add.access');

  branches = computed<BranchOpt[]>(() => [
    { value: 'all', label: this.lang.instant('SUPPLIERS.DASHBOARD_PAGE.ALL_BRANCHES') },
    ...this.branchSvc.branches().map(b => ({ value: b.id, label: b.name })),
  ]);
  branchOpt = computed(() => this.branches().find(b => b.value === this.branchId()) ?? this.branches()[0]);

  daysSinceLastPayment = computed(() => {
    const d = this.lastPayment()?.paymentDate;
    return d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null;
  });

  agingBuckets = computed(() => {
    const groups = this.aging() ?? [];
    const total = (g: string) => groups.find(x => x.ageGroup === g)?.totalAmount ?? 0;
    return [
      { key: 'blue', label: 'SUPPLIERS.DASHBOARD_PAGE.DAYS_1_15', total: total('1 - 15') },
      { key: 'amber', label: 'SUPPLIERS.DASHBOARD_PAGE.DAYS_16_30', total: total('16 - 30') },
      { key: 'orange', label: 'SUPPLIERS.DASHBOARD_PAGE.DAYS_31_45', total: total('31 - 45') },
      { key: 'red', label: 'SUPPLIERS.DASHBOARD_PAGE.DAYS_45_PLUS', total: total('> 45') },
    ];
  });

  async ngOnInit(): Promise<void> {
    this.layout.setNoPadding(true);
    // `account/components/doc-lines-table` carries the shared DOC_VIEW strings the rail/shell use (empty state, bulk bar…).
    await Promise.all([this.lang.loadFeature('account/suppliers'), this.lang.loadFeature('account/components/doc-lines-table'), this.branchSvc.load().catch(() => {})]);
    void this.loadRail(1);
    this.route.paramMap.subscribe(() => void this.load());
  }

  ngOnDestroy(): void {
    this.layout.setNoPadding(false);
    if (this.railTimer) clearTimeout(this.railTimer);
    if (this.itemTimer) clearTimeout(this.itemTimer);
  }

  private async load(): Promise<void> {
    this.supplierId = this.route.snapshot.paramMap.get('id') ?? '';
    const s = await this.service.getSupplier(this.supplierId);
    if (!s?.id) { void this.router.navigate(['/account/suppliers']); return; }
    // Reset everything tied to the previously opened supplier.
    this.supplier.set(s);
    this.overview.set(null);
    this.lastPayment.set(null);
    this.aging.set(null);
    this.tx.set(emptyTxs());
    this.items.set(emptyTx());
    this.itemTerm.set('');
    this.itemType.set(null);
    this.stateRows.set(null);

    const fragment = this.route.snapshot.fragment as Tab | null;
    this.selectTab(fragment && this.tabs.some(x => x.value === fragment) ? fragment : this.tab(), false);
  }

  // ── rail ───────────────────────────────────────────────────────────
  async loadRail(page: number): Promise<void> {
    const seq = ++this.railSeq;
    this.railLoading.set(true);
    try {
      const data = await this.service.getSuppliersList({
        page, limit: this.railPageSize, searchTerm: this.railTerm(), sortBy: { sortValue: this.railSort().split(':')[0], sortDirection: this.railSort().split(':')[1] },
      });
      if (seq !== this.railSeq) return;
      this.railItems.set((data?.list ?? []).map((r: any): DocRailItem => ({
        id: r.id,
        primary: r.name,
        amountLabel: this.currency.transform(r.outStandingPayable ?? 0),
        sub: r.email || r.phone || r.code || '',
        data: r,
      })));
      this.railPage.set(page);
      this.railPageCount.set(Math.max(1, data?.pageCount || 1));
    } finally {
      if (seq === this.railSeq) this.railLoading.set(false);
    }
  }

  onRailSearch(term: string): void {
    if (this.railTimer) clearTimeout(this.railTimer);
    this.railTimer = setTimeout(() => { this.railTerm.set(term); void this.loadRail(1); }, 300);
  }
  railPrev(): void { if (this.railPage() > 1) void this.loadRail(this.railPage() - 1); }
  railNext(): void { if (this.railPage() < this.railPageCount()) void this.loadRail(this.railPage() + 1); }
  railGoTo(item: DocRailItem): void {
    void this.router.navigate(['/account/suppliers/view', item.id], { queryParamsHandling: 'preserve', fragment: this.tab() });
  }
  goToList(): void { void this.router.navigate(['/account/suppliers']); }
  add(): void { void this.router.navigate(['/account/suppliers', 'new']); }
  edit(): void { void this.router.navigate(['/account/suppliers', this.supplierId]); }

  /** "New Transaction" menu: each document needs its own add privilege (legacy shows all four). */
  newMenu = (): DropdownMenuBtnItem[] => {
    const t = (k: string) => this.lang.instant('SUPPLIERS.DASHBOARD_PAGE.' + k);
    const item = (key: string, path: string): DropdownMenuBtnItem =>
      ({ label: t(key), click: () => void this.router.navigate([path, 'new'], { queryParams: { supplierId: this.supplierId } }), disabled: false, danger: false });
    const items: DropdownMenuBtnItem[] = [];
    if (this.canNewBill) items.push(item('NEW_BILL', '/account/bills'));
    if (this.canNewPurchase) items.push(item('NEW_PURCHASE', '/account/purchase-order'));
    if (this.canNewCredit) items.push(item('NEW_CREDIT', '/account/supplier-credit'));
    if (this.canNewPayment) items.push(item('NEW_PAYMENT', '/account/bills-payment'));
    return items;
  };

  // ── tabs ───────────────────────────────────────────────────────────
  selectTab(t: Tab, updateUrl = true): void {
    this.tab.set(t);
    if (updateUrl) void this.router.navigate([], { fragment: t, queryParamsHandling: 'preserve', replaceUrl: true });
    if (t === 'overview' && !this.overview()) void this.loadOverview();
    if (t === 'transactions') this.txOpen().forEach(k => void this.ensureTx(k));
    if (t === 'supplierItem' && !this.items().loaded) void this.loadItems();
    if (t === 'statementHistory' && this.stateRows() === null) void this.loadStatement();
  }

  // ── branch filter (aging report + statement) ───────────────────────
  onBranch(b: BranchOpt | null): void {
    this.branchId.set(b?.value ?? 'all');
    void this.loadAging();
    if (this.tab() === 'statementHistory') void this.loadStatement();
    else this.stateRows.set(null);
  }
  private branchParam = () => (this.branchId() === 'all' ? null : this.branchId());

  // ── overview ───────────────────────────────────────────────────────
  async loadOverview(): Promise<void> {
    const [overview, last] = await Promise.all([
      this.fetchOverview(),
      this.service.getLastPaymentMadeToSupplier(this.supplierId),
    ]);
    this.overview.set(overview ?? {});
    this.setIncome(overview?.summary);
    this.lastPayment.set(last);
    await this.loadAging();
  }

  /** Overview figures + the bills summary of the selected chart period (legacy: last 6 / 12 months / last calendar year). */
  private fetchOverview(): Promise<any> {
    const now = new Date();
    const r = this.incomeRange().value;
    const from = r === 'lastYear' ? new Date(now.getFullYear() - 1, 0, 1) : new Date(now.getFullYear(), now.getMonth() - Number(r), now.getDate());
    const to = r === 'lastYear' ? new Date(now.getFullYear() - 1, 11, 31) : now;
    return this.service.getSupplierOverView({ supplierId: this.supplierId, interval: { from: ymd(from), to: ymd(to) } });
  }

  async onIncomeRange(o: { value: string; label: string } | null): Promise<void> {
    if (!o) return;
    this.incomeRange.set(o);
    const res = await this.fetchOverview();
    this.setIncome(res?.summary);
  }

  /** Groups the per-day totals by month, oldest first. */
  private setIncome(summary: any[] | undefined): void {
    const byMonth = new Map<string, number>();
    for (const row of summary ?? []) {
      const d = new Date(row.createdAt);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + (Number(row.total) || 0));
    }
    const keys = [...byMonth.keys()].sort();
    this.incomeMonths.set(keys.map(k => new Date(Number(k.slice(0, 4)), Number(k.slice(5)) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })));
    this.incomeAmounts.set(keys.map(k => Number(byMonth.get(k)!.toFixed(3))));
  }

  async loadAging(): Promise<void> {
    const rows = (await this.service.getAginigReportBySupplier({ branchId: this.branchParam(), supplierId: this.supplierId })) ?? [];
    const map = new Map<string, any[]>();
    for (const r of rows) map.set(bucket(r.age), [...(map.get(bucket(r.age)) ?? []), r]);
    const sum = (a: any[], k: string) => a.reduce((s, x) => s + (Number(x[k]) || 0), 0);
    this.aging.set([...map.entries()]
      .sort(([a], [b]) => BUCKET_ORDER.indexOf(a) - BUCKET_ORDER.indexOf(b))
      .map(([ageGroup, data]) => ({ ageGroup, data, totalAmount: sum(data, 'amount'), totalBalanceDue: sum(data, 'balanceDue') })));
  }

  // ── transactions ───────────────────────────────────────────────────
  toggleTx(k: TxKind): void {
    this.txOpen.update(s => { const n = new Set(s); if (!n.delete(k)) n.add(k); return n; });
    if (this.txOpen().has(k)) void this.ensureTx(k);
  }
  private async ensureTx(k: TxKind): Promise<void> { if (!this.tx()[k].loaded) await this.loadTx(k); }

  async loadTx(k: TxKind): Promise<void> {
    const s = this.tx()[k];
    const params = { page: s.page, limit: s.limit, supplierId: this.supplierId };
    const res = await {
      bills: () => this.service.getSupplierBillingsTransactions(params),
      purchases: () => this.service.getSupplierPurchaseTransactions(params),
      credits: () => this.service.getSupplierCreditsTransactions(params),
      payments: () => this.service.getSupplierPaymentsTransactions(params),
    }[k]();
    this.tx.update(m => ({ ...m, [k]: { ...s, list: res?.list ?? [], pageCount: res?.pageCount ?? 0, count: res?.count ?? 0, loaded: true } }));
  }
  setTxPage(k: TxKind, page: number): void { this.tx.update(m => ({ ...m, [k]: { ...m[k], page } })); void this.loadTx(k); }
  setTxLimit(k: TxKind, limit: number): void { this.tx.update(m => ({ ...m, [k]: { ...m[k], limit, page: 1 } })); void this.loadTx(k); }

  // ── supplier items ─────────────────────────────────────────────────
  async loadItems(): Promise<void> {
    const s = this.items();
    const res = await this.service.getSupplierItems({ page: s.page, limit: s.limit, supplierId: this.supplierId, sortBy: this.itemSort(),
      searchTerm: this.itemTerm(), filter: this.itemType() ? { type: this.itemType() } : {},
    });
    this.items.set({ ...s, list: res?.list ?? [], pageCount: res?.pageCount ?? 0, count: res?.count ?? 0, loaded: true });
  }
  onItemSearch(term: string): void {
    if (this.itemTimer) clearTimeout(this.itemTimer);
    this.itemTimer = setTimeout(() => { this.itemTerm.set(term.trim()); this.items.update(s => ({ ...s, page: 1 })); void this.loadItems(); }, 300);
  }
  onItemType(o: { value: string | null } | null): void {
    this.itemType.set(o?.value ?? null);
    this.items.update(s => ({ ...s, page: 1 }));
    void this.loadItems();
  }
  setItemsPage(page: number): void { this.items.update(s => ({ ...s, page })); void this.loadItems(); }
  setItemsLimit(limit: number): void { this.items.update(s => ({ ...s, limit, page: 1 })); void this.loadItems(); }
  sortItems(col: string): void {
    const cur = this.itemSort();
    this.itemSort.set(cur.sortValue !== col || !cur.sortDirection ? { sortValue: col, sortDirection: 'asc' } : cur.sortDirection === 'asc' ? { sortValue: col, sortDirection: 'desc' } : {});
    this.items.update(s => ({ ...s, page: 1 }));
    void this.loadItems();
  }
  arrow(col: string): string { const s = this.itemSort(); return s.sortValue === col ? (s.sortDirection === 'asc' ? ' ↑' : ' ↓') : ''; }

  itemsExportMenu = (): DropdownMenuBtnItem[] => [
    { label: 'CSV', click: () => void this.reports.exportPath('getsupplieritems', 'csv', { supplierId: this.supplierId }, 'supplier-items'), disabled: false, danger: false },
    { label: 'XLSX', click: () => void this.reports.exportPath('getsupplieritems', 'xlsx', { supplierId: this.supplierId }, 'supplier-items'), disabled: false, danger: false },
  ];

  // ── statement ──────────────────────────────────────────────────────
  private defaultRange(): DateRange {
    const now = new Date();
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }

  onRangeChange(r: Date | DateRange | null): void {
    if (r && 'start' in r) {
      this.stateRange.set(r);
      if (r.start && r.end) void this.loadStatement();
    }
  }
  setFilterType(v: string): void { this.filterType.set(v as 'all' | 'outstanding'); void this.loadStatement(); }

  private statementParams() {
    const r = this.stateRange();
    return {
      supplierId: this.supplierId,
      from: ymd(r.start),
      to: ymd(r.end),
      branchId: this.branchParam(),
      filterType: this.filterType() === 'all' ? null : this.filterType(),
    };
  }

  async loadStatement(): Promise<void> {
    this.stateLoading.set(true);
    try {
      const res = await this.service.getSupplierStatementData(this.statementParams());
      this.stateRows.set(Array.isArray(res) ? res : []);
    } finally {
      this.stateLoading.set(false);
    }
  }

  get stateFrom(): string { return ymd(this.stateRange().start) ?? ''; }
  get stateTo(): string { return ymd(this.stateRange().end) ?? ''; }

  // The statement endpoints read their params from the top level of the body (not under `filter`), like legacy.
  printStatement(): void { void this.reports.printFlat('supplierstatment', this.statementParams()); }
  statementExportMenu = (): DropdownMenuBtnItem[] => [
    { label: 'PDF', click: () => void this.reports.exportFlat('supplierstatment', 'pdf', this.statementParams(), 'supplier-statement'), disabled: false, danger: false },
    { label: 'Excel', click: () => void this.reports.exportFlat('supplierstatment', 'xlsx', this.statementParams(), 'supplier-statement'), disabled: false, danger: false },
  ];

  branchLabel = (b: BranchOpt) => b?.label ?? '';
  sameOpt = (a: BranchOpt, b: BranchOpt) => a?.value === b?.value;

  termLabel(v: string | null | undefined): string { return v ? (PAYMENT_TERM_LABELS[v] ?? v) : ''; }

  initial(s: Supplier): string { return (s.name || '?').trim().charAt(0).toUpperCase(); }
}
