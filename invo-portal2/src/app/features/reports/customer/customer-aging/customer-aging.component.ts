import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { ParamDef, QueryParamsService, enumCodec, intCodec } from '@shared/services/query-params.service';
import { journalLink } from '../../../settings/chart-of-accounts/utils/journal-links';
import { BoTableShellComponent } from '../../business-overview/components/bo-table-shell/bo-table-shell.component';
import { PAGING_PARAMS, pickPageSize } from '../../business-overview/shared/paging-params';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportApiFilter } from '../../models/report.model';
import { AgingDetailData, AgingEntity, AgingInvoice, AgingSummaryData, CustomerAgingService } from './customer-aging.service';

const toNum = (v: unknown): number => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : 0; };
type Unit = 'days' | 'weeks' | 'months';

/** The buckets as URL params (the legacy names) so a refresh or a shared link keeps them. */
const AGING_PARAMS = {
  range: { key: 'range', codec: intCodec(3) } as ParamDef<number>,
  rangeOf: { key: 'rangeOf', codec: intCodec(15) } as ParamDef<number>,
  rangeUnit: { key: 'rangeUnit', codec: enumCodec(['days', 'weeks', 'months'] as const, 'days') } as ParamDef<Unit>,
};

/**
 * Customer Aging (invoices grouped by how overdue, with each bucket's totals) and Customer Aging Summary (a row per customer, a
 * column per bucket). The buckets are set here — how many, how long, in what unit — and kept in the URL (`range`, `rangeOf`,
 * `rangeUnit`, the legacy names).
 */
@Component({
  selector: 'app-customer-aging',
  standalone: true,
  imports: [
    ReportErrorComponent, ReportEmptyComponent, TranslateModule, DatePipe, RouterLink, MycurrencyPipe, PaginationComponent,
    SegmentedToggleComponent, StatusBadgeComponent, BoTableShellComponent,
  ],
  templateUrl: './customer-aging.component.html',
  styleUrl: './customer-aging.component.scss',
})
export class CustomerAgingComponent {
  private svc = inject(CustomerAgingService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);

  /** `detail` = the invoices by bucket; `summary` = a row per customer. */
  mode = input.required<'detail' | 'summary'>();
  /** Customers (invoices) or suppliers (bills): the same report on the other side of the books. */
  entity = input<AgingEntity>('customer');
  isSupplier = computed(() => this.entity() === 'supplier');
  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly sizes = [10, 25, 50, 100];
  readonly num = toNum;
  loading = signal(false);
  error = signal<string | null>(null);
  detail = signal<AgingDetailData | null>(null);
  summary = signal<AgingSummaryData | null>(null);
  page = signal(1);
  pageSize = signal(50);

  // ── the buckets ──
  intervals = signal(3);
  size = signal(15);
  unit = signal<Unit>('days');
  readonly unitOptions: SegmentedToggleOption<Unit>[] = [
    { value: 'days', label: 'REPORTS.CUSTOMER_AGING.DAYS' }, { value: 'weeks', label: 'REPORTS.CUSTOMER_AGING.WEEKS' },
    { value: 'months', label: 'REPORTS.CUSTOMER_AGING.MONTHS' },
  ];

  /** The request: the page's filter plus the buckets. */
  private request = computed<ReportApiFilter>(() => ({ ...this.filter(), range: this.intervals(), rangeOf: this.size(), rangeUnit: this.unit() }));

  buckets = computed(() => (this.detail()?.buckets ?? []).filter(b => b.agingGroups.length > 0));
  bucketTotal(b: { agingGroups: AgingInvoice[] }, key: 'Amount' | 'BalanceDue'): number { return b.agingGroups.reduce((s, r) => s + toNum(r[key]), 0); }
  invoiceLink = (r: AgingInvoice) => journalLink(this.isSupplier() ? 'Billing' : 'Invoice', r.id);

  // summary
  customers = computed(() => this.summary()?.customers ?? []);
  ranges = computed(() => this.summary()?.ranges ?? []);
  cell(c: { agingGroups: { label: string; total: number | string }[] }, label: string): number { return toNum(c.agingGroups?.find(g => g.label === label)?.total); }
  rowTotal(c: { agingGroups: { total: number | string }[] }): number { return (c.agingGroups ?? []).reduce((s, g) => s + toNum(g.total), 0); }
  columnTotal(label: string): number { return this.customers().reduce((s, c) => s + this.cell(c, label), 0); }
  grandTotal = computed(() => this.customers().reduce((s, c) => s + this.rowTotal(c), 0));

  isEmpty = computed(() => this.mode() === 'detail' ? !!this.detail() && this.buckets().length === 0 : !!this.summary() && this.customers().length === 0);
  /** A customer's own aging report (the summary links each name to it). */
  customerParams(c: { customerId: string | null }): Record<string, string | null> {
    const f = this.filter();
    return { preset: 'custom', fromDate: String(f.toDate ?? ''), toDate: String(f.toDate ?? ''), [this.isSupplier() ? 'suppliers' : 'customers']: c.customerId ?? null, branches: f.branches?.length ? f.branches.join(',') : null,
      range: String(this.intervals()), rangeOf: String(this.size()), rangeUnit: this.unit() };
  }

  private seq = 0;
  private prevKey = '';

  constructor() {
    const u = this.urlState.read(PAGING_PARAMS);
    this.page.set(u.page);
    this.pageSize.set(pickPageSize(u.limit, this.sizes));
    const a = this.urlState.read(AGING_PARAMS);
    this.intervals.set(Math.min(12, Math.max(1, a.range)));
    this.size.set(Math.min(365, Math.max(1, a.rangeOf)));
    this.unit.set(a.rangeUnit);
    effect(() => {
      const key = this.mode() + JSON.stringify(this.request());
      this.refresh();
      untracked(() => {
        if (this.prevKey && this.prevKey !== key) { this.page.set(1); this.persist(); }
        this.prevKey = key;
        void this.load();
      });
    });
  }

  async load(): Promise<void> {
    const mine = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      if (this.mode() === 'detail') {
        const d = await this.svc.detail(this.request(), this.page(), this.pageSize(), this.entity());
        if (mine === this.seq) this.detail.set(d);
      } else {
        const d = await this.svc.summary(this.request(), this.entity());
        if (mine === this.seq) this.summary.set(d);
      }
    } catch (e: any) {
      if (mine !== this.seq) return;
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.detail.set(null); this.summary.set(null);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  setIntervals(v: string | number): void { this.intervals.set(Math.min(12, Math.max(1, Math.floor(Number(v)) || 1))); this.syncUrl(); }
  setSize(v: string | number): void { this.size.set(Math.min(365, Math.max(1, Math.floor(Number(v)) || 1))); this.syncUrl(); }
  setUnit(u: Unit): void { this.unit.set(u); this.syncUrl(); }
  private syncUrl(): void {
    this.urlState.write(AGING_PARAMS, { range: this.intervals(), rangeOf: this.size(), rangeUnit: this.unit() });
  }

  private persist(): void {
    this.urlState.write(PAGING_PARAMS, { page: this.page(), limit: this.pageSize(), sortBy: '', sortDirection: 'asc' });
  }
  goTo(p: number): void { this.page.set(p); this.persist(); void this.load(); }
  setPageSize(n: number): void { this.pageSize.set(n); this.page.set(1); this.persist(); void this.load(); }
}
