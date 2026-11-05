import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { AuthService } from '@core/auth/auth.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { SegmentedToggleComponent } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import type { DateRange } from '@shared/components/datepicker/date-picker.types';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { LayoutService } from '@core/layout/services/layout.service';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { Customer, CustomerNotes } from '../../models/customer.model';
import { PriceLabelService } from '@features/settings/price-label/services/price-label.service';
import { PaymentMethodService } from '@features/settings/payment-methods/services/payment-method.service';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { ReportsService } from '../../../../reports/services/reports.service';
import { SalesLookupsService } from '../../../services/sales-lookups.service';
import { CustomersService } from '../../services/customers.service';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import type { DocRailItem } from '../../../services/document-view-base';
import { DOC_RAIL_ICONS, docSortMenu } from '../../../services/doc-rail-menu';
import type { DocRailFilterOption } from '../../../components/doc-rail-filter/doc-rail-filter.component';
import { CustomerStatementComponent } from '../../components/customer-statement/customer-statement.component';

type Tab = 'overview' | 'transactions' | 'statementHistory' | 'notes';
type TxKind = 'invoices' | 'estimates' | 'creditNotes' | 'payments';

interface TxState { list: any[]; pageCount: number; count: number; page: number; limit: number; loaded: boolean }
const emptyTx = (): TxState => ({ list: [], pageCount: 0, count: 0, page: 1, limit: 15, loaded: false });

/** Same value → label list the customer form offers for the payment term. */
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
 * Customer dashboard (`/account/customers/view/:id`). Legacy `CustomerDashboardComponent`:
 * overview KPIs + aging report, transactions (invoices / estimates / credit notes /
 * payments, server-paged), statement of account, and notes. The active tab lives in
 * the URL fragment, and "include sub-customers" in the `isIncludeSubCustomers` query
 * param, exactly like legacy.
 */
