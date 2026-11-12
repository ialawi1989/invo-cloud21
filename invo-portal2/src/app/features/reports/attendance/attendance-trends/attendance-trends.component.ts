import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportApiFilter } from '../../models/report.model';
import { AttendanceService, TrendsData } from '../attendance.service';
import { ReportSkeletonComponent } from '../../components/report-skeleton/report-skeleton.component';

/** Day statuses in legend order. */
const STATUSES = ['present', 'late', 'adjusted', 'absent', 'leave', 'off', 'not_employed'] as const;

/**
 * Attendance Trends & Heatmap: a row per employee, a cell per day of the period, coloured by what happened that day (present, late,
 * adjusted, absent, on leave, day off, not yet hired / already left).
 */
@Component({
  selector: 'app-attendance-trends',
  standalone: true,
  imports: [ReportSkeletonComponent, TranslateModule, ReportEmptyComponent, ReportErrorComponent],
  templateUrl: './attendance-trends.component.html',
  styleUrl: './attendance-trends.component.scss',
})
export class AttendanceTrendsComponent {
  private svc = inject(AttendanceService);
  private lang = inject(LanguageService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly statuses = STATUSES;
  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<TrendsData | null>(null);
  isEmpty = computed(() => !!this.data() && this.data()!.employees.length === 0);
  /** Per status, how many cells of the period — shown beside the legend. */
  counts = computed(() => {
    const c: Record<string, number> = {};
    for (const e of this.data()?.employees ?? []) for (const s of e.statuses) c[s] = (c[s] ?? 0) + 1;
    return c;
  });

  private seq = 0;

  constructor() {
    effect(() => {
      JSON.stringify(this.filter());
      this.refresh();
      untracked(() => void this.load());
    });
  }

  async load(): Promise<void> {
    const mine = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const d = await this.svc.trends(this.filter());
      if (mine === this.seq) this.data.set(d);
    } catch (e: any) {
      if (mine !== this.seq) return;
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.data.set(null);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  /** The letter inside a cell (the legacy heatmap's): Present, Late, Absent, Vacation/leave, Edited, – for a day off. */
  letter(status: string): string {
    return ({ present: 'P', late: 'L', absent: 'A', leave: 'V', adjusted: 'E', off: '–' } as Record<string, string>)[status] ?? '';
  }
  /** "2025-03-07" → "07/03" (written upright-sideways in the header). */
  label(d: string): string { return `${d.slice(8, 10)}/${d.slice(5, 7)}`; }
  /** The day of the month ("2025-03-07" → 7). */
  day(d: string): string { return String(Number(d.slice(8, 10))); }
  /** A short weekday initial for the header's tooltip. */
  title(d: string, status: string): string { return `${d} · ${this.lang.instant('REPORTS.ATTENDANCE.STATUS.' + status)}`; }
}
