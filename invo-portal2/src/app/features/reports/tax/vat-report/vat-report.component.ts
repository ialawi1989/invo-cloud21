import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ReportKpiRowComponent } from '../../components/report-kpi-row/report-kpi-row.component';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportApiFilter, ReportKpi } from '../../models/report.model';
import { VatBox, VatReportData, VatReportService } from './vat-report.service';
import { ReportSkeletonComponent } from '../../components/report-skeleton/report-skeleton.component';

/**
 * VAT Report — headline figures, then the sales boxes, the purchase boxes and the net VAT due, as in the legacy page.
 * A tax's name opens its transactions (the VAT details of sales / purchases); the customs-import box opens the bills of
 * entry. The page frame, filters and export come from the shared report page, which hands this component the API filter.
 */
@Component({
  selector: 'app-vat-report',
  standalone: true,
  imports: [ReportSkeletonComponent, ReportErrorComponent, TranslateModule, RouterLink, MycurrencyPipe, ReportKpiRowComponent],
  templateUrl: './vat-report.component.html',
  styleUrls: ['../../sales/sales-summary/sales-summary.component.scss', './vat-report.component.scss'],
})
export class VatReportComponent {
  private svc = inject(VatReportService);
  private lang = inject(LanguageService);

  filter = input.required<ReportApiFilter>();
  /** Bumped by the page's Refresh button. */
  refresh = input(0);

  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<VatReportData | null>(null);
  private seq = 0;

  constructor() {
    effect(() => {
      const f = this.filter();
      this.refresh();
      untracked(() => void this.load(f));
    });
  }

  async load(f: ReportApiFilter = this.filter()): Promise<void> {
    const mine = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const d = await this.svc.load(f);
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

  netDue = computed(() => (this.data()?.sales.totalVatAmount ?? 0) - (this.data()?.purchases.totalVatAmount ?? 0));
  kpis = computed<ReportKpi[]>(() => {
    const d = this.data();
    if (!d) return [];
    const t = (k: string) => this.lang.instant('REPORTS.VAT.' + k);
    return [
      { label: t('ON_SALES'), value: d.sales.totalVatAmount, type: 'currency', tone: 'income' },
      { label: t('ON_PURCHASES'), value: d.purchases.totalVatAmount, type: 'currency', tone: 'expense' },
      { label: t('NET_DUE'), value: this.netDue(), type: 'currency', tone: this.netDue() >= 0 ? 'profit' : 'liability' },
      { label: t('TOTAL_SALES'), value: d.sales.totalAmount, type: 'currency', tone: 'asset' },
    ];
  });

  /** URL params that carry the period and branches of this report into a drill-through. */
  private base(): Record<string, string | null> {
    const f = this.filter();
    return { preset: 'custom', fromDate: f.fromDate ?? null, toDate: f.toDate ?? null, branches: f.branches?.length ? f.branches.join(',') : null };
  }
  hasDetails = (r: VatBox): boolean => !!r.taxId || !!r.taxes?.length;
  detailsParams(r: VatBox): Record<string, string | null> {
    return { ...this.base(), taxId: r.taxId ?? null, taxes: r.taxes?.length ? r.taxes.join(',') : null };
  }
  entryParams = (): Record<string, string | null> => this.base();
}
