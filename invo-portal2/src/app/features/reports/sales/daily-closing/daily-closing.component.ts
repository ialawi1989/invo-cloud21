import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ReportApiFilter } from '../../models/report.model';
import { CategoryDetail, DailyClosingData, DailyClosingService, SalesReturn } from './daily-closing.service';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportSkeletonComponent } from '../../components/report-skeleton/report-skeleton.component';

const toNum = (v: unknown): number => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : 0; };

interface BreakdownRow { key: string; labelKey: string; sales: number; ret: number; sub?: boolean; }

/**
 * Daily Closing Report — one business day of one branch (always on the branch's opening hours): guests / orders, the
 * sales breakdown (sales vs returns), tenders, categories, services, per-date sales and the payments received.
 */
@Component({
  selector: 'app-daily-closing',
  standalone: true,
  imports: [ReportSkeletonComponent, ReportErrorComponent, TranslateModule, DatePipe, RouterLink, MycurrencyPipe],
  templateUrl: './daily-closing.component.html',
  styleUrl: './daily-closing.component.scss',
})
export class DailyClosingComponent {
  private svc = inject(DailyClosingService);
  private lang = inject(LanguageService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly num = toNum;
  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<DailyClosingData | null>(null);

  private pair = (p?: SalesReturn) => ({ s: toNum(p?.sales), r: toNum(p?.return) });
  private shown = (p?: SalesReturn) => { const x = this.pair(p); return x.s > 0 || x.r > 0; };

  /** The Sales Breakdown rows — the optional ones only when something is there (as the legacy). */
  rows = computed<BreakdownRow[]>(() => {
    const d = this.data();
    if (!d) return [];
    const out: BreakdownRow[] = [];
    const add = (key: string, labelKey: string, p?: SalesReturn) => { const x = this.pair(p); out.push({ key, labelKey, sales: x.s, ret: x.r }); };
    add('sales', 'TOTAL_SALES', d.sales);
    if (this.shown(d.discount)) {
      add('discount', 'ITEM_DISCOUNT', d.discount);
      const a = this.pair(d.sales), b = this.pair(d.discount);
      out.push({ key: 'afterDiscount', labelKey: 'TOTAL_AFTER_DISCOUNT', sales: a.s - b.s, ret: a.r - b.r, sub: true });
    }
    if (this.shown(d.tax)) {
      add('tax', 'TOTAL_TAX', d.tax);
      for (const t of d.taxBreakdown ?? []) out.push({ key: 'tax:' + t.name, labelKey: '', sales: toNum(t.invoiceTax), ret: toNum(t.creditTax), sub: false });
      add('withTax', 'TOTAL_WITH_TAX', d.total);
      out[out.length - 1].sub = true;
    }
    if (this.shown(d.surcharge)) add('surcharge', 'SURCHARGE', d.surcharge);
    if (this.shown(d.surchargeTax)) add('surchargeTax', 'SURCHARGE_TAX', d.surchargeTax);
    if (this.shown(d.deliveryCharge)) add('delivery', 'DELIVERY_CHARGE', d.deliveryCharge);
    if (this.shown(d.rounding)) add('rounding', 'ROUNDING', d.rounding);
    return out;
  });
  taxName = (key: string) => key.startsWith('tax:') ? key.slice(4) : '';

  /** Grand total = total (incl. tax) + surcharge + surcharge tax + delivery + rounding, sales vs returns. */
  grand = computed(() => {
    const d = this.data();
    const parts = [d?.total, d?.surcharge, d?.surchargeTax, d?.deliveryCharge, d?.rounding].map(p => this.pair(p));
    const s = parts.reduce((a, p) => a + p.s, 0), r = parts.reduce((a, p) => a + p.r, 0);
    return { sales: s, ret: r, net: s - r };
  });

  groupedCategories = computed(() => {
    const groups = new Map<string, CategoryDetail[]>();
    for (const c of this.data()?.categoryDetails ?? []) {
      const k = c.departmentName || 'Other';
      groups.set(k, [...(groups.get(k) ?? []), c]);
    }
    return [...groups].map(([departmentName, categories]) => ({ departmentName, categories }));
  });

  sum<T>(list: T[] | undefined, f: keyof T): number { return (list ?? []).reduce((a, r) => a + toNum(r[f]), 0); }
  hasSalesDetails = computed(() => (this.data()?.salesDetails?.length ?? 0) > 1);

  /** Every figure is backed by the same sales — the "Total Sales" link opens them (same date, branch and sources). */
  drillParams = computed<Record<string, string | null>>(() => {
    const f = this.filter();
    return {
      preset: 'custom', fromDate: String(f['date'] ?? f.toDate ?? ''), toDate: String(f['date'] ?? f.toDate ?? ''),
      branches: f['branchId'] ? String(f['branchId']) : null,
      sources: Array.isArray(f['sources']) && f['sources'].length ? f['sources'].join(',') : null,
    };
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
      const d = await this.svc.load(this.filter());
      if (mine === this.seq) this.data.set(d);
    } catch (e: any) {
      if (mine !== this.seq) return;
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.data.set(null);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }
}
