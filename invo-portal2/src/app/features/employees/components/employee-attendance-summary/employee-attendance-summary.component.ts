import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ApiService } from '@core/http/api.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';

type DayStatus = 'on_time' | 'late' | 'missing_out' | 'adjusted' | 'absent' | 'leave' | 'none';
type Period = '7' | '30' | '90' | 'month';

interface DayCell { date: string; status: DayStatus; tip: string; }

/** Same permission the Reports catalog gates the Attendance report on. */
const ATTENDANCE_REPORT_PERMISSION = 'reportsSecurity.actions.AttendenceReport.access';

const pad = (n: number) => String(n).padStart(2, '0');
/** 'HH:mm' (local) from an ISO timestamp; '' when absent. */
const hhmm = (v: any): string => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Attendance at a glance for the employee record: stat tiles, a
 * one-block-per-day strip and the punctuality score, for a chosen period. Reads
 * two existing report endpoints — `attendance/employeeDetail` and
 * `attendance/scorecard` — scoped to this employee. Renders nothing when the
 * viewer lacks the report grant.
 */
@Component({
  selector: 'app-employee-attendance-summary',
  standalone: true,
  imports: [TranslateModule, RouterLink, SegmentedToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-attendance-summary.component.html',
  styleUrl: './employee-attendance-summary.component.scss',
})
export class EmployeeAttendanceSummaryComponent implements OnInit {
  private api = inject(ApiService);
  private privileges = inject(PrivilegeService);
  private translate = inject(TranslateService);

  readonly employeeId = input.required<string>();

  readonly periodOptions: SegmentedToggleOption<Period>[] = [
    { value: '7', label: 'EMPLOYEES.ATTENDANCE_SUMMARY.P_7' },
    { value: '30', label: 'EMPLOYEES.ATTENDANCE_SUMMARY.P_30' },
    { value: '90', label: 'EMPLOYEES.ATTENDANCE_SUMMARY.P_90' },
    { value: 'month', label: 'EMPLOYEES.ATTENDANCE_SUMMARY.P_MONTH' },
  ];

  readonly period = signal<Period>('30');
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly summary = signal<any | null>(null);
  readonly days = signal<DayCell[]>([]);
  readonly score = signal<{ value: number; rating: string } | null>(null);
  /** The scorecard row — knows the schedule even when nothing was punched. */
  readonly card = signal<any | null>(null);
  /** Overtime / late-and-early rows for this employee (each report filters by employeeId). */
  readonly overtime = signal<any | null>(null);
  readonly lateEarly = signal<any | null>(null);
  /** Raw per-day records, keyed by date, for the click-to-open day panel. */
  private dayInfo = signal<Map<string, { hit?: any; gap?: any }>>(new Map());
  readonly selectedDate = signal<string | null>(null);
  readonly adjustmentList = signal<any[]>([]);
  readonly showAdjustments = signal(false);

  readonly selected = computed(() => {
    const d = this.selectedDate();
    if (!d) return null;
    const info = this.dayInfo().get(d);
    if (!info?.hit && !info?.gap) return { date: d, hit: null, gap: null };
    return { date: d, hit: info.hit ?? null, gap: info.gap ?? null };
  });

  readonly allowed = computed(() => this.privileges.check(ATTENDANCE_REPORT_PERMISSION));
  readonly hasData = computed(() =>
    (this.summary()?.daysPresent ?? 0) > 0 || (this.card()?.scheduledDays ?? 0) > 0);
  readonly present = computed<number>(() => this.card()?.attendedDays ?? this.summary()?.daysPresent ?? 0);
  readonly scheduled = computed<number>(() => this.card()?.scheduledDays ?? this.summary()?.daysScheduled ?? 0);
  readonly absences = computed<number>(() => this.card()?.unauthAbsenceDays ?? 0);
  readonly late = computed<number>(() => this.summary()?.lateArrivals ?? 0);
  readonly missingOut = computed<number>(() => this.summary()?.missingClockOuts ?? 0);
  readonly hours = computed(() => this.summary()?.totalHours ?? 0);
  readonly overtimeHours = computed<number>(() => Number(this.overtime()?.overtimeHours) || 0);
  readonly lateMinutes = computed<number>(() => Number(this.lateEarly()?.totalMinutesLate) || 0);
  readonly earlyCount = computed<number>(() => Number(this.lateEarly()?.earlyOutCount) || 0);
  readonly avgLate = computed<number>(() => Number(this.lateEarly()?.avgMinutesLate) || 0);
  readonly worstLate = computed<number>(() => Number(this.lateEarly()?.worstLateMinutes) || 0);
  readonly adjustments = computed<number>(() => this.summary()?.adjustmentCount ?? 0);
  /** Why the punctuality score is what it is — the scorecard's own inputs. */
  readonly breakdown = computed(() => {
    const c = this.card();
    if (!c) return null;
    return {
      onTimePct: c.onTimePct ?? 0,
      noAbsencePct: c.noUnauthAbsencePct ?? 0,
      missedPunches: c.missedPunches ?? 0,
      ratingKey: 'EMPLOYEES.ATTENDANCE_SUMMARY.RATING_' + String(c.rating ?? '').toUpperCase(),
    };
  });
  readonly emptyKey = computed(() => this.failed()
    ? 'EMPLOYEES.ATTENDANCE_SUMMARY.FAILED'
    : 'EMPLOYEES.ATTENDANCE_SUMMARY.EMPTY');

  ngOnInit(): void { void this.load(); }

  /** Local 'HH:mm' of an ISO timestamp. */
  time(v: any): string { return hhmm(v); }

  toggleDay(date: string): void {
    this.selectedDate.set(this.selectedDate() === date ? null : date);
  }

  /** The photo URL is only shown when it is a real absolute/data URL. */
  photo(url: any): string | null {
    return typeof url === 'string' && /^(https?:|data:)/.test(url) ? url : null;
  }

  setPeriod(p: Period): void {
    if (p === this.period()) return;
    this.period.set(p);
    void this.load();
  }

  private range(): { from: Date; to: Date } {
    const to = new Date();
    const p = this.period();
    const from = new Date();
    if (p === 'month') from.setDate(1);
    else from.setDate(to.getDate() - (Number(p) - 1));
    return { from, to };
  }

  private async load(): Promise<void> {
    if (!this.allowed() || !this.employeeId()) { this.loading.set(false); return; }
    this.loading.set(true);
    const { from, to } = this.range();
    const filter = { employeeId: this.employeeId(), fromDate: ymd(from), toDate: ymd(to) };

    try {
      const [detail, card, absence, ot, le] = await Promise.all([
        this.api.request<any>(this.api.post('accounts/reports/attendance/employeeDetail', { filter })).catch(() => null),
        this.api.request<any>(this.api.post('accounts/reports/attendance/scorecard', { filter })).catch(() => null),
        this.api.request<any>(this.api.post('accounts/reports/attendance/absence', { filter: { ...filter, limit: 500, page: 1 } })).catch(() => null),
        this.api.request<any>(this.api.post('accounts/reports/attendance/overtime', { filter })).catch(() => null),
        this.api.request<any>(this.api.post('accounts/reports/attendance/lateAndEarly', { filter })).catch(() => null),
      ]);
      this.overtime.set(ot?.success ? ot.data?.list?.[0] ?? null : null);
      this.lateEarly.set(le?.success ? le.data?.list?.[0] ?? null : null);

      this.failed.set(!detail?.success);
      const d = detail?.success ? detail.data : null;
      this.summary.set(d?.summary ?? null);

      const byDate = new Map<string, any>((d?.days ?? []).map((x: any) => [String(x.date).slice(0, 10), x]));

      // The absence report returns RANGES (consecutive days of one type);
      // expand them so each missed day can be coloured on the strip.
      const gaps = new Map<string, any>();
      for (const r of (absence?.success ? absence.data?.list ?? [] : [])) {
        const end = new Date(`${String(r.endDate).slice(0, 10)}T00:00:00`);
        for (let c = new Date(`${String(r.startDate).slice(0, 10)}T00:00:00`); c <= end; c.setDate(c.getDate() + 1)) {
          gaps.set(ymd(c), r);
        }
      }

      const t = (k: string) => this.translate.instant('EMPLOYEES.ATTENDANCE_SUMMARY.' + k);
      const label: Record<string, string> = {
        on_time: t('ON_TIME'), late: t('LATE'), missing_out: t('MISSING_OUT'), adjusted: t('ADJUSTED'),
      };
      const count = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
      const cells: DayCell[] = [];
      for (let i = 0; i < count; i++) {
        const day = new Date(from);
        day.setDate(from.getDate() + i);
        const key = ymd(day);
        const hit = byDate.get(key);
        const gap = gaps.get(key);
        if (hit) {
          const inn = hhmm(hit.clockedInEff), out = hhmm(hit.clockedOutEff);
          const sched = hit.expectedStartLocal ? ` · ${t('SCHEDULED')} ${hit.expectedStartLocal}–${hit.expectedEndLocal ?? ''}` : '';
          cells.push({
            date: key, status: hit.status as DayStatus,
            tip: `${key} · ${label[hit.status] ?? ''} · ${inn}${out ? '–' + out : ''} · ${((hit.workedMinutes ?? 0) / 60).toFixed(1)}h${sched}`,
          });
        } else if (gap) {
          const leave = gap.absenceType === 'authorized';
          const win = gap.expectedStartLocal ? ` · ${t('SCHEDULED')} ${gap.expectedStartLocal}–${gap.expectedEndLocal ?? ''}` : '';
          cells.push({
            date: key, status: leave ? 'leave' : 'absent',
            tip: `${key} · ${leave ? (gap.leaveTypeRaw || t('LEAVE')) : t('ABSENT')}${win}`,
          });
        } else {
          cells.push({ date: key, status: 'none', tip: key });
        }
      }
      this.days.set(cells);
      const info = new Map<string, { hit?: any; gap?: any }>();
      for (const c of cells) info.set(c.date, { hit: byDate.get(c.date), gap: gaps.get(c.date) });
      this.dayInfo.set(info);
      if (this.selectedDate() && !info.has(this.selectedDate()!)) this.selectedDate.set(null);
      this.adjustmentList.set(d?.adjustments ?? []);

      const row = card?.success ? card.data?.list?.[0] : null;
      this.card.set(row ?? null);
      this.score.set(row && typeof row.compositeScore === 'number'
        ? { value: row.compositeScore, rating: row.rating }
        : null);
    } finally {
      this.loading.set(false);
    }
  }

}
