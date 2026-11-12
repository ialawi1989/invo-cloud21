import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { QueryParamsService } from '@shared/services/query-params.service';
import { BoTableShellComponent } from '../../business-overview/components/bo-table-shell/bo-table-shell.component';
import { PAGING_PARAMS, pickSort } from '../../business-overview/shared/paging-params';
import { ReportApiFilter } from '../../models/report.model';
import { ListSort, SalesByTerminalService, TerminalRecord } from './sales-by-terminal.service';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';
import { ReportSkeletonComponent } from '../../components/report-skeleton/report-skeleton.component';

type Col = 'invoiceProdQty' | 'invoiceSales' | 'creditNoteProdQty' | 'creditNoteSales' | 'totalSales';
const COLS: { key: Col; labelKey: string; money: boolean }[] = [
  { key: 'invoiceProdQty', labelKey: 'INVOICE_QTY', money: false },
  { key: 'invoiceSales', labelKey: 'INVOICE_SALES', money: true },
  { key: 'creditNoteProdQty', labelKey: 'CREDIT_QTY', money: false },
  { key: 'creditNoteSales', labelKey: 'CREDIT_SALES', money: true },
  { key: 'totalSales', labelKey: 'TOTAL', money: true },
];
const SORTABLE = ['terminalName', ...COLS.map(c => c.key)] as const;
const toNum = (v: unknown): number => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : 0; };

/** Sales By Terminal — per terminal: invoice / credit-note quantities and sales, and the net total. Sort lives in the URL. */
@Component({
  selector: 'app-sales-by-terminal',
  standalone: true,
  imports: [ReportSkeletonComponent, ReportEmptyComponent, ReportErrorComponent, TranslateModule, MycurrencyPipe, BoTableShellComponent],
  templateUrl: './sales-by-terminal.component.html',
  styleUrl: './sales-by-terminal.component.scss',
})
export class SalesByTerminalComponent {
  private svc = inject(SalesByTerminalService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly cols = COLS;
  readonly num = toNum;
  loading = signal(false);
  error = signal<string | null>(null);
  records = signal<TerminalRecord[] | null>(null);
  sort = signal<ListSort | null>(null);

  isEmpty = computed(() => !!this.records() && this.records()!.length === 0);
  totals = computed(() => {
    const t: Record<Col, number> = { invoiceProdQty: 0, invoiceSales: 0, creditNoteProdQty: 0, creditNoteSales: 0, totalSales: 0 };
    for (const r of this.records() ?? []) for (const c of COLS) t[c.key] += toNum(r[c.key]);
    return t;
  });

  private seq = 0;

  constructor() {
    const u = this.urlState.read(PAGING_PARAMS);
    this.sort.set(pickSort(u.sortBy, u.sortDirection, SORTABLE) as ListSort | null);
    effect(() => {
      this.filter();
      this.refresh();
      untracked(() => void this.load());
    });
  }

  async load(): Promise<void> {
    const mine = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await this.svc.load(this.filter(), this.sort());
      if (mine === this.seq) this.records.set(r);
    } catch (e: any) {
      if (mine !== this.seq) return;
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.records.set(null);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  sortBy(col: string): void {
    const cur = this.sort();
    this.sort.set(cur?.sortValue !== col ? { sortValue: col, sortDirection: 'asc' }
      : cur.sortDirection === 'asc' ? { sortValue: col, sortDirection: 'desc' } : null);
    const s = this.sort();
    this.urlState.write(PAGING_PARAMS, { page: 1, limit: 0, sortBy: s?.sortValue ?? '', sortDirection: s?.sortDirection ?? 'asc' });
    void this.load();
  }
  ariaSort(col: string): 'ascending' | 'descending' | 'none' {
    const s = this.sort();
    return s?.sortValue !== col ? 'none' : s.sortDirection === 'asc' ? 'ascending' : 'descending';
  }
  trackRow = (i: number, r: TerminalRecord) => `${r.terminalId ?? 'others'}|${i}`;
}
