import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { QueryParamsService } from '@shared/services/query-params.service';
import { BoTableShellComponent } from '../../business-overview/components/bo-table-shell/bo-table-shell.component';
import { PAGING_PARAMS, pickPageSize, pickSort } from '../../business-overview/shared/paging-params';
import { ReportApiFilter } from '../../models/report.model';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';
import {
  SalesByProductData, SalesByProductRecord, SalesByProductService, SalesByProductSort,
} from './sales-by-product.service';

/** Columns the API can sort by. */
const SORTABLE = ['categoryName', 'productName', 'qty', 'salesAmount', 'discountTotal', 'taxTotal', 'total'] as const;

/** A number from what the API sent (a number, a numeric string, or nothing). */
const toNum = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Sales by Product — the legacy page: one row per product with the gross → net breakdown (sold / voided / returned
 * qty, gross sales, void amount, returns, net sales, discount, tax, total), paged and sorted by the backend, and the
 * totals of the whole result. It is the body of the report page: the frame, the filters (date, branches, products,
 * source, opening hours) and the export come from the shared report page, which hands this component the API filter.
 * Page, page size and sort live in the URL.
 */
@Component({
  selector: 'app-sales-by-product',
  standalone: true,
  imports: [ReportEmptyComponent, ReportErrorComponent, TranslateModule, RouterLink, MycurrencyPipe, PaginationComponent, BoTableShellComponent],
  templateUrl: './sales-by-product.component.html',
  styleUrl: './sales-by-product.component.scss',
})
export class SalesByProductComponent {
  private svc = inject(SalesByProductService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);

  filter = input.required<ReportApiFilter>();
  /** Bumped by the page's Refresh button. */
  refresh = input(0);

  readonly sizes = [10, 25, 50, 100];
  readonly sortable = SORTABLE;

  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<SalesByProductData | null>(null);

  page = signal(1);
  pageSize = signal(25);
  sort = signal<SalesByProductSort | null>(null);

  private seq = 0;
  private prevKey = '';

  readonly num = toNum;

  constructor() {
    // Page, page size and sort come back from the URL, so a refresh (or a shared link) keeps them.
    const u = this.urlState.read(PAGING_PARAMS);
    this.page.set(u.page);
    this.pageSize.set(pickPageSize(u.limit, this.sizes));
    this.sort.set(pickSort(u.sortBy, u.sortDirection, SORTABLE) as SalesByProductSort | null);

    effect(() => {
      const key = JSON.stringify(this.filter());
      this.refresh();
      untracked(() => {
        // A changed filter starts from page 1 (the page size and the sort stay).
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
      if (mine !== this.seq) return; // a newer request superseded this one
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
  totals = computed(() => this.data()?.total);
  isEmpty = computed(() => !!this.data() && this.records().length === 0);

  private persist(): void {
    const s = this.sort();
    this.urlState.write(PAGING_PARAMS, {
      page: this.page(), limit: this.pageSize(), sortBy: s?.sortValue ?? '', sortDirection: s?.sortDirection ?? 'asc',
    });
  }

  goTo(p: number): void { this.page.set(p); this.persist(); void this.load(); }
  setSize(n: number): void { this.pageSize.set(n); this.page.set(1); this.persist(); void this.load(); }

  /** Header click: ascending → descending → back to the default order. */
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

  /** URL params that carry this report's period, branches and opening-hour mode to a drill-through (same totals as the row). */
  private drillParams(): Record<string, string | null> {
    const f = this.filter();
    return {
      preset: 'custom', fromDate: f.fromDate ?? null, toDate: f.toDate ?? null,
      branches: f.branches?.length ? f.branches.join(',') : null,
      openingHour: f.applyOpeningHour ? '1' : null,
      sources: f['sources']?.length ? f['sources'].join(',') : null,
    };
  }

  /** The invoices and credit notes behind a row (also for open items, which have no id, by name). */
  canDrillToTransactions = (r: SalesByProductRecord) => !!(r.productId || r.productName);
  transactionsParams(r: SalesByProductRecord): Record<string, string | null> {
    return { ...this.drillParams(), itemProductId: r.productId ?? null, itemProductName: r.productName || null };
  }

  /** The voided sales of a product (needs its id and something voided). */
  canDrillToVoids = (r: SalesByProductRecord) => !!r.productId && (toNum(r.voidAmount) > 0 || toNum(r.voidedQty) > 0);
  voidsParams(r: SalesByProductRecord): Record<string, string | null> {
    return { ...this.drillParams(), products: r.productId ?? null };
  }

  trackRow = (i: number, r: SalesByProductRecord) => r.productId ?? `${r.barcode}|${r.productName}|${i}`;
}
