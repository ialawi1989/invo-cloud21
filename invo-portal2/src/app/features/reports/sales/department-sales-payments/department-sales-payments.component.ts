import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { BoTableShellComponent } from '../../business-overview/components/bo-table-shell/bo-table-shell.component';
import { ReportApiFilter } from '../../models/report.model';
import { DeptPaymentsData, DeptPaymentsRecord, DepartmentSalesPaymentsService } from './department-sales-payments.service';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';

const toNum = (v: unknown): number => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : 0; };

/**
 * Department Sales And Payments Overview — per brand / category / department: invoice, credit and net totals
 * (with the sales amount, discount and tax under the name) and the amount paid with each payment method.
 */
@Component({
  selector: 'app-department-sales-payments',
  standalone: true,
  imports: [ReportEmptyComponent, ReportErrorComponent, TranslateModule, MycurrencyPipe, BoTableShellComponent],
  templateUrl: './department-sales-payments.component.html',
  styleUrl: './department-sales-payments.component.scss',
})
export class DepartmentSalesPaymentsComponent {
  private svc = inject(DepartmentSalesPaymentsService);
  private lang = inject(LanguageService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly num = toNum;
  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<DeptPaymentsData | null>(null);

  records = computed(() => this.data()?.records ?? []);
  methods = computed(() => this.data()?.methods ?? []);
  isEmpty = computed(() => !!this.data() && this.records().length === 0);
  /** "Category" / "Department" / "Brand" — the column that groups the rows. */
  groupLabel = computed(() => String(this.filter()['filterBy'] ?? 'category'));

  totals = computed(() => {
    const rs = this.records();
    const sum = (f: (r: DeptPaymentsRecord) => unknown) => rs.reduce((s, r) => s + toNum(f(r)), 0);
    return {
      invoice: sum(r => r.invoice_total), credit: sum(r => r.credit_total), total: sum(r => r.total),
      byMethod: Object.fromEntries(this.methods().map(m => [m, sum(r => r.payments?.[m])])) as Record<string, number>,
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

  trackRecord = (i: number, r: DeptPaymentsRecord) => `${r.filterName ?? ''}|${i}`;
}
