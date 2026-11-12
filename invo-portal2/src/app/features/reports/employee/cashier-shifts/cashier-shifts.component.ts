import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { ParamDef, QueryParamsService, StringCodec } from '@shared/services/query-params.service';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportApiFilter } from '../../models/report.model';
import { CashierShift, CashierShiftPage, CashierShiftReport, CashierShiftsService } from './cashier-shifts.service';
import { ReportSkeletonComponent } from '../../components/report-skeleton/report-skeleton.component';

const toNum = (v: unknown): number => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : 0; };

/** The chosen shift lives in the URL, so a refresh or a shared link opens the same one. */
const SHIFT_PARAM = { cashierId: { key: 'cashierId', codec: StringCodec } as ParamDef<string> };

/**
 * Cashier Report: the cashier shifts of the period on one side, the chosen shift's report (totals, payment by tender, short/over) on the
 * other — as in the legacy page. The first shift opens by itself.
 */
@Component({
  selector: 'app-cashier-shifts',
  standalone: true,
  imports: [ReportSkeletonComponent, TranslateModule, DatePipe, MycurrencyPipe, PaginationComponent, ReportEmptyComponent, ReportErrorComponent],
  templateUrl: './cashier-shifts.component.html',
  styleUrl: './cashier-shifts.component.scss',
})
export class CashierShiftsComponent {
  private svc = inject(CashierShiftsService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly num = toNum;
  readonly sizes = [10, 15, 25, 50];
  listLoading = signal(false);
  detailLoading = signal(false);
  error = signal<string | null>(null);
  detailError = signal<string | null>(null);
  list = signal<CashierShiftPage | null>(null);
  report = signal<CashierShiftReport | null>(null);
  selected = signal('');
  page = signal(1);
  pageSize = signal(15);

  private listSeq = 0;
  private detailSeq = 0;
  private prevKey = '';

  constructor() {
    this.selected.set(this.urlState.read(SHIFT_PARAM).cashierId);
    effect(() => {
      const key = JSON.stringify(this.filter());
      this.refresh();
      untracked(() => {
        if (this.prevKey && this.prevKey !== key) { this.page.set(1); this.selected.set(''); }
        this.prevKey = key;
        void this.loadList();
      });
    });
  }

  async loadList(): Promise<void> {
    const mine = ++this.listSeq;
    this.listLoading.set(true);
    this.error.set(null);
    try {
      const d = await this.svc.shifts(this.filter(), this.page(), this.pageSize());
      if (mine !== this.listSeq) return;
      this.list.set(d);
      // the first shift opens by itself when none (or one of another period) is chosen
      if (!d.records.some(r => r.id === this.selected())) this.select(d.records[0]?.id ?? '', false);
      else void this.loadReport();
    } catch (e: any) {
      if (mine !== this.listSeq) return;
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.list.set(null); this.report.set(null);
    } finally {
      if (mine === this.listSeq) this.listLoading.set(false);
    }
  }

  select(id: string, userClick = true): void {
    this.selected.set(id);
    this.urlState.write(SHIFT_PARAM, { cashierId: id });
    if (!id) { this.report.set(null); return; }
    if (userClick || id) void this.loadReport();
  }

  async loadReport(): Promise<void> {
    const id = this.selected();
    if (!id) return;
    const mine = ++this.detailSeq;
    this.detailLoading.set(true);
    this.detailError.set(null);
    try {
      const r = await this.svc.report(id);
      if (mine === this.detailSeq) this.report.set(r);
    } catch (e: any) {
      if (mine !== this.detailSeq) return;
      this.detailError.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.report.set(null);
    } finally {
      if (mine === this.detailSeq) this.detailLoading.set(false);
    }
  }

  goTo(p: number): void { this.page.set(p); void this.loadList(); }
  setPageSize(n: number): void { this.pageSize.set(n); this.page.set(1); void this.loadList(); }
  trackShift = (_: number, s: CashierShift) => s.id;
}
