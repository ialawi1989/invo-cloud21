import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { QueryParamsService } from '@shared/services/query-params.service';
import { journalLink } from '../../../settings/chart-of-accounts/utils/journal-links';
import { BoTableShellComponent } from '../../business-overview/components/bo-table-shell/bo-table-shell.component';
import { PAGING_PARAMS, pickPageSize, pickSort } from '../../business-overview/shared/paging-params';
import { ReportApiFilter } from '../../models/report.model';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';
import {
  ListSort, VoidedItemRecord, VoidedSalesData, VoidedSalesRecord, VoidedSalesService, VoidedSalesTotal,
} from './voided-sales.service';

const SORTABLE = ['invoiceNumber', 'invoiceDate', 'voidDate', 'customerName', 'itemsCount', 'voidedQty', 'saleAmount',
  'voidAmount', 'employeeName'] as const;

const toNum = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

interface ItemRow { item: VoidedItemRecord; depth: number; }
interface RowDetails { loading: boolean; error: string | null; rows: ItemRow[]; total: Omit<VoidedSalesTotal, 'voidedInvoices'> | null; }

/**
 * Voided Sales — invoices voided in the period (by the VOID date): one row per invoice per business day, with the
 * void timing, and a row expands to the invoice's details and its voided items (sub-items under their parent).
 * Paged and sorted by the backend; page, page size and sort live in the URL.
 */
