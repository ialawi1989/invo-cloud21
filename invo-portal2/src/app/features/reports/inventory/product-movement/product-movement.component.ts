import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { QueryParamsService } from '@shared/services/query-params.service';
import { journalLink } from '../../../settings/chart-of-accounts/utils/journal-links';
import { BoTableShellComponent } from '../../business-overview/components/bo-table-shell/bo-table-shell.component';
import { PAGING_PARAMS, pickPageSize } from '../../business-overview/shared/paging-params';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportApiFilter } from '../../models/report.model';
import { ProductMovementData, ProductMovementRecord, ProductMovementService } from './product-movement.service';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';

const toNum = (v: unknown): number => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : 0; };

/** Product Movement — one product's stock card: every movement in the period with the running quantity and cost balance. */
@Component({
  selector: 'app-product-movement',
  standalone: true,
  imports: [ReportEmptyComponent, ReportErrorComponent, TranslateModule, DatePipe, DecimalPipe, RouterLink, MycurrencyPipe, PaginationComponent, BoTableShellComponent],
  templateUrl: './product-movement.component.html',
  styleUrl: './product-movement.component.scss',
})
export class ProductMovementComponent {
  private svc = inject(ProductMovementService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly sizes = [10, 25, 50, 100];
  readonly num = toNum;
  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<ProductMovementData | null>(null);
  page = signal(1);
  pageSize = signal(50);

  records = computed(() => this.data()?.records ?? []);
  isEmpty = computed(() => !!this.data() && this.records().length === 0);
  productName = computed(() => this.records().find(r => r.name)?.name ?? '');
  /** The document behind a movement (an invoice, a bill, a transfer …), when the app has a page for it. */
  link = (r: ProductMovementRecord) => journalLink(r.type, r.transactionId);

  private seq = 0;
  private prevKey = '';

  constructor() {
    const u = this.urlState.read(PAGING_PARAMS);
    this.page.set(u.page);
    this.pageSize.set(pickPageSize(u.limit, this.sizes));
    effect(() => {
      const f = this.filter();
      const key = JSON.stringify(f);
      this.refresh();
      untracked(() => {
        if (this.prevKey && this.prevKey !== key) { this.page.set(1); this.persist(); }
        this.prevKey = key;
        if (f['productId']) void this.load(); else { this.data.set(null); this.error.set(null); }
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
  /** Cost per unit of a movement — the line's cost over its quantity (the stored unit cost when nothing moved). */
  unitCost(r: ProductMovementRecord): number {
    const q = toNum(r.qtyUsage);
    return q === 0 ? toNum(r.unitCost) : toNum(r.cost) / q;
  }
  trackRow = (i: number, r: ProductMovementRecord) => `${r.transactionId ?? r.type}|${r.createdAt}|${i}`;
}
