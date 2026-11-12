import { MynumberPipe } from '@core/pipes/mynumber.pipe';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { QueryParamsService } from '@shared/services/query-params.service';
import { BoTableShellComponent } from '../../business-overview/components/bo-table-shell/bo-table-shell.component';
import { PAGING_PARAMS, pickPageSize } from '../../business-overview/shared/paging-params';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportApiFilter } from '../../models/report.model';
import { GeneralInventoryData, GeneralInventoryRecord, GeneralInventoryService, GeneralInventoryTotal } from './general-inventory.service';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';
import { ReportSkeletonComponent } from '../../components/report-skeleton/report-skeleton.component';

type K = keyof GeneralInventoryTotal;
/** Column sections — each has its own colour so the four stages (beginning, receiving, usage, ending) read apart. */
type Sec = 'beg' | 'rec' | 'use' | 'end';
const COLS: { key: K; label: string; money: boolean; sec: Sec }[] = [
  { key: 'beginningQty', label: 'beginningQty', money: false, sec: 'beg' }, { key: 'beginningAmount', label: 'beginningAmount', money: true, sec: 'beg' },
  { key: 'receivingQty', label: 'receivingQty', money: false, sec: 'rec' }, { key: 'receivingCost', label: 'receivingCost', money: true, sec: 'rec' },
  { key: 'usageQty', label: 'usageQty', money: false, sec: 'use' }, { key: 'usageCost', label: 'usageCost', money: true, sec: 'use' },
  { key: 'endingQty', label: 'endingQty', money: false, sec: 'end' }, { key: 'endingAmount', label: 'endingAmount', money: true, sec: 'end' },
];
const toNum = (v: unknown): number => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : 0; };

/** General Inventory — per product: beginning stock, receiving, usage and ending stock (quantity and value), with totals. */
@Component({
  selector: 'app-general-inventory',
  standalone: true,
  imports: [ReportSkeletonComponent, ReportEmptyComponent, ReportErrorComponent, TranslateModule, RouterLink, MynumberPipe, MycurrencyPipe, PaginationComponent, BoTableShellComponent],
  templateUrl: './general-inventory.component.html',
  styleUrl: './general-inventory.component.scss',
})
export class GeneralInventoryComponent {
  private svc = inject(GeneralInventoryService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly cols = COLS;
  readonly sizes = [10, 25, 50, 100];
  readonly num = toNum;
  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<GeneralInventoryData | null>(null);
  page = signal(1);
  pageSize = signal(50);

  records = computed(() => this.data()?.records ?? []);
  total = computed(() => this.data()?.total ?? null);
  isEmpty = computed(() => !!this.data() && this.records().length === 0);

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
  /** The product's stock card for the same period and branches (Product Movement). */
  movementParams(r: GeneralInventoryRecord): Record<string, string | null> {
    const f = this.filter();
    return {
      preset: 'custom', fromDate: f.fromDate ?? null, toDate: f.toDate ?? null,
      branches: f.branches?.length ? f.branches.join(',') : null, products: r.productId ?? null,
    };
  }
  trackRow = (i: number, r: GeneralInventoryRecord) => `${r.productId ?? r.productName}|${i}`;
}
