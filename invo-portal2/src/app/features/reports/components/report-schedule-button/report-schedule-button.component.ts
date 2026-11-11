import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ModalService } from '@shared/modal/modal.service';
import { ScheduledReport, scheduleCapsFor, scheduleTypeFor } from '../../models/report-schedule';
import { ReportScheduleService } from '../../services/report-schedule.service';
import {
  ReportScheduleModalComponent, ReportScheduleModalData, ReportScheduleModalResult,
} from '../report-schedule-modal/report-schedule-modal.component';

/**
 * The calendar button in a report's action bar: lists the report's saved schedules (frequency, active / inactive,
 * previous and next run) and opens the schedule dialog to create or edit one. Shown only for the reports the backend
 * scheduler can run.
 */
@Component({
  selector: 'app-report-schedule-button',
  standalone: true,
  imports: [TranslateModule, DatePipe],
  templateUrl: './report-schedule-button.component.html',
  styleUrl: './report-schedule-button.component.scss',
})
export class ReportScheduleButtonComponent {
  private svc = inject(ReportScheduleService);
  private modal = inject(ModalService);

  /** The report's slug in the catalog. */
  slug = input.required<string>();
  /** i18n key of the report's title (shown in the dialog). */
  titleKey = input.required<string>();
  /** The company's branches, for the dialog's branch filter. */
  branches = input<{ value: string; label: string }[]>([]);

  /** The scheduler's type of this report; `null` → it can't be scheduled and the button is not shown. */
  type = computed(() => scheduleTypeFor(this.slug()));
  schedules = signal<ScheduledReport[]>([]);
  open = signal(false);
  loading = signal(false);

  active = computed(() => this.schedules().filter(s => s.isActive));
  /** Only inactive schedules exist — shown as a grey dot instead of the count. */
  onlyInactive = computed(() => this.schedules().length > 0 && this.active().length === 0);

  private seq = 0;

  constructor() {
    effect(() => {
      const t = this.type();
      untracked(() => { this.schedules.set([]); this.open.set(false); if (t) void this.load(t); });
    });
  }

  async load(t = this.type()): Promise<void> {
    if (!t) return;
    const mine = ++this.seq;
    this.loading.set(true);
    try {
      const list = await this.svc.listByType(t);
      if (mine === this.seq) this.schedules.set(list);
    } catch {
      if (mine === this.seq) this.schedules.set([]);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  toggle(): void { this.open.update(o => !o); }

  async edit(schedule: ScheduledReport | null): Promise<void> {
    const type = this.type();
    if (!type) return;
    this.open.set(false);
    const ref = this.modal.open<ReportScheduleModalComponent, ReportScheduleModalData, ReportScheduleModalResult>(
      ReportScheduleModalComponent, {
        size: 'md',
        closeOnBackdrop: false,
        data: { type, titleKey: this.titleKey(), caps: scheduleCapsFor(this.slug()), branches: this.branches(), schedule },
      });
    const r = await ref.afterClosed();
    if (r) await this.load(type);
  }
}
