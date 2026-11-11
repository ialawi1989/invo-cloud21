import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '@core/http/api.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DropdownLoadParams, DropdownLoadResult } from '@shared/components/dropdown/search-dropdown.types';
import { DateFieldComponent } from '@shared/components/date-field/date-field.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { TimePickerComponent } from '@shared/components/time-picker/time-picker.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { FormsModule } from '@angular/forms';
import { ScheduleAttachment, ScheduleCaps, ScheduledReport, ScheduleFrequency } from '../../models/report-schedule';
import { pickIds } from '../../utils/dropdown-values';
import { ReportScheduleService } from '../../services/report-schedule.service';

export interface ReportScheduleModalData {
  /** The scheduler's type of the report. */
  type: string;
  /** i18n key of the report's title (shown in the header). */
  titleKey: string;
  caps: ScheduleCaps;
  branches: { value: string; label: string }[];
  /** The schedule to edit; `null` to create one. */
  schedule: ScheduledReport | null;
}
/** What the dialog closed with — the page reloads its schedules after either. */
export type ReportScheduleModalResult = 'saved' | 'deleted';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * "Schedule report" dialog — when the report is e-mailed (frequency, start date, time), what it runs with (branches,
 * comparison, "as of"), who receives it (employees + extra e-mail addresses), PDF or Excel, and whether it is active.
 */
