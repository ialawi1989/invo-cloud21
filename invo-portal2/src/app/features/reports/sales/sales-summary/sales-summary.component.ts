import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { MynumberPipe } from '@core/pipes/mynumber.pipe';
import { ReportKpiRowComponent } from '../../components/report-kpi-row/report-kpi-row.component';
import { ReportApiFilter, ReportKpi } from '../../models/report.model';
import { SalesSummaryData, SalesSummaryService } from './sales-summary.service';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';

/** Colours of the category / service dots (the legacy palette). */
const PALETTE = [
  '#32acc1', '#f1b44c', '#E9967A', '#800000', '#20a8d8', '#800080', '#008080', '#FFA07A', '#FF00FF', '#808000',
  '#4dbd74', '#00FF00', '#CD5C5C', '#63c2de', '#F08080', '#f8cb00', '#000080', '#00FFFF', '#FA8072', '#f86c6b',
];

const sum = (rows: any[], key: string): number =>
  rows.reduce((t, r) => (r?.[key] != null ? t + +r[key] : t), 0);

/**
 * Sales Summary — ported from the legacy page: headline figures, then Sales by category (with the totals block),
 * Sales by service, Tax details, Payment received (with refund / payout / net income) and Discount.
 * The arithmetic is the legacy's, line for line. It is the body of the Sales report page: the page frame, the
 * filters, export and favourites come from the shared report page, which hands this component the API filter.
 */
@Component({
  selector: 'app-sales-summary',
  standalone: true,
  imports: [ReportErrorComponent, TranslateModule, DecimalPipe, MycurrencyPipe, MynumberPipe, ReportKpiRowComponent],
  templateUrl: './sales-summary.component.html',
  styleUrl: './sales-summary.component.scss',
})
export class SalesSummaryComponent {
  private svc = inject(SalesSummaryService);
  private lang = inject(LanguageService);

  filter = input.required<ReportApiFilter>();
  /** Bumped by the page's Refresh button. */
  refresh = input(0);

  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<SalesSummaryData | null>(null);
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
      if (mine !== this.seq) return; // a newer request superseded this one
      this.data.set(d);
    } catch (e: any) {
      if (mine !== this.seq) return;
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.data.set(null);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  readonly color = (i: number): string => PALETTE[i] ?? PALETTE[0];

  stats = computed(() => this.data()?.stats ?? {});
  categories = computed(() => this.data()?.categories ?? []);
  services = computed(() => this.data()?.services ?? []);
  taxes = computed(() => this.data()?.taxes ?? []);
  discounts = computed(() => this.data()?.discounts ?? []);
  payments = computed(() => this.data()?.payments ?? []);

  categoriesTotal = computed(() => sum(this.categories(), 'salesTotal'));
  servicesTotal = computed(() => sum(this.services(), 'salesTotal'));
  taxesTotal = computed(() => sum(this.taxes(), 'taxTotal'));
  discountsTotal = computed(() => sum(this.discounts(), 'sum'));
  paidTotal = computed(() => sum(this.payments(), 'amount_paid'));
  actualPaidTotal = computed(() => sum(this.payments(), 'actual_amount_paid'));

  /** Sales after discount + charge + delivery + tax + rounding. */
  total = computed(() => {
    const s = this.stats();
    return +(s.totalAfterDiscount || 0) + +(s.totalCharge || 0) + +(s.totalDelivery || 0)
      + +(s.totalTax || 0) + +(s.totalRounding || 0);
  });
  /** Net revenue: the total less returns, refunds and payouts. */
  netRevenue = computed(() => {
    const s = this.stats();
    return this.total() - +(s.totalReturn || 0) - +(s.totalRefund || 0) - +(s.payout || 0);
  });
  /** What the payment table actually received, less refunds and payouts. */
  netIncome = computed(() => this.actualPaidTotal() - (this.stats().totalRefund || 0) - (this.stats().payout || 0));

  kpis = computed<ReportKpi[]>(() => {
    const s = this.stats();
    return [
      { label: 'REPORTS.SALES_SUMMARY.TOTAL_SALES', value: +(s.totalSales || 0), type: 'currency', tone: 'income' },
      { label: 'REPORTS.SALES_SUMMARY.NET_REVENUE', value: this.netRevenue(), type: 'currency', tone: 'profit' },
      { label: 'REPORTS.SALES_SUMMARY.TOTAL_ORDERS', value: +(s.totalOrder || 0), type: 'number', tone: 'asset' },
      { label: 'REPORTS.SALES_SUMMARY.AVG_ORDER_SALE', value: +(s.avgSalesPerOrder || 0), type: 'currency', tone: 'equity' },
      { label: 'REPORTS.SALES_SUMMARY.SALES_ITEMS', value: +(s.salesItems || 0), type: 'number', tone: 'liability' },
      { label: 'REPORTS.SALES_SUMMARY.TOTAL_GUESTS', value: +(s.guests || 0), type: 'number', tone: 'asset' },
      { label: 'REPORTS.SALES_SUMMARY.AVG_GUEST_SALE', value: +(s.avgSalesPerGuest || 0), type: 'currency', tone: 'equity' },
      { label: 'REPORTS.SALES_SUMMARY.PAYMENT_RECEIVED', value: this.actualPaidTotal(), type: 'currency', tone: 'income' },
    ];
  });
}
