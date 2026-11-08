import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ApiService } from '@core/http/api.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';

type Period = '7' | '30' | '90';

const PERMISSION = 'reportsSecurity.actions.SalesByEmployee.access';
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const n = (v: any): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

/**
 * This employee's sales for a period, from the Sales-by-Employee report.
 *
 * That report has no employee filter and no employee id — it returns one row per
 * employee NAME — so the card keeps the row whose name matches and derives the
 * company total by summing every row. Hidden when the employee has no sales in the period AND is
 * not marked as a sales person, so non-sales staff never see an empty card.
 */
@Component({
  selector: 'app-employee-sales-summary',
  standalone: true,
  imports: [TranslateModule, RouterLink, MycurrencyPipe, SegmentedToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-sales-summary.component.html',
  styleUrl: './employee-sales-summary.component.scss',
})
export class EmployeeSalesSummaryComponent implements OnInit {
  private api = inject(ApiService);
  private privileges = inject(PrivilegeService);

  readonly employeeId = input.required<string>();
  readonly isSalesPerson = input<boolean>(false);
  /** The report returns no employee id, only a name — so the card matches on it. */
  readonly employeeName = input.required<string>();

  readonly periodOptions: SegmentedToggleOption<Period>[] = [
    { value: '7', label: 'EMPLOYEES.ATTENDANCE_SUMMARY.P_7' },
    { value: '30', label: 'EMPLOYEES.ATTENDANCE_SUMMARY.P_30' },
    { value: '90', label: 'EMPLOYEES.ATTENDANCE_SUMMARY.P_90' },
  ];
  readonly period = signal<Period>('30');
  readonly loading = signal(true);
  readonly row = signal<any | null>(null);
  readonly grand = signal<number>(0);

  readonly allowed = computed(() => this.privileges.check(PERMISSION));
  // Column names are exactly what the backend selects (Postgres lower-cases `salesTotal`).
  readonly sales = computed(() => n(this.row()?.salestotal ?? this.row()?.salesTotal));
  readonly qty = computed(() => n(this.row()?.productQty));
  readonly returns = computed(() => n(this.row()?.creditNoteTotal));
  readonly share = computed(() => {
    const g = this.grand();
    return g > 0 ? Math.round((this.sales() / g) * 1000) / 10 : 0;
  });
  readonly visible = computed(() => this.allowed() && !this.loading() && (this.sales() > 0 || this.isSalesPerson()));

  ngOnInit(): void { void this.load(); }

  setPeriod(p: Period): void {
    if (p === this.period()) return;
    this.period.set(p);
    void this.load();
  }

  private async load(): Promise<void> {
    if (!this.allowed() || !this.employeeId()) { this.loading.set(false); return; }
    this.loading.set(true);
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - (Number(this.period()) - 1));
    try {
      // This report takes `interval`, not `filter.fromDate` — without it the
      // server falls back to "from 1970", i.e. all-time.
      const res = await this.api.request<any>(this.api.post('accounts/reports/salesByEmployee', {
        interval: { from: ymd(from), to: ymd(to) },
      })).catch(() => null);
      // Flat array: { employeeName, productQty, invoiceTotal, creditNoteTotal, salestotal }.
      const rows: any[] = res?.success && Array.isArray(res.data) ? res.data : [];
      const name = this.employeeName().trim().toLowerCase();
      this.row.set(rows.find(r => String(r?.employeeName ?? '').trim().toLowerCase() === name) ?? null);
      this.grand.set(rows.reduce((sum, r) => sum + Math.max(0, n(r?.salestotal ?? r?.salesTotal)), 0));
    } finally {
      this.loading.set(false);
    }
  }
}