@Component({
  selector: 'app-customer-dashboard',
  standalone: true,
  imports: [StatusBadgeComponent, 
    CommonModule, FormsModule, RouterLink, TranslateModule, MycurrencyPipe,
    PaginationComponent, SegmentedToggleComponent, DatePickerComponent, CustomerStatementComponent,
    DocViewShellComponent, DropdownMenuBtnComponent, SearchDropdownComponent,
  ],
  providers: [MycurrencyPipe],
  templateUrl: './customer-dashboard.component.html',
  styleUrl: './customer-dashboard.component.scss',
  // The shell must be the effective flex child of the no-padding main area (same as the document views).
  host: { style: 'display: contents' },
})
export class CustomerDashboardComponent implements OnInit, OnDestroy {
  private service = inject(CustomersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private auth = inject(AuthService);
  private modal = inject(ModalService);
  private layout = inject(LayoutService);
  private privileges = inject(PrivilegeService);
  private priceLabels = inject(PriceLabelService);
  private lookups = inject(SalesLookupsService);
  private reports = inject(ReportsService);
  private paymentMethods = inject(PaymentMethodService);
  readonly canAdd = this.privileges.check('customerSecurity.actions.add.access');
  private currency = inject(MycurrencyPipe);

  customerId = '';
  customer = signal<Customer | null>(null);
  overview = signal<any>(null);
  subCustomers = signal<any[]>([]);
  lastPayment = signal<any>(null);
  aging = signal<{ ageGroup: string; data: any[]; totalAmount: number; totalBalanceDue: number }[] | null>(null);
  /** Names behind the customer's saved price-label / currency ids (resolved like the form does). */
  priceLabelName = signal('');
  currencyName = signal('');
  customFields = signal<{ id: string; name: string; value: any }[]>([]);

  // ── record rail (Zoho-style customer list beside the open customer) ──
  readonly railPageSize = 15;
  railItems = signal<DocRailItem[]>([]);
  railLoading = signal(false);
  railPage = signal(1);
  railPageCount = signal(1);
  railTerm = signal('');
  /** Rail's customer-type filter (`null` = all); sent as `filter.type`, which the backend validates. */
  railType = signal<string | null>(null);
  /** Sort of the rail list (`column:DIRECTION`), chosen from the rail ⋯ menu's "Sort by" like the invoice rail. */
  railSort = signal('name:ASC');
  private railSeq = 0;
  private railTimer: ReturnType<typeof setTimeout> | null = null;

  tab = signal<Tab>('overview');
  includeSub = signal(false);
  tx = signal<Record<TxKind, TxState>>({ invoices: emptyTx(), estimates: emptyTx(), creditNotes: emptyTx(), payments: emptyTx() });
  /** Transaction sections currently expanded (Zoho shows them as stacked collapsible cards). */
  txOpen = signal<ReadonlySet<TxKind>>(new Set<TxKind>(['invoices']));

  // statement
  filterType = signal<'all' | 'outstanding'>('all');
  stateRange = signal<DateRange>(this.defaultRange());
  stateRows = signal<any[] | null>(null);
  stateLoading = signal(false);
  /** Statement branch filter: `null` = all branches (what the endpoint treats a missing `branchId` as). */
  branches = signal<any[]>([]);
  stateBranchId = signal<string | null>(null);
  branchItems = computed(() => [{ id: null, name: this.lang.instant('CUSTOMERS.DASHBOARD_PAGE.ALL_BRANCHES') }, ...this.branches()]);
  branchOf = () => this.branchItems().find(b => b.id === this.stateBranchId()) ?? this.branchItems()[0];
  branchLabel = (b: any) => b?.name ?? '';
  byId = (a: any, b: any) => a?.id === b?.id;
  onStateBranch(b: any): void {
    this.stateBranchId.set(b?.id ?? null);
    void this.loadStatement();
  }

  // notes
  newNote = signal('');
  noteSaving = signal(false);

  readonly tabs = [
    { value: 'overview' as Tab, label: 'CUSTOMERS.DASHBOARD_PAGE.OVERVIEW' },
    { value: 'transactions' as Tab, label: 'CUSTOMERS.DASHBOARD_PAGE.TRANSACTIONS' },
    { value: 'statementHistory' as Tab, label: 'CUSTOMERS.DASHBOARD_PAGE.STATEMENT_HISTORY' },
    { value: 'notes' as Tab, label: 'CUSTOMERS.DASHBOARD_PAGE.NOTES' },
  ];
  readonly newMenu = (): DropdownMenuBtnItem[] => [
    { label: this.lang.instant('CUSTOMERS.DASHBOARD_PAGE.NEW_INVOICE'), click: () => this.newDoc('/account/invoices/new'), disabled: false, danger: false },
    { label: this.lang.instant('CUSTOMERS.DASHBOARD_PAGE.NEW_ESTIMATE'), click: () => this.newDoc('/account/estimate/new'), disabled: false, danger: false },
  ];
  readonly txTabs = [
    { value: 'invoices' as TxKind, label: 'CUSTOMERS.DASHBOARD_PAGE.INVOICES' },
    { value: 'estimates' as TxKind, label: 'CUSTOMERS.DASHBOARD_PAGE.ESTIMATES' },
    { value: 'creditNotes' as TxKind, label: 'CUSTOMERS.DASHBOARD_PAGE.CREDIT_NOTES' },
    { value: 'payments' as TxKind, label: 'CUSTOMERS.DASHBOARD_PAGE.PAYMENTS' },
  ];
  readonly filterOptions = [
    { value: 'all', label: 'CUSTOMERS.DASHBOARD_PAGE.ALL_TRANSACTIONS' },
    { value: 'outstanding', label: 'CUSTOMERS.DASHBOARD_PAGE.OUTSTANDING_ONLY' },
  ];

  utilization = computed(() => {
    const limit = this.customer()?.creditLimit;
    const out = this.overview()?.outStandingRecivable;
    return limit && out != null ? (out / limit) * 100 : 0;
  });

  daysSinceLastPayment = computed(() => {
    const d = this.lastPayment()?.paymentDate;
    if (!d) return null;
    return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  });

  agingBuckets = computed(() => {
    const groups = this.aging() ?? [];
    const total = (g: string) => groups.find(x => x.ageGroup === g)?.totalAmount ?? 0;
    return [
      { key: 'blue', label: 'CUSTOMERS.DASHBOARD_PAGE.DAYS_1_15', total: total('1 - 15') },
      { key: 'amber', label: 'CUSTOMERS.DASHBOARD_PAGE.DAYS_16_30', total: total('16 - 30') },
      { key: 'orange', label: 'CUSTOMERS.DASHBOARD_PAGE.DAYS_31_45', total: total('31 - 45') },
      { key: 'red', label: 'CUSTOMERS.DASHBOARD_PAGE.DAYS_45_PLUS', total: total('> 45') },
    ];
  });

  async ngOnInit(): Promise<void> {
    this.layout.setNoPadding(true);
    void this.lookups.getBranches().then(b => this.branches.set(b ?? []));
    // `account/components/doc-lines-table` carries the shared DOC_VIEW strings the rail/shell use (empty state, bulk bar…).
    await Promise.all([this.lang.loadFeature('account/customers'), this.lang.loadFeature('account/components/doc-lines-table')]);
    this.includeSub.set(this.route.snapshot.queryParamMap.get('isIncludeSubCustomers') === 'true');
    void this.loadRail(1);
    this.route.paramMap.subscribe(() => void this.load());
  }

  ngOnDestroy(): void {
    this.layout.setNoPadding(false);
    if (this.railTimer) clearTimeout(this.railTimer);
  }

  private async load(): Promise<void> {
    this.customerId = this.route.snapshot.paramMap.get('id') ?? '';
    const c = await this.service.getCustomer(this.customerId);
    if (!c?.id) {
      void this.router.navigate(['/account/customers']);
      return;
    }
    // Reset everything tied to the previously opened customer.
    this.customer.set(c);
    this.overview.set(null);
    this.lastPayment.set(null);
    this.aging.set(null);
    this.subCustomers.set([]);
    this.tx.set({ invoices: emptyTx(), estimates: emptyTx(), creditNotes: emptyTx(), payments: emptyTx() });
    this.stateRows.set(null);
    this.priceLabelName.set('');
    this.currencyName.set('');
    void this.loadFinancialNames(c);

    if (c.hasChild) void this.loadSubCustomers();
    void this.loadOverviewData();

    const fragment = this.route.snapshot.fragment as Tab | null;
    this.selectTab(fragment && this.tabs.some(x => x.value === fragment) ? fragment : this.tab(), false);
  }

  private async loadFinancialNames(c: Customer): Promise<void> {
    const [pl, cur] = await Promise.all([
      c.priceLabelId ? this.priceLabels.getById(c.priceLabelId).catch(() => null) : null,
      c.currencyId ? this.paymentMethods.getById(c.currencyId).catch(() => null) : null,
    ]);
    // Ignore a late answer for a customer the user has already navigated away from.
    if (this.customer()?.id !== c.id) return;
    this.priceLabelName.set((pl as any)?.name ?? '');
    this.currencyName.set((cur as any)?.name ?? '');
  }

  termLabel(v: string | null | undefined): string { return v ? (PAYMENT_TERM_LABELS[v] ?? v) : ''; }

  // ── rail ───────────────────────────────────────────────────────────
  async loadRail(page: number): Promise<void> {
    const seq = ++this.railSeq;
    this.railLoading.set(true);
    try {
      const data = await this.service.getCustomerList({
        page, limit: this.railPageSize, searchTerm: this.railTerm(), filter: this.railType() ? { type: this.railType() } : {}, sortBy: { sortValue: this.railSort().split(':')[0], sortDirection: this.railSort().split(':')[1] },
      });
      if (seq !== this.railSeq) return;
      this.railItems.set((data?.list ?? []).map((r: any): DocRailItem => ({
        id: r.id,
        primary: r.saluation ? `${r.saluation} ${r.name}` : r.name,
        amountLabel: this.currency.transform(r.outStandingRecivable ?? 0),
        sub: r.email || r.phone || '',
        data: r,
      })));
      this.railPage.set(page);
      this.railPageCount.set(Math.max(1, data?.pageCount || 1));
    } finally {
      if (seq === this.railSeq) this.railLoading.set(false);
    }
  }

  railMoreItems(): DropdownMenuBtnItem[] {
    const t = (k: string) => this.lang.instant('CUSTOMERS.DASHBOARD_PAGE.' + k);
    const [value, direction] = this.railSort().split(':');
    return [
      docSortMenu({
        label: t('SORT_BY'),
        fields: [
          { value: 'name', label: t('SORT_FIELD_NAME') },
          { value: 'outStandingRecivable', label: t('SORT_FIELD_RECEIVABLE') },
          { value: 'phone', label: t('SORT_FIELD_PHONE') },
        ],
        current: { value, direction: direction === 'DESC' ? 'DESC' : 'ASC' },
        pick: sort => { this.railSort.set(`${sort.value}:${sort.direction}`); void this.loadRail(1); },
      }),
      { label: this.lang.instant('COMMON.REFRESH'), click: () => void this.loadRail(this.railPage()), disabled: false, danger: false, separator: true, iconPath: DOC_RAIL_ICONS.refresh, iconViewBox: DOC_RAIL_ICONS.viewBox16 },
    ];
  }

  railFilterOptions(): DocRailFilterOption[] {
    const t = (k: string) => this.lang.instant('CUSTOMERS.DASHBOARD_PAGE.' + k);
    return [
      { value: null, label: t('ALL_CUSTOMERS') },
      { value: 'Individual', label: t('INDIVIDUAL_CUSTOMERS') },
      { value: 'Business', label: t('BUSINESS_CUSTOMERS') },
    ];
  }
  onRailFilterPick(type: string | null): void {
    this.railType.set(type);
    void this.loadRail(1);
  }

  onRailSearch(term: string): void {
    if (this.railTimer) clearTimeout(this.railTimer);
    this.railTimer = setTimeout(() => { this.railTerm.set(term); void this.loadRail(1); }, 300);
  }
  railPrev(): void { if (this.railPage() > 1) void this.loadRail(this.railPage() - 1); }
  railNext(): void { if (this.railPage() < this.railPageCount()) void this.loadRail(this.railPage() + 1); }
  railGoTo(item: DocRailItem): void {
    void this.router.navigate(['/account/customers/view', item.id], { queryParamsHandling: 'preserve', fragment: this.tab() });
  }
  goToList(): void { void this.router.navigate(['/account/customers']); }
  add(): void { void this.router.navigate(['/account/customers', 'new']); }
  edit(): void { void this.router.navigate(['/account/customers', this.customerId]); }
  newDoc(path: string): void { void this.router.navigate([path], { queryParams: { customerId: this.customerId } }); }

  // ── tabs ───────────────────────────────────────────────────────────
  selectTab(t: Tab, updateUrl = true): void {
    this.tab.set(t);
    if (updateUrl) void this.router.navigate([], { fragment: t, queryParamsHandling: 'preserve', replaceUrl: true });
    if (t === 'transactions') this.txOpen().forEach(k => void this.ensureTx(k));
    if (t === 'statementHistory' && this.stateRows() === null) void this.loadStatement();
  }

  toggleTx(k: TxKind): void {
    this.txOpen.update(s => { const n = new Set(s); if (!n.delete(k)) n.add(k); return n; });
    if (this.txOpen().has(k)) void this.ensureTx(k);
  }

  // ── overview ───────────────────────────────────────────────────────
  private subParam(params: any): any {
    return this.includeSub() ? { ...params, includeSubCustomers: true } : params;
  }

  async loadOverviewData(): Promise<void> {
    const base = { customerId: this.customerId, branchId: null };
    const [overview, last, aging, defs] = await Promise.all([
      this.service.getCustomerOverView(this.subParam({ ...base, filterType: 'all' })),
      this.service.getCustomerLastPayment(this.customerId),
      this.service.getAginigReportByCustomer(this.subParam(base)),
      this.service.getCustomFieldDefinitions(),
    ]);
    this.overview.set(overview);
    this.lastPayment.set(last);
    this.aging.set(this.groupAging(aging ?? []));

    const values = this.customer()?.customFields ?? {};
    this.customFields.set(
      defs
        .map((d: any) => ({ id: d.id, name: d.name, value: (values as any)[d.id] }))
        .filter(f => f.value !== undefined && f.value !== null && f.value !== ''),
    );
  }

  private groupAging(rows: any[]) {
    const map = new Map<string, any[]>();
    for (const r of rows) {
      const g = bucket(r.age);
      map.set(g, [...(map.get(g) ?? []), r]);
    }
    const sum = (a: any[], k: string) => a.reduce((s, x) => s + (Number(x[k]) || 0), 0);
    return [...map.entries()]
      .sort(([a], [b]) => BUCKET_ORDER.indexOf(a) - BUCKET_ORDER.indexOf(b))
      .map(([ageGroup, data]) => ({ ageGroup, data, totalAmount: sum(data, 'amount'), totalBalanceDue: sum(data, 'balanceDue') }));
  }

  async loadSubCustomers(): Promise<void> {
    this.subCustomers.set((await this.service.getSubCustomerOverView(this.customerId)) ?? []);
  }

  onIncludeSub(v: boolean): void {
    this.includeSub.set(v);
    void this.router.navigate([], { queryParams: { isIncludeSubCustomers: v }, queryParamsHandling: 'merge', fragment: this.tab(), replaceUrl: true });
    this.tx.set({ invoices: emptyTx(), estimates: emptyTx(), creditNotes: emptyTx(), payments: emptyTx() });
    this.stateRows.set(null);
    void this.loadOverviewData();
    if (this.tab() === 'transactions') this.txOpen().forEach(k => void this.ensureTx(k));
    if (this.tab() === 'statementHistory') void this.loadStatement();
  }

  // ── transactions ───────────────────────────────────────────────────
  private async ensureTx(k: TxKind): Promise<void> {
    if (!this.tx()[k].loaded) await this.loadTx(k);
  }

  async loadTx(k: TxKind): Promise<void> {
    const s = this.tx()[k];
    const params = this.subParam({ page: s.page, limit: s.limit, customerId: this.customerId });
    const fn = {
      invoices: this.service.getCustomerInvoiceTransactions,
      estimates: this.service.getCustomerEstimateTransactions,
      creditNotes: this.service.getCustomerCreditNoteTransactions,
      payments: this.service.getCustomerPaymentTransactions,
    }[k];
    const res = await fn(params);
    this.tx.update(all => ({
      ...all,
      [k]: { ...all[k], list: res?.list ?? [], pageCount: res?.pageCount ?? 0, count: res?.count ?? 0, loaded: true },
    }));
  }

  setTxPage(k: TxKind, page: number): void {
    this.tx.update(all => ({ ...all, [k]: { ...all[k], page } }));
    void this.loadTx(k);
  }

  setTxLimit(k: TxKind, limit: number): void {
    this.tx.update(all => ({ ...all, [k]: { ...all[k], limit, page: 1 } }));
    void this.loadTx(k);
  }

  viewRoute(k: TxKind): string {
    return { invoices: 'invoices', estimates: 'estimate', creditNotes: 'credit-notes', payments: 'payments' }[k];
  }

  newRoute(k: TxKind): string[] | null {
    return k === 'invoices' ? ['/account/invoices/new'] : k === 'estimates' ? ['/account/estimate/new'] : null;
  }

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

  setFilterType(v: string): void {
    this.filterType.set(v as 'all' | 'outstanding');
    void this.loadStatement();
  }

  /** Print / PDF / Excel of the statement currently on screen — same params (and flat body) as legacy. */
  printStatement(): void { void this.reports.printFlat('customerstatment', this.statementParams()); }
  statementExportMenu = (): DropdownMenuBtnItem[] => [
    { label: 'PDF', click: () => void this.reports.exportFlat('customerstatment', 'pdf', this.statementParams(), 'customer-statement'), disabled: false, danger: false },
    { label: 'Excel', click: () => void this.reports.exportFlat('customerstatment', 'xlsx', this.statementParams(), 'customer-statement'), disabled: false, danger: false },
  ];

  private statementParams() {
    const r = this.stateRange();
    return this.subParam({
      customerId: this.customerId,
      from: ymd(r.start),
      to: ymd(r.end),
      branchId: this.stateBranchId(),
      filterType: this.filterType(),
    });
  }

  async loadStatement(): Promise<void> {
    this.stateLoading.set(true);
    try {
      const res = await this.service.getCustomerStatementData(this.statementParams());
      this.stateRows.set(Array.isArray(res) ? res : []);
    } finally {
      this.stateLoading.set(false);
    }
  }

  get stateFrom(): string { return ymd(this.stateRange().start) ?? ''; }
  get stateTo(): string { return ymd(this.stateRange().end) ?? ''; }

  // ── notes ──────────────────────────────────────────────────────────
  async addNote(): Promise<void> {
    const text = this.newNote().trim();
    const c = this.customer();
    if (!text || !c || this.noteSaving()) return;
    const emp = this.auth.currentEmployee as any;
    const note = new CustomerNotes();
    note.note = text;
    note.employeeId = emp?.id ?? '';
    note.employeeName = emp?.name ?? '';
    await this.persistNotes([...(c.notes ?? []), note]);
    this.newNote.set('');
  }

  async removeNote(note: CustomerNotes): Promise<void> {
    const c = this.customer();
    if (!c) return;
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: {
        title: this.lang.instant('CUSTOMERS.DASHBOARD_PAGE.DELETE_NOTE'),
        message: this.lang.instant('CUSTOMERS.DASHBOARD_PAGE.DELETE_NOTE_CONFIRM'),
        danger: true,
      },
    }).afterClosed();
    if (!ok) return;
    await this.persistNotes((c.notes ?? []).filter((n: CustomerNotes) => n !== note));
  }

  private async persistNotes(notes: CustomerNotes[]): Promise<void> {
    this.noteSaving.set(true);
    try {
      const res: any = await this.service.saveCustomerNotes(this.customerId, notes);
      const c = this.customer();
      if (c && res?.success) {
        c.notes = res.data;
        this.customer.set(Object.assign(Object.create(Object.getPrototypeOf(c)), c));
      }
    } finally {
      this.noteSaving.set(false);
    }
  }

  // ── misc ───────────────────────────────────────────────────────────
  address(c: Customer): string {
    return c.addresses?.[0]?.toString?.() ?? '';
  }

  initial(c: Customer): string {
    return (c.name || '?').charAt(0).toUpperCase();
  }
}
