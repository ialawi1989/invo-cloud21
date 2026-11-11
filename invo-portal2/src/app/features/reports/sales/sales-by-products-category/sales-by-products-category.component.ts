import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { QueryParamsService } from '@shared/services/query-params.service';
import { BoTableShellComponent } from '../../business-overview/components/bo-table-shell/bo-table-shell.component';
import { PAGING_PARAMS, pickPageSize } from '../../business-overview/shared/paging-params';
import { ReportApiFilter } from '../../models/report.model';
import { ProductCategoryData, ProductCategoryRecord, SalesByProductsCategoryService } from './sales-by-products-category.service';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';

interface CategoryGroup {
  category: string;
  invoiceProdQty: number; invoiceSales: number; creditNoteProdQty: number; creditNoteSales: number;
  salesQty: number; sales: number;
  records: ProductCategoryRecord[];
}

/**
 * Sales by Products Category — the legacy page: the products of each category (invoice vs credit note quantity and
 * sales, net quantity and total), a subtotal under each category and the grand total, paged by the backend. The
 * category's subtotal comes from the backend, on the first record of the category. Page and page size live in the URL.
 * It is the body of the report page (frame, filters and export come from the shared report page).
 */
@Component({
  selector: 'app-sales-by-products-category',
  standalone: true,
  imports: [ReportEmptyComponent, ReportErrorComponent, TranslateModule, MycurrencyPipe, PaginationComponent, BoTableShellComponent],
  templateUrl: './sales-by-products-category.component.html',
  styleUrl: './sales-by-products-category.component.scss',
})
export class SalesByProductsCategoryComponent {
  private svc = inject(SalesByProductsCategoryService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly sizes = [10, 25, 50, 100];

  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<ProductCategoryData | null>(null);
  page = signal(1);
  pageSize = signal(25);

  private seq = 0;
  private prevKey = '';

  constructor() {
    const u = this.urlState.read(PAGING_PARAMS);
    this.page.set(u.page);
    this.pageSize.set(pickPageSize(u.limit, this.sizes));

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
      const d = await this.svc.load(this.filter(), this.page(), this.pageSize());
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

  /** Records grouped by category, in the order the backend sent them. */
  groups = computed<CategoryGroup[]>(() => {
    const byCat = new Map<string, ProductCategoryRecord[]>();
    for (const r of this.data()?.records ?? []) byCat.set(r.categoryName, [...(byCat.get(r.categoryName) ?? []), r]);
    return [...byCat].map(([category, records]) => {
      const f = records[0];
      return {
        category, records,
        invoiceProdQty: f.invoiceProdQtyPerCategory || 0, invoiceSales: f.invoiceSalesPerCategory || 0,
        creditNoteProdQty: f.creditNoteProdQtyPerCategory || 0, creditNoteSales: f.creditNoteSalesPerCategory || 0,
        salesQty: f.salesQtyTotalPerCategory || 0, sales: f.salesTotalPerCategory || 0,
      };
    });
  });
  total = computed(() => this.data()?.total);
  isEmpty = computed(() => !!this.data() && this.groups().length === 0);

  private persist(): void {
    this.urlState.write(PAGING_PARAMS, { page: this.page(), limit: this.pageSize(), sortBy: '', sortDirection: 'asc' });
  }
  goTo(p: number): void { this.page.set(p); this.persist(); void this.load(); }
  setSize(n: number): void { this.pageSize.set(n); this.page.set(1); this.persist(); void this.load(); }
}
