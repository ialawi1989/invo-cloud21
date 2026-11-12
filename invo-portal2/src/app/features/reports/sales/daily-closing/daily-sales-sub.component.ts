import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { BoTableShellComponent } from '../../business-overview/components/bo-table-shell/bo-table-shell.component';
import { ReportApiFilter } from '../../models/report.model';
import { DailyClosingService, DailySaleLine } from './daily-closing.service';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';
import { ReportSkeletonComponent } from '../../components/report-skeleton/report-skeleton.component';

const toNum = (v: unknown): number => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : 0; };

/** Sales Transactions — the sales lines behind the Daily Closing figures (same business day, branch and sources). */
@Component({
  selector: 'app-daily-sales-sub',
  standalone: true,
  imports: [ReportSkeletonComponent, ReportEmptyComponent, ReportErrorComponent, TranslateModule, DatePipe, MycurrencyPipe, BoTableShellComponent],
  templateUrl: './daily-sales-sub.component.html',
  styleUrl: './daily-closing.component.scss',
})
export class DailySalesSubComponent {
  private svc = inject(DailyClosingService);
  private lang = inject(LanguageService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly num = toNum;
  loading = signal(false);
  error = signal<string | null>(null);
  rows = signal<DailySaleLine[] | null>(null);
  totals = computed(() => {
    const r = this.rows() ?? [];
    const sum = (f: (x: DailySaleLine) => unknown) => r.reduce((a, x) => a + toNum(f(x)), 0);
    return { sales: sum(x => x.totalSales), discount: sum(x => x.itemDiscount), tax: sum(x => x.taxTotal), net: sum(x => x.netSales) };
  });

  private seq = 0;

  constructor() {
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
      const r = await this.svc.lines(this.filter());
      if (mine === this.seq) this.rows.set(r);
    } catch (e: any) {
      if (mine !== this.seq) return;
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.rows.set(null);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }
}