@Component({
  selector: 'app-voided-sales',
  standalone: true,
  imports: [ReportEmptyComponent, ReportErrorComponent, TranslateModule, DatePipe, RouterLink, MycurrencyPipe, PaginationComponent, BoTableShellComponent],
  templateUrl: './voided-sales.component.html',
  styleUrl: './voided-sales.component.scss',
})
export class VoidedSalesComponent {
  private svc = inject(VoidedSalesService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly sizes = [10, 25, 50, 100];
  readonly num = toNum;

  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<VoidedSalesData | null>(null);
  page = signal(1);
  pageSize = signal(25);
  sort = signal<ListSort | null>(null);

  /** Expanded rows (invoice + business day) and what each one loaded. */
  expanded = signal<ReadonlySet<string>>(new Set());
  details = signal<Record<string, RowDetails>>({});
  /** Scope of the request that produced the rows — the details must use the same one. */
  private scope: { applyOpeningHour?: boolean; branches?: string[] } = {};

  private seq = 0;
  private prevKey = '';

  constructor() {
    const u = this.urlState.read(PAGING_PARAMS);
    this.page.set(u.page);
    this.pageSize.set(pickPageSize(u.limit, this.sizes));
    this.sort.set(pickSort(u.sortBy, u.sortDirection, SORTABLE) as ListSort | null);

    effect(() => {
      const key = JSON.stringify(this.filter());
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
      const f = this.filter();
      const d = await this.svc.load(f, this.page(), this.pageSize(), this.sort());
      if (mine !== this.seq) return;
      this.scope = { applyOpeningHour: f.applyOpeningHour, branches: f.branches };
      this.expanded.set(new Set());
      this.details.set({});
      this.data.set(d);
    } catch (e: any) {
      if (mine !== this.seq) return;
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.data.set(null);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  records = computed(() => this.data()?.records ?? []);
  total = computed(() => this.data()?.total ?? null);
  isEmpty = computed(() => !!this.data() && this.records().length === 0);

  invoiceLink = (r: VoidedSalesRecord) => journalLink('Invoice', r.invoiceId);
  rowKey = (r: VoidedSalesRecord) => `${r.invoiceId}|${r.voidBusinessDate}`;
  isExpanded = (r: VoidedSalesRecord) => this.expanded().has(this.rowKey(r));
  detail = (r: VoidedSalesRecord): RowDetails | undefined => this.details()[this.rowKey(r)];

  toggleRow(r: VoidedSalesRecord): void {
    const key = this.rowKey(r);
    const next = new Set(this.expanded());
    if (next.has(key)) { next.delete(key); this.expanded.set(next); return; }
    next.add(key);
    this.expanded.set(next);
    const d = this.details()[key];
    if (!d || d.error) void this.loadDetails(r);
  }

  async loadDetails(r: VoidedSalesRecord): Promise<void> {
    const key = this.rowKey(r);
    this.details.update(m => ({ ...m, [key]: { loading: true, error: null, rows: [], total: null } }));
    try {
      const d = await this.svc.details(r, this.scope);
      this.details.update(m => ({ ...m, [key]: { loading: false, error: null, rows: this.nest(d.records), total: d.total } }));
    } catch (e: any) {
      this.details.update(m => ({ ...m, [key]: { loading: false, error: e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'), rows: [], total: null } }));
    }
  }

  /** Sub-items (lines with a parentId) go directly under their parent, indented; one whose parent is missing stays at the top. */
  private nest(items: VoidedItemRecord[]): ItemRow[] {
    const ids = new Set(items.map(i => i.id));
    const children = new Map<string, VoidedItemRecord[]>();
    const roots: VoidedItemRecord[] = [];
    for (const item of items) {
      if (item.parentId && item.parentId !== item.id && ids.has(item.parentId)) {
        children.set(item.parentId, [...(children.get(item.parentId) ?? []), item]);
      } else roots.push(item);
    }
    const rows: ItemRow[] = [];
    const seen = new Set<string>();
    const walk = (item: VoidedItemRecord, depth: number): void => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      rows.push({ item, depth });
      (children.get(item.id) ?? []).forEach(c => walk(c, depth + 1));
    };
    roots.forEach(r => walk(r, 0));
    return rows;
  }

  /** The product(s) this report is filtered to are highlighted in the items list. */
  isFilteredProduct(item: VoidedItemRecord): boolean {
    const ids = this.filter()['productIds'];
    return !!item.productId && Array.isArray(ids) && ids.includes(item.productId);
  }

  /** "Jul → Aug" — the period text of the details panel, from the original invoice date and the void date. */
  timingPeriod(r: VoidedSalesRecord): string {
    if (!r.invoiceDate || !r.voidDate || r.voidTiming === 'sameDay') return '';
    const opts: Intl.DateTimeFormatOptions =
      r.voidTiming === 'differentDay' ? { day: '2-digit', month: 'short' }
      : r.voidTiming === 'differentMonth' ? { month: 'short' } : { month: 'short', year: 'numeric' };
    try {
      const fmt = new Intl.DateTimeFormat(this.lang.current(), opts);
      return `${fmt.format(new Date(r.invoiceDate))} → ${fmt.format(new Date(r.voidDate))}`;
    } catch { return ''; }
  }

  private persist(): void {
    const s = this.sort();
    this.urlState.write(PAGING_PARAMS, {
      page: this.page(), limit: this.pageSize(), sortBy: s?.sortValue ?? '', sortDirection: s?.sortDirection ?? 'asc',
    });
  }
  goTo(p: number): void { this.page.set(p); this.persist(); void this.load(); }
  setSize(n: number): void { this.pageSize.set(n); this.page.set(1); this.persist(); void this.load(); }
  sortBy(col: string): void {
    const cur = this.sort();
    this.sort.set(cur?.sortValue !== col ? { sortValue: col, sortDirection: 'asc' }
      : cur.sortDirection === 'asc' ? { sortValue: col, sortDirection: 'desc' } : null);
    this.page.set(1);
    this.persist();
    void this.load();
  }
  ariaSort(col: string): 'ascending' | 'descending' | 'none' {
    const s = this.sort();
    return s?.sortValue !== col ? 'none' : s.sortDirection === 'asc' ? 'ascending' : 'descending';
  }
  trackRow = (i: number, r: VoidedSalesRecord) => `${this.rowKey(r)}|${i}`;
  trackItem = (_: number, row: ItemRow) => row.item.id;
}
