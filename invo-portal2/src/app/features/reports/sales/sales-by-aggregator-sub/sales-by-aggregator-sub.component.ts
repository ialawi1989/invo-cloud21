import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { QueryParamsService } from '@shared/services/query-params.service';
import { journalLink } from '../../../settings/chart-of-accounts/utils/journal-links';
import { BoTableShellComponent } from '../../business-overview/components/bo-table-shell/bo-table-shell.component';
import { PAGING_PARAMS, pickPageSize } from '../../business-overview/shared/paging-params';
import { ReportApiFilter } from '../../models/report.model';
import { AggregatorSubData, AggregatorSubRecord, SalesByAggregatorSubService } from './sales-by-aggregator-sub.service';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';

const toNum = (v: unknown): number => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : 0; };

/** Aggregator Details — the invoices and credit notes behind one Sales by Aggregator row; each code opens its document. */
@Component({
  selector: 'app-sales-by-aggregator-sub',
  standalone: true,
  imports: [ReportEmptyComponent, ReportErrorComponent, TranslateModule, RouterLink, MycurrencyPipe, PaginationComponent, BoTableShellComponent],
  templateUrl: './sales-by-aggregator-sub.component.html',
  styleUrl: './sales-by-aggregator-sub.component.scss',
})
export class SalesByAggregatorSubComponent {
  private svc = inject(SalesByAggregatorSubService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);
  private route = inject(ActivatedRoute);

  filter = input.required<ReportApiFilter>();
  /** What the list belongs to: an aggregator row or a service row of the parent report. */
  kind = input<'aggregator' | 'service'>('aggregator');
  refresh = input(0);

  readonly sizes = [10, 25, 50, 100];
  readonly num = toNum;
  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<AggregatorSubData | null>(null);
  page = signal(1);
  pageSize = signal(50);

  records = computed(() => this.data()?.records ?? []);
  isEmpty = computed(() => !!this.data() && this.records().length === 0);
  /** The aggregator / service the list is for (its name travels in the URL). */
  subject = computed(() => this.kind() === 'service' ? String(this.route.snapshot.queryParams['serviceName'] ?? '') : String(this.filter()['aggregatorName'] ?? ''));
  link = (r: AggregatorSubRecord) => journalLink(r.type, r.id);

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
      const d = await this.svc.load(this.filter(), this.page(), this.pageSize(), this.kind() === 'service' ? 'salesByServiceId' : 'salesByAggregatorSubReport');
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
  trackRow = (i: number, r: AggregatorSubRecord) => `${r.id ?? r.code}|${i}`;
}
