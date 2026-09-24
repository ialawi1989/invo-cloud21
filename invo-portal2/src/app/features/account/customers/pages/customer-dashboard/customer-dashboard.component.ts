import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { AuthService } from '@core/auth/auth.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { SegmentedToggleComponent } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import type { DateRange } from '@shared/components/datepicker/date-picker.types';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { Customer, CustomerNotes } from '../../models/customer.model';
import { CustomersService } from '../../services/customers.service';
import { CustomerStatementComponent } from '../../components/customer-statement/customer-statement.component';

type Tab = 'overview' | 'transactions' | 'statementHistory' | 'notes';
type TxKind = 'invoices' | 'estimates' | 'creditNotes' | 'payments';

interface TxState { list: any[]; pageCount: number; count: number; page: number; limit: number; loaded: boolean }
const emptyTx = (): TxState => ({ list: [], pageCount: 0, count: 0, page: 1, limit: 15, loaded: false });

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
  imports: [
    CommonModule, FormsModule, RouterLink, TranslateModule, MycurrencyPipe, BreadcrumbsComponent,
    PaginationComponent, SegmentedToggleComponent, DatePickerComponent, CustomerStatementComponent,
  ],
  templateUrl: './customer-dashboard.component.html',
  styleUrl: './customer-dashboard.component.scss',
})
export class CustomerDashboardComponent implements OnInit {
  private service = inject(CustomersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private auth = inject(AuthService);
  private modal = inject(ModalService);

  customerId = '';
  customer = signal<Customer | null>(null);
  overview = signal<any>(null);
  subCustomers = signal<any[]>([]);
  lastPayment = signal<any>(null);
  aging = signal<{ ageGroup: string; data: any[]; totalAmount: number; totalBalanceDue: number }[] | null>(null);
  customFields = signal<{ id: string; name: string; value: any }[]>([]);
  breadcrumbs: BreadcrumbItem[] = [];

  tab = signal<Tab>('overview');
  includeSub = signal(false);
  txKind = signal<TxKind>('invoices');
  tx = signal<Record<TxKind, TxState>>({ invoices: emptyTx(), estimates: emptyTx(), creditNotes: emptyTx(), payments: emptyTx() });

  // statement
  filterType = signal<'all' | 'outstanding'>('all');
  stateRange = signal<DateRange>(this.defaultRange());
  stateRows = signal<any[] | null>(null);
  stateLoading = signal(false);

  // notes
  newNote = signal('');
  noteSaving = signal(false);

  readonly tabs = [
    { value: 'overview' as Tab, label: 'CUSTOMERS.DASHBOARD_PAGE.OVERVIEW' },
    { value: 'transactions' as Tab, label: 'CUSTOMERS.DASHBOARD_PAGE.TRANSACTIONS' },
    { value: 'statementHistory' as Tab, label: 'CUSTOMERS.DASHBOARD_PAGE.STATEMENT_HISTORY' },
    { value: 'notes' as Tab, label: 'CUSTOMERS.DASHBOARD_PAGE.NOTES' },
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
    await this.lang.loadFeature('account/customers');
    this.customerId = this.route.snapshot.paramMap.get('id') ?? '';
    this.includeSub.set(this.route.snapshot.queryParamMap.get('isIncludeSubCustomers') === 'true');

    const c = await this.service.getCustomer(this.customerId);
    if (!c?.id) {
      void this.router.navigate(['/account/customers']);
      return;
    }
    this.customer.set(c);
    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs = [
      { label: t('CUSTOMERS.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('CUSTOMERS.TEXT'), routerLink: '/account/customers' },
      { label: t('CUSTOMERS.DASHBOARD_PAGE.VIEW_CUSTOMER') },
    ];

    if (c.hasChild) void this.loadSubCustomers();
    void this.loadOverviewData();

    const fragment = this.route.snapshot.fragment as Tab | null;
    this.selectTab(fragment && this.tabs.some(x => x.value === fragment) ? fragment : 'overview', false);
  }

  // ── tabs ───────────────────────────────────────────────────────────
  selectTab(t: Tab, updateUrl = true): void {
    this.tab.set(t);
    if (updateUrl) void this.router.navigate([], { fragment: t, queryParamsHandling: 'preserve', replaceUrl: true });
    if (t === 'transactions') void this.ensureTx(this.txKind());
    if (t === 'statementHistory' && this.stateRows() === null) void this.loadStatement();
  }

  selectTx(k: TxKind): void {
    this.txKind.set(k);
    void this.ensureTx(k);
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
    if (this.tab() === 'transactions') void this.ensureTx(this.txKind());
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

  private statementParams() {
    const r = this.stateRange();
    return this.subParam({
      customerId: this.customerId,
      from: ymd(r.start),
      to: ymd(r.end),
      branchId: null,
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
