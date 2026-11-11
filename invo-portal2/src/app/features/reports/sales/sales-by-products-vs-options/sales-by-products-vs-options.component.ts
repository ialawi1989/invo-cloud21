import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { QueryParamsService } from '@shared/services/query-params.service';
import { BoTableShellComponent } from '../../business-overview/components/bo-table-shell/bo-table-shell.component';
import { PAGING_PARAMS, pickPageSize, pickSort } from '../../business-overview/shared/paging-params';
import { ReportApiFilter } from '../../models/report.model';
import { ListSort, OptionRecord, OptionsData, SalesByProductsVsOptionsService } from './sales-by-products-vs-options.service';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';

const SORTABLE = ['productName', 'lineQty', 'optionName', 'optionPrice', 'qty', 'totalOptionPrice'] as const;

const toNum = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

interface ProductGroup { productName: string; lineQty: number; qty: number; total: number; records: OptionRecord[]; }

/**
 * Sales by Menu Products vs Options — the options sold with each menu product: one block per product (its line
 * quantity once, then one row per option) with a subtotal, and the grand total; paged and sorted by the backend.
 * It is the body of the report page (frame, filters and export come from the shared report page).
 */
@Component({
  selector: 'app-sales-by-products-vs-options',
  standalone: true,
  imports: [ReportEmptyComponent, ReportErrorComponent, TranslateModule, MycurrencyPipe, PaginationComponent, BoTableShellComponent],
  templateUrl: './sales-by-products-vs-options.component.html',
  styleUrl: './sales-by-products-vs-options.component.scss',
})
export class SalesByProductsVsOptionsComponent {
  private svc = inject(SalesByProductsVsOptionsService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly sizes = [10, 25, 50, 100];
  readonly num = toNum;

  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<OptionsData | null>(null);
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
    const mine = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const d = await this.svc.load(this.filter(), this.page(), this.pageSize(), this.sort());
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

  groups = computed<ProductGroup[]>(() => {
    const by = new Map<string, OptionRecord[]>();
    for (const r of this.data()?.records ?? []) by.set(r.productName, [...(by.get(r.productName) ?? []), r]);
    return [...by].map(([productName, records]) => ({
      productName, records,
      // every option row of a product repeats that product's line qty → the product's figure is the max, not the sum
      lineQty: Math.max(0, ...records.map(r => toNum(r.lineQty))),
      qty: records.reduce((t, r) => t + toNum(r.qty), 0),
      total: records.reduce((t, r) => t + toNum(r.totalOptionPrice), 0),
    }));
  });

  /** The backend's totals when it sends them, else the sum of the groups on screen (the legacy rule). */
  private fromApi(v: unknown, fallback: number): number { return v != null && v !== '' ? toNum(v) : fallback; }
  grandLineQty = computed(() => this.fromApi(this.data()?.total?.lineQty, this.groups().reduce((t, g) => t + g.lineQty, 0)));
  grandQty = computed(() => this.fromApi(this.data()?.total?.qty, this.groups().reduce((t, g) => t + g.qty, 0)));
  grandTotal = computed(() => this.fromApi(this.data()?.total?.optionPrice, this.groups().reduce((t, g) => t + g.total, 0)));
  isEmpty = computed(() => !!this.data() && this.groups().length === 0);

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
}
