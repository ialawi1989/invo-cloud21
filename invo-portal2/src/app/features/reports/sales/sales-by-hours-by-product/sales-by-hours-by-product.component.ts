import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { QueryParamsService } from '@shared/services/query-params.service';
import { BoTableShellComponent } from '../../business-overview/components/bo-table-shell/bo-table-shell.component';
import { PAGING_PARAMS, pickPageSize } from '../../business-overview/shared/paging-params';
import { ReportApiFilter } from '../../models/report.model';
import { HoursByProductData, HoursProductRecord, SalesByHoursByProductService } from './sales-by-hours-by-product.service';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';

const toNum = (v: unknown): number => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : 0; };

/** Sales By Hours By Product — each product with its sales per hour of the day and the share of that day's sales. */
@Component({
  selector: 'app-sales-by-hours-by-product',
  standalone: true,
  imports: [ReportEmptyComponent, ReportErrorComponent, TranslateModule, DecimalPipe, MycurrencyPipe, PaginationComponent, BoTableShellComponent],
  templateUrl: './sales-by-hours-by-product.component.html',
  styleUrl: './sales-by-hours-by-product.component.scss',
})
export class SalesByHoursByProductComponent {
  private svc = inject(SalesByHoursByProductService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly sizes = [10, 15, 25, 50];
  readonly num = toNum;
  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<HoursByProductData | null>(null);
  page = signal(1);
  pageSize = signal(15);

  records = computed(() => this.data()?.records ?? []);
  isEmpty = computed(() => !!this.data() && this.records().length === 0);
  /** Totals across the products on this page (as the legacy grand total). */
  grandQty = computed(() => this.records().reduce((s, r) => s + toNum(r.totalQty), 0));
  grandSales = computed(() => this.records().reduce((s, r) => s + toNum(r.totalSales), 0));

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

  /** "13:00" → "13:00 - 14:00". */
  hourRange(hour: string): string {
    if (!hour) return '';
    const h = parseInt(hour.split(':')[0], 10);
    if (isNaN(h)) return hour;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:00 - ${pad((h + 1) % 24)}:00`;
  }

  private persist(): void {
    this.urlState.write(PAGING_PARAMS, { page: this.page(), limit: this.pageSize(), sortBy: '', sortDirection: 'asc' });
  }
  goTo(p: number): void { this.page.set(p); this.persist(); void this.load(); }
  setSize(n: number): void { this.pageSize.set(n); this.page.set(1); this.persist(); void this.load(); }
  trackProduct = (i: number, p: HoursProductRecord) => `${p.productName}|${i}`;
}
