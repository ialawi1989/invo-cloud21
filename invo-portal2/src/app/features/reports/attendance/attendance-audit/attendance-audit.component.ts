import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportApiFilter } from '../../models/report.model';
import { AttendanceService, AuditActor, AuditData, AuditRow } from '../attendance.service';
import { ReportSkeletonComponent } from '../../components/report-skeleton/report-skeleton.component';

/**
 * Adjustments Audit: every clock-in / clock-out that was changed — the original time struck through beside the new one — with who changed
 * it, and the managers who adjusted the most. Clicking a manager narrows the list to their adjustments (click again to clear).
 */
@Component({
  selector: 'app-attendance-audit',
  standalone: true,
  imports: [ReportSkeletonComponent, TranslateModule, DatePipe, PaginationComponent, ReportEmptyComponent, ReportErrorComponent],
  templateUrl: './attendance-audit.component.html',
  styleUrl: './attendance-audit.component.scss',
})
export class AttendanceAuditComponent {
  private svc = inject(AttendanceService);
  private lang = inject(LanguageService);

  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly sizes = [10, 25, 50, 100];
  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<AuditData | null>(null);
  page = signal(1);
  pageSize = signal(25);
  /** The manager chosen in the side list (their id); empty = every manager. */
  actorId = signal('');
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
      const f: ReportApiFilter = { ...this.filter() };
      if (this.actorId()) (f as Record<string, unknown>)['adjustedBy'] = this.actorId();
      const d = await this.svc.audit(f, this.page(), this.pageSize());
      if (mine === this.seq) this.data.set(d);
    } catch (e: any) {
      if (mine !== this.seq) return;
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.data.set(null);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  selectActor(a: AuditActor): void {
    this.actorId.set(this.actorId() === a.managerId ? '' : a.managerId);
    this.page.set(1);
    void this.load();
  }
  clearActor(): void { this.actorId.set(''); this.page.set(1); void this.load(); }
  goTo(p: number): void { this.page.set(p); void this.load(); }
  setPageSize(n: number): void { this.pageSize.set(n); this.page.set(1); void this.load(); }
  count(a: AuditActor): number { return Number(a.adjustmentCount) || 0; }

  /** The subject also made the adjustment themself. */
  isSelfEdit(r: AuditRow): boolean {
    const s = (r.subjectName ?? '').trim().toLowerCase();
    return !!s && (s === (r.adjClockedInByName ?? '').trim().toLowerCase() || s === (r.adjClockedOutByName ?? '').trim().toLowerCase());
  }
}
