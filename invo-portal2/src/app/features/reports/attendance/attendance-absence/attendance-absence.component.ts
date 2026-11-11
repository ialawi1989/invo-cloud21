import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { ReportNoteComponent } from '../../components/report-note/report-note.component';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportApiFilter } from '../../models/report.model';
import { AbsenceData, AbsenceRow, AttendanceService } from '../attendance.service';

/**
 * Absence: unauthorized absences (nobody approved the day off — the ones that need attention) in a red section, authorized absences
 * and leave (with their type and reason) in a blue one. Consecutive days are one row with the period and the number of days.
 */
@Component({
  selector: 'app-attendance-absence',
  standalone: true,
  imports: [TranslateModule, DatePipe, RouterLink, PaginationComponent, ReportEmptyComponent, ReportErrorComponent, ReportNoteComponent],
  templateUrl: './attendance-absence.component.html',
  styleUrl: './attendance-absence.component.scss',
})
export class AttendanceAbsenceComponent {
  private svc = inject(AttendanceService);
  private lang = inject(LanguageService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly sizes = [10, 25, 50, 100];
  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<AbsenceData | null>(null);
  page = signal(1);
  pageSize = signal(25);
  unauthorized = computed(() => (this.data()?.rows ?? []).filter(r => r.absenceType === 'unauthorized'));
  authorized = computed(() => (this.data()?.rows ?? []).filter(r => r.absenceType === 'authorized'));
  private seq = 0;
  private prevKey = '';

  constructor() {
    effect(() => {
      const key = JSON.stringify(this.filter());
      this.refresh();
      untracked(() => {
        if (this.prevKey && this.prevKey !== key) this.page.set(1);
        this.prevKey = key;
        void this.load();
      });
    });
  }

  async load(): Promise<void> {
    const mine = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const d = await this.svc.absence(this.filter(), this.page(), this.pageSize());
      if (mine === this.seq) this.data.set(d);
    } catch (e: any) {
      if (mine !== this.seq) return;
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.data.set(null);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  goTo(p: number): void { this.page.set(p); void this.load(); }
  setPageSize(n: number): void { this.pageSize.set(n); this.page.set(1); void this.load(); }

  /** Where a name opens: that employee's Attendance Detail for the same period and branches. */
  detailQuery(r: AbsenceRow): Record<string, string | null> {
    const f = this.filter();
    return { preset: 'custom', fromDate: f.fromDate ?? null, toDate: f.toDate ?? null, branches: f.branches?.length ? f.branches.join(',') : null, employee: r.employeeId };
  }
}
