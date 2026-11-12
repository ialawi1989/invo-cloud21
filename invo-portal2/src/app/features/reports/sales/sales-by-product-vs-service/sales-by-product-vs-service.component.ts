import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { QueryParamsService } from '@shared/services/query-params.service';
import { BoTableShellComponent } from '../../business-overview/components/bo-table-shell/bo-table-shell.component';
import { PAGING_PARAMS, pickPageSize } from '../../business-overview/shared/paging-params';
import { ReportApiFilter } from '../../models/report.model';
import { ProductVsServiceData, ProductVsServiceRecord, SalesByProductVsServiceService } from './sales-by-product-vs-service.service';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';
import { ReportSkeletonComponent } from '../../components/report-skeleton/report-skeleton.component';

const toNum = (v: unknown): number => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : 0; };

type K = 'invoiceProdQty' | 'invoiceSales' | 'creditNoteProdQty' | 'creditNoteSales' | 'totalSalesQty' | 'totalSales';
const COLS: { key: K; sub: keyof ProductVsServiceRecord; label: string; money: boolean }[] = [
  { key: 'invoiceProdQty', sub: 'invoiceProdQtyPerService', label: 'INVOICE_QTY', money: false },
  { key: 'invoiceSales', sub: 'invoiceSalesPerService', label: 'INVOICE_SALES', money: true },
  { key: 'creditNoteProdQty', sub: 'creditNoteProdQtyPerService', label: 'CREDIT_QTY', money: false },
  { key: 'creditNoteSales', sub: 'creditNoteSalesPerService', label: 'CREDIT_SALES', money: true },
  { key: 'totalSalesQty', sub: 'salesQtyTotalPerService', label: 'TOTAL_QTY', money: false },
  { key: 'totalSales', sub: 'salesTotalPerService', label: 'TOTAL_SALES', money: true },
];

interface Group { serviceId: string; serviceName: string; first: ProductVsServiceRecord; records: ProductVsServiceRecord[]; }

/** Sales By Product Vs Service — products grouped under each service, with a subtotal per service. Paged by the backend. */
@Component({
  selector: 'app-sales-by-product-vs-service',
  standalone: true,
  imports: [ReportSkeletonComponent, ReportEmptyComponent, ReportErrorComponent, TranslateModule, MycurrencyPipe, PaginationComponent, BoTableShellComponent],
  templateUrl: './sales-by-product-vs-service.component.html',
  styleUrl: './sales-by-product-vs-service.component.scss',
})
export class SalesByProductVsServiceComponent {
  private svc = inject(SalesByProductVsServiceService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly cols = COLS;
  readonly sizes = [10, 25, 50, 100];
  readonly num = toNum;
  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<ProductVsServiceData | null>(null);
  page = signal(1);
  pageSize = signal(50);

  total = computed(() => this.data()?.total ?? null);
  isEmpty = computed(() => !!this.data() && this.data()!.records.length === 0);
  /** Consecutive records of one service form a group (the backend orders by service). */
  groups = computed<Group[]>(() => {
    const out: Group[] = [];
    for (const r of this.data()?.records ?? []) {
      const id = r.serviceId ?? '';
      const last = out[out.length - 1];
      if (last && last.serviceId === id) last.records.push(r);
      else out.push({ serviceId: id, serviceName: r.serviceName ?? '', first: r, records: [r] });
    }
    return out;
  });

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
    this.urlState.write(PAGING_PARAMS, { page: this.page(), limit: this.pageSize(), sortBy: '', sortDirection: 'asc' });
  }
  goTo(p: number): void { this.page.set(p); this.persist(); void this.load(); }
  setSize(n: number): void { this.pageSize.set(n); this.page.set(1); this.persist(); void this.load(); }
  trackGroup = (i: number, g: Group) => `${g.serviceId}|${i}`;
  trackRecord = (i: number, r: ProductVsServiceRecord) => `${r.productName ?? ''}|${i}`;
}
