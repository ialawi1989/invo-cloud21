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
import { InvoiceSalesData, InvoiceSalesRecord, ListSort, SalesByInvoiceService } from './sales-by-invoice.service';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';
import { ReportSkeletonComponent } from '../../components/report-skeleton/report-skeleton.component';

type Num = 'sales' | 'discount' | 'tax' | 'totalSales';
const NUM_COLS: { key: Num; label: string }[] = [
  { key: 'sales', label: 'SALES' }, { key: 'discount', label: 'DISCOUNT' }, { key: 'tax', label: 'TAX' }, { key: 'totalSales', label: 'TOTAL_SALES' },
];
const SORTABLE = ['salesDate', 'invoiceDate', 'invoiceNumber', 'branchName', ...NUM_COLS.map(c => c.key)] as const;
const toNum = (v: unknown): number => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : 0; };

/** Sales By Invoice — one row per invoice (sales date, invoice date, number, branch, sales, discount, tax, total) and a Total row. */
@Component({
  selector: 'app-sales-by-invoice',
  standalone: true,
  imports: [ReportSkeletonComponent, ReportEmptyComponent, ReportErrorComponent, TranslateModule, DatePipe, RouterLink, MycurrencyPipe, PaginationComponent, BoTableShellComponent],
  templateUrl: './sales-by-invoice.component.html',
  styleUrl: './sales-by-invoice.component.scss',
})
export class SalesByInvoiceComponent {
  private svc = inject(SalesByInvoiceService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly numCols = NUM_COLS;
  readonly sizes = [10, 25, 50, 100];
  readonly num = toNum;
  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<InvoiceSalesData | null>(null);
  page = signal(1);
  pageSize = signal(25);
  sort = signal<ListSort | null>(null);

  records = computed(() => this.data()?.records ?? []);
  total = computed(() => this.data()?.total ?? null);
  isEmpty = computed(() => !!this.data() && this.records().length === 0);
  link = (r: InvoiceSalesRecord) => journalLink('Invoice', r.invoiceId);

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
      const d = await this.svc.load(this.filter(), this.page(), this.pageSize(), this.sort());
      if (mine === this.seq) this.data.set(d);
    } catch (e: any) {
      if (mine !== this.seq) return;
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.data.set(null);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
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
  trackRow = (i: number, r: InvoiceSalesRecord) => `${r.invoiceId ?? r.invoiceNumber}|${i}`;
}