@Component({
  selector: 'app-report-schedule-modal',
  standalone: true,
  imports: [TranslateModule, DatePipe, FormsModule, SearchDropdownComponent, DateFieldComponent, SegmentedToggleComponent, TimePickerComponent],
  templateUrl: './report-schedule-modal.component.html',
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; height: 100%; }
    input[type='radio'], input[type='checkbox'] { accent-color: #167d8f; }
  `],
})
export class ReportScheduleModalComponent {
  readonly data = inject<ReportScheduleModalData>(MODAL_DATA);
  private ref = inject<ModalRef<ReportScheduleModalResult>>(MODAL_REF);
  private svc = inject(ReportScheduleService);
  private api = inject(ApiService);
  private toast = inject(ToastService);

  /** The dropdown's two-way value is its item objects — keep only their ids. */
  readonly ids = pickIds;
  readonly isEdit = !!this.data.schedule?.id;
  readonly today = todayIso();

  frequency = signal<ScheduleFrequency>('daily');
  startDate = signal<string | null>(this.today);
  time = signal<string>('00:00');
  asOf = signal(true);
  branchIds = signal<string[]>([]);
  compareOn = signal(false);
  comparePeriod = signal<'Month' | 'Year'>('Month');
  compareQty = signal(1);
  recipientIds = signal<string[]>([]);
  emails = signal<string[]>([]);
  emailDraft = signal('');
  emailError = signal(false);
  attachment = signal<ScheduleAttachment>('pdf');
  active = signal(true);
  previousRun = signal<string | null>(null);
  nextRun = signal<string | null>(null);
  saving = signal(false);
  confirmingDelete = signal(false);
  loading = signal(this.isEdit);

  readonly frequencyOptions: SegmentedToggleOption<ScheduleFrequency>[] = [
    { value: 'daily', label: 'REPORTS.SCHEDULE.DAILY' }, { value: 'weekly', label: 'REPORTS.SCHEDULE.WEEKLY' },
    { value: 'monthly', label: 'REPORTS.SCHEDULE.MONTHLY' }, { value: 'yearly', label: 'REPORTS.SCHEDULE.YEARLY' },
  ];
  readonly attachOptions: SegmentedToggleOption<ScheduleAttachment>[] = [
    { value: 'pdf', label: 'REPORTS.SCHEDULE.PDF' }, { value: 'xlsx', label: 'REPORTS.SCHEDULE.XLSX' },
  ];
  readonly statusOptions: SegmentedToggleOption<'active' | 'inactive'>[] = [
    { value: 'active', label: 'REPORTS.SCHEDULE.ACTIVE' }, { value: 'inactive', label: 'REPORTS.SCHEDULE.INACTIVE' },
  ];
  readonly rangeOptions: SegmentedToggleOption<'asOf' | 'range'>[] = [
    { value: 'asOf', label: 'REPORTS.SCHEDULE.AS_OF' }, { value: 'range', label: 'REPORTS.SCHEDULE.RANGE' },
  ];
  readonly compareOptions: SegmentedToggleOption<'off' | 'on'>[] = [
    { value: 'off', label: 'REPORTS.SCHEDULE.NO_COMPARISON' }, { value: 'on', label: 'REPORTS.SCHEDULE.COMPARE_PREVIOUS' },
  ];
  readonly periodOptions: SegmentedToggleOption<'Month' | 'Year'>[] = [
    { value: 'Month', label: 'REPORTS.SCHEDULE.MONTHS' }, { value: 'Year', label: 'REPORTS.SCHEDULE.YEARS' },
  ];

  readonly hint = computed(() => 'REPORTS.SCHEDULE.HINT_' + this.frequency().toUpperCase());
  readonly noRecipient = computed(() => this.recipientIds().length === 0 && this.emails().length === 0);
  canSave = computed(() => !this.saving() && !this.loading() && !!this.startDate() && !!this.time() && !this.noRecipient());

  // ── Branch / employee pickers (the same server-paged dropdown the filters dialog uses) ─────────────
  readonly loadBranches = async (p: DropdownLoadParams): Promise<DropdownLoadResult<{ value: string; label: string }>> => {
    const q = (p.search ?? '').trim().toLowerCase();
    const all = q ? this.data.branches.filter(b => b.label.toLowerCase().includes(q)) : this.data.branches;
    const from = (p.page - 1) * p.pageSize;
    return { items: all.slice(from, from + p.pageSize), hasMore: from + p.pageSize < all.length };
  };
  readonly branchLabel = (b: { value: string; label: string }) => b.label;
  readonly branchValue = (b: { value: string; label: string }) => b.value;
  readonly sameBranch = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);

  /** Employees, a page at a time; the chosen ones are always included on the first page so they show their names. */
  readonly loadEmployees = async (p: DropdownLoadParams): Promise<DropdownLoadResult<{ id: string; name: string }>> => {
    try {
      const res = await this.api.request<any>(this.api.post('employee/getEmployeeList', {
        page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {},
        ...(p.page === 1 && !p.search && this.recipientIds().length ? { employeeIds: this.recipientIds() } : {}),
      }));
      const rows: any[] = res?.data?.list ?? [];
      const pageCount = Number(res?.data?.pageCount ?? 1);
      return { items: rows.map(r => ({ id: r.id ?? '', name: r.name ?? '' })).filter(r => !!r.id), hasMore: p.page < pageCount };
    } catch { return { items: [], hasMore: false }; }
  };
  readonly employeeLabel = (e: { id: string; name: string }) => e.name;
  readonly employeeId = (e: { id: string; name: string }) => e.id;
  readonly sameEmployee = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);

  constructor() {
    if (this.data.schedule) this.fill(this.data.schedule);
    // An existing schedule is read again for its full settings (the list only carries the summary).
    if (this.isEdit) {
      void this.svc.getById(this.data.schedule!.id).then(full => { if (full) this.fill(full); }).catch(() => { /* keep the summary */ })
        .finally(() => this.loading.set(false));
    }
  }

  private fill(s: ScheduledReport): void {
    this.frequency.set(s.frequency || 'daily');
    this.startDate.set(s.startDate ? String(s.startDate).slice(0, 10) : this.today);
    this.time.set((s.scheduleTime || '00:00').slice(0, 5));
    this.recipientIds.set(s.recipients ?? []);
    this.emails.set(s.additionalRecipients ?? []);
    this.attachment.set(s.attachmentType || 'pdf');
    this.active.set(s.isActive !== false);
    this.previousRun.set(s.previousRun);
    this.nextRun.set(s.nextRun);
    const f = s.filter ?? {};
    this.branchIds.set(Array.isArray(f['branches']) ? f['branches'] : f['branchId'] ? [f['branchId']] : []);
    const cmp = f['allowComparison'] === true || (typeof f['compareType'] === 'string' && f['compareType'].toLowerCase() !== 'none');
    this.compareOn.set(!!cmp);
    const period = f['compareWith'] ?? f['period'];
    this.comparePeriod.set(period === 'Year' ? 'Year' : 'Month');
    this.compareQty.set(Math.max(1, Number(f['periodQty']) || 1));
    this.asOf.set(f['asOfChoosed'] !== undefined ? !!f['asOfChoosed'] : f['allowAsOf'] !== undefined ? !!f['allowAsOf'] : true);
  }

  // ── e-mail chips ────────────────────────────────────────────────────────────────────────────────────
  addEmail(): void {
    const v = this.emailDraft().trim();
    if (!v) return;
    if (!EMAIL.test(v)) { this.emailError.set(true); return; }
    if (!this.emails().includes(v)) this.emails.update(l => [...l, v]);
    this.emailDraft.set('');
    this.emailError.set(false);
  }
  removeEmail(e: string): void { this.emails.update(l => l.filter(x => x !== e)); }

  setQty(v: string | number): void { this.compareQty.set(Math.min(60, Math.max(1, Math.floor(Number(v)) || 1))); }

  // ── actions ─────────────────────────────────────────────────────────────────────────────────────────
  cancel(): void { this.ref.dismiss(); }

  private filterBody(): Record<string, any> {
    const f: Record<string, any> = {};
    if (this.data.caps.branches && this.branchIds().length) f['branches'] = this.branchIds();
    if (this.data.caps.comparison) {
      if (this.compareOn()) {
        Object.assign(f, { allowComparison: true, compareType: 'Period', compareWith: this.comparePeriod(), period: this.comparePeriod(), periodQty: this.compareQty() });
      } else {
        Object.assign(f, { allowComparison: false, compareType: 'none', periodQty: 1 });
      }
    }
    if (this.data.caps.asOfOptional) Object.assign(f, { allowAsOf: this.asOf(), asOfChoosed: this.asOf() });
    return f;
  }

  async save(): Promise<void> {
    this.addEmail();
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      await this.svc.save({
        id: this.data.schedule?.id || undefined,
        reportType: this.data.type,
        frequency: this.frequency(),
        startDate: this.startDate()!,
        scheduleTime: this.time(),
        recipients: this.recipientIds(),
        additionalRecipients: this.emails(),
        attachmentType: this.attachment(),
        isActive: this.active(),
        filter: this.filterBody(),
      } as any);
      this.toast.success('REPORTS.SCHEDULE.SAVED');
      this.ref.close('saved');
    } catch (e: any) {
      this.toast.error('REPORTS.SCHEDULE.SAVE_ERROR', e?.message ?? '');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    if (!this.confirmingDelete()) { this.confirmingDelete.set(true); return; }
    this.saving.set(true);
    try {
      await this.svc.remove(this.data.schedule!.id);
      this.toast.success('REPORTS.SCHEDULE.DELETED');
      this.ref.close('deleted');
    } catch (e: any) {
      this.toast.error('REPORTS.SCHEDULE.SAVE_ERROR', e?.message ?? '');
      this.confirmingDelete.set(false);
    } finally {
      this.saving.set(false);
    }
  }
}
