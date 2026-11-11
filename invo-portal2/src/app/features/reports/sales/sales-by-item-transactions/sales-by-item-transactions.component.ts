import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
  ItemTransactionRecord, ItemTransactionsData, ListSort, SalesByItemTransactionsService,
} from './sales-by-item-transactions.service';

const SORTABLE = ['transactionNumber', 'transactionType', 'transactionDate', 'customerName', 'branchName', 'employeeName',
  'netQty', 'salesAmount', 'total'] as const;

const toNum = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Product transactions — the invoices and credit notes behind ONE Sales by Product row (opened from it): same period,
 * branches and opening-hour mode, so the totals equal that row. The product comes from the URL (`itemProductId` /
 * `itemProductName`). Paged and sorted by the backend; page, page size and sort live in the URL.
 */
@Component({
  selector: 'app-sales-by-item-transactions',
  standalone: true,
  imports: [ReportEmptyComponent, ReportErrorComponent, TranslateModule, DatePipe, RouterLink, MycurrencyPipe, PaginationComponent, BoTableShellComponent],
  templateUrl: './sales-by-item-transactions.component.html',
  styleUrl: './sales-by-item-transactions.component.scss',
})
export class SalesByItemTransactionsComponent {
  private svc = inject(SalesByItemTransactionsService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);
  private route = inject(ActivatedRoute);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly sizes = [10, 25, 50, 100];
  readonly num = toNum;

  /** The product of the clicked row. */
  readonly productId = String(this.route.snapshot.queryParams['itemProductId'] ?? '');
  readonly productName = String(this.route.snapshot.queryParams['itemProductName'] ?? '');
  readonly hasProduct = !!(this.productId || this.productName);

  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<ItemTransactionsData | null>(null);
  page = signal(1);
  pageSize = signal(25);
  sort = signal<ListSort | null>(null);

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
    if (!this.hasProduct) return;
    const mine = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const d = await this.svc.load(this.filter(), { id: this.productId, name: this.productName }, this.page(), this.pageSize(), this.sort());
      if (mine !== this.seq) return;
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

  isCreditNote = (r: ItemTransactionRecord) => r.transactionType === 'creditNote';
  /** An earlier invoice voided in this period: nothing sold here, only the void. */
  isVoidOnly = (r: ItemTransactionRecord) => !this.isCreditNote(r) && toNum(r.soldQty) === 0 && toNum(r.voidedQty) > 0;

  /** The page of the invoice / credit note (empty when the type has no view page in this app). */
  link = (r: ItemTransactionRecord) => journalLink(this.isCreditNote(r) ? 'Credit Note' : 'Invoice', r.transactionId);
  invoiceLink = (r: ItemTransactionRecord) => journalLink('Invoice', r.invoiceId);

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
  trackRow = (i: number, r: ItemTransactionRecord) => `${r.transactionType}|${r.transactionId}|${i}`;
}
