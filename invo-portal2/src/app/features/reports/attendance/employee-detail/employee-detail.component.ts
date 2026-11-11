import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { ReportSelectPromptComponent } from '../../components/report-select-prompt/report-select-prompt.component';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportApiFilter, ReportKpi } from '../../models/report.model';
import { ReportKpiRowComponent } from '../../components/report-kpi-row/report-kpi-row.component';
import { AttendanceService, EmployeeDetailData } from '../attendance.service';

/**
 * Employee Attendance Detail: one employee over a period — their totals, each day with its shifts, and every adjustment made to
 * their punches. Needs an employee (chosen in Filters); asks for one until then.
 */
@Component({
  selector: 'app-employee-attendance-detail',
  standalone: true,
  imports: [TranslateModule, RouterLink, DatePipe, ReportEmptyComponent, ReportErrorComponent, ReportSelectPromptComponent, ReportKpiRowComponent],
  templateUrl: './employee-detail.component.html',
  styleUrl: './employee-detail.component.scss',
})
export class EmployeeAttendanceDetailComponent {
  private svc = inject(AttendanceService);
  private lang = inject(LanguageService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<EmployeeDetailData | null>(null);
  /** The employee's sales (Sales by Employee) for the same period and branches, opened in a new tab. */
  salesQuery = computed<Record<string, string | null>>(() => {
    const f = this.filter();
    return { preset: 'custom', fromDate: f.fromDate ?? null, toDate: f.toDate ?? null, branches: f.branches?.length ? f.branches.join(',') : null };
  });
  /** The photo failed to load: show the employee's initial instead. */
  photoFailed = signal(false);
  /** The summary as the same tiles the other reports use (Sales Summary). */
  kpis = computed<ReportKpi[]>(() => {
    const s = this.data()?.summary;
    if (!s) return [];
    return [
      { label: 'REPORTS.ATTENDANCE.DAYS_PRESENT', value: s.daysPresent, suffix: `/ ${s.daysScheduled}`, type: 'number', tone: 'asset' },
      { label: 'REPORTS.ATTENDANCE.TOTAL_HOURS', value: s.totalHours, type: 'number', tone: 'profit' },
      { label: 'REPORTS.ATTENDANCE.LATE_ARRIVALS', value: s.lateArrivals, type: 'number', tone: 'liability' },
      { label: 'REPORTS.ATTENDANCE.ADJUSTMENTS', value: s.adjustmentCount, type: 'number', tone: 'equity' },
      { label: 'REPORTS.ATTENDANCE.MISSING_OUTS', value: s.missingClockOuts, type: 'number', tone: 'expense' },
    ];
  });
  /** The photo being previewed (hover / focus on a photo icon): its url, a label and where to show it. */
  photo = signal<{ url: string; label: string; x: number; y: number; below: boolean } | null>(null);
  showPhoto(ev: Event, url: string | null | undefined, label: string): void {
    if (!url) return;
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const below = r.top < 230; // not enough room above: show it under the icon
    this.photo.set({ url, label, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
  }
  hidePhoto(): void { this.photo.set(null); }
  needsEmployee = computed(() => !(this.filter() as Record<string, unknown>)['employeeId']);
  isEmpty = computed(() => !!this.data() && !this.data()!.employee);
  private seq = 0;

  constructor() {
    effect(() => {
      JSON.stringify(this.filter());
      this.refresh();
      untracked(() => void this.load());
    });
  }

  async load(): Promise<void> {
    if (this.needsEmployee()) { this.data.set(null); this.error.set(null); return; }
    const mine = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const d = await this.svc.employeeDetail(this.filter());
      if (mine === this.seq) this.data.set(d);
    } catch (e: any) {
      if (mine !== this.seq) return;
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.data.set(null);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  /** Minutes as "Xh Ym". */
  hm(min: number | null | undefined): string {
    const n = Math.round(Number(min) || 0);
    return `${Math.floor(n / 60)}h ${n % 60}m`;
  }
  tagClass(v: string): string {
    const t = String(v ?? '').toLowerCase();
    if (/on[ _-]?time|present/.test(t)) return 'ok';
    if (/late|adjusted/.test(t)) return 'warn';
    if (/missing|absent/.test(t)) return 'bad';
    return 'muted';
  }
  /** A punch the manager changed: the effective time differs from the original one. */
  isAdjusted(raw: string | null | undefined, eff: string | null | undefined): boolean {
    return !!raw && !!eff && new Date(raw).getTime() !== new Date(eff).getTime();
  }
  /** Worked minutes as hours with two decimals ("7.50"). */
  hours(min: number | null | undefined): string { return ((Number(min) || 0) / 60).toFixed(2); }
  /** A day's status in words: "On time", "Late", "Adjusted", "Missing clock-out" (the legacy wording). */
  tagText(v: string): string {
    const key = 'REPORTS.ATTENDANCE.DAY_STATUS.' + String(v ?? '');
    const t = this.lang.instant(key);
    if (t !== key) return t;
    const h = String(v ?? '').replace(/[_-]+/g, ' ').trim();
    return h ? h.charAt(0).toUpperCase() + h.slice(1) : '-';
  }
}
