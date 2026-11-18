import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { DateFieldComponent } from '@shared/components/date-field/date-field.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ListSkeletonComponent } from '@shared/components/skeleton/list-skeleton.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { ModalRef, ModalService } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ALL_REPORTS } from '../../models/report-catalog';
import { ReportMeta } from '../../models/report.model';
import { ScheduledListItem, scheduleCapsFor, scheduleTypeFor } from '../../models/report-schedule';
import { ReportScheduleService, ScheduledListFilter } from '../../services/report-schedule.service';
import {
  ReportScheduleModalComponent, ReportScheduleModalData, ReportScheduleModalResult,
} from '../report-schedule-modal/report-schedule-modal.component';

/** One schedule of the list with the portal report it belongs to (null when that report is no longer in the catalog). */
interface Row { item: ScheduledListItem; report: ReportMeta | null; }

type Status = 'all' | 'active' | 'inactive';
type Frequency = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly';

const PAGE_SIZE = 20;
/** Full path of the "Edit Scheduled Reports" privilege (Reports Security). */
const EDIT_PRIVILEGE = 'reportsSecurity.actions.EditScheduledReports.access';

/** scheduler type -> the portal report that runs it (the reverse of `scheduleTypeFor`). */
const REPORT_BY_TYPE = (() => {
  const map = new Map<string, ReportMeta>();
  for (const r of ALL_REPORTS) {
    const t = scheduleTypeFor(r.slug);
    if (t && !map.has(t)) map.set(t, r);
  }
  return map;
})();

/**
 * Every scheduled report of the company in one list, opened as a side drawer from the reports page (the legacy "Scheduled Reports"
 * drawer). Search and filters are sent to the backend; the list is paged with "Load more" as the backend only says whether a next
 * page exists. Edit opens the same schedule dialog the report page uses.
 */
@Component({
  selector: 'app-scheduled-reports-drawer',
  standalone: true,
  imports: [DatePipe, FormsModule, TranslateModule, DateFieldComponent, EmptyStateComponent, ListSkeletonComponent, SegmentedToggleComponent, TooltipDirective],
  templateUrl: './scheduled-reports-drawer.component.html',
  styleUrl: './scheduled-reports-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduledReportsDrawerComponent {
  private svc = inject(ReportScheduleService);
  private modal = inject(ModalService);
  private ref = inject<ModalRef<void>>(MODAL_REF);
  private router = inject(Router);
  private toast = inject(ToastService);
  private privileges = inject(PrivilegeService);

  readonly canEdit = this.privileges.check(EDIT_PRIVILEGE);

  rows = signal<Row[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  failed = signal(false);
  hasNext = signal(false);

  /** What is typed in the box; `searchTerm` is the debounced one that is sent. */
  searchInput = signal('');
  private searchTerm = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  showFilters = signal(false);
  status = signal<Status>('all');
  frequency = signal<Frequency>('all');
  nextFrom = signal<string | null>(null);
  nextTo = signal<string | null>(null);
  prevFrom = signal<string | null>(null);
  prevTo = signal<string | null>(null);
  /** The row waiting for its delete to be confirmed. */
  confirmingDelete = signal<Row | null>(null);

  private page = 1;
  private seq = 0;

  readonly statusOptions: SegmentedToggleOption<Status>[] = [
    { value: 'all', label: 'REPORTS.SCHEDULE_LIST.ALL' },
    { value: 'active', label: 'REPORTS.SCHEDULE.ACTIVE' },
    { value: 'inactive', label: 'REPORTS.SCHEDULE.INACTIVE' },
  ];
  readonly frequencyOptions: SegmentedToggleOption<Frequency>[] = [
    { value: 'all', label: 'REPORTS.SCHEDULE_LIST.ALL' },
    { value: 'daily', label: 'REPORTS.SCHEDULE.DAILY' },
    { value: 'weekly', label: 'REPORTS.SCHEDULE.WEEKLY' },
    { value: 'monthly', label: 'REPORTS.SCHEDULE.MONTHLY' },
    { value: 'yearly', label: 'REPORTS.SCHEDULE.YEARLY' },
  ];

  activeFilterCount = computed(() =>
    [this.status() !== 'all', this.frequency() !== 'all', !!this.nextFrom(), !!this.nextTo(), !!this.prevFrom(), !!this.prevTo()]
      .filter(Boolean).length);
  hasSearchOrFilters = computed(() => !!this.searchInput().trim() || this.activeFilterCount() > 0);

  constructor() { void this.load(); }

  onSearch(v: string): void {
    this.searchInput.set(v);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const term = v.trim();
      if (term === this.searchTerm) return;
      this.searchTerm = term;
      void this.load();
    }, 400);
  }

  clearSearch(): void {
    if (this.timer) clearTimeout(this.timer);
    this.searchInput.set('');
    this.searchTerm = '';
    void this.load();
  }

  toggleFilters(): void { this.showFilters.update(v => !v); }

  setStatus(v: Status): void { this.status.set(v); void this.load(); }
  setFrequency(v: Frequency): void { this.frequency.set(v); void this.load(); }
  setRange(which: 'nextFrom' | 'nextTo' | 'prevFrom' | 'prevTo', v: string | null): void {
    this[which].set(v);
    void this.load();
  }

  clearFilters(): void {
    this.status.set('all');
    this.frequency.set('all');
    this.nextFrom.set(null); this.nextTo.set(null); this.prevFrom.set(null); this.prevTo.set(null);
    void this.load();
  }

  /** Only the filters that are set; undefined (nothing sent) when none is. */
  private filter(): ScheduledListFilter | undefined {
    const f: ScheduledListFilter = {};
    if (this.status() !== 'all') f.isActive = this.status() === 'active';
    if (this.frequency() !== 'all') f.frequency = this.frequency();
    if (this.nextFrom()) f.nextRunFrom = this.nextFrom()!;
    if (this.nextTo()) f.nextRunTo = this.nextTo()!;
    if (this.prevFrom()) f.previousRunFrom = this.prevFrom()!;
    if (this.prevTo()) f.previousRunTo = this.prevTo()!;
    return Object.keys(f).length ? f : undefined;
  }

  /** First page (replaces the list): on open, after a search / filter change and after an edit. */
  async load(): Promise<void> { this.page = 1; await this.fetch(false); }

  async loadMore(): Promise<void> {
    if (!this.hasNext() || this.loading() || this.loadingMore()) return;
    this.page += 1;
    await this.fetch(true);
  }

  private async fetch(append: boolean): Promise<void> {
    const mine = ++this.seq;
    if (append) {
      this.loadingMore.set(true);
    } else {
      this.loading.set(true);
      this.failed.set(false);
      this.confirmingDelete.set(null);
    }
    try {
      const res = await this.svc.listAll({ page: this.page, limit: PAGE_SIZE, searchTerm: this.searchTerm, filter: this.filter() });
      if (mine !== this.seq) return;
      const rows = res.list.map((item): Row => ({ item, report: REPORT_BY_TYPE.get(item.reportType) ?? null }));
      this.rows.update(prev => (append ? [...prev, ...rows] : rows));
      this.hasNext.set(res.hasNext);
    } catch {
      if (mine !== this.seq) return;
      if (append) {
        this.page -= 1; // let the user retry the same page
      } else {
        this.rows.set([]);
        this.hasNext.set(false);
        this.failed.set(true);
      }
    } finally {
      if (mine === this.seq) { this.loading.set(false); this.loadingMore.set(false); }
    }
  }

  openReport(row: Row): void {
    if (!row.report) return;
    this.ref.dismiss();
    void this.router.navigate(['/reports/view', row.report.slug]);
  }

  async edit(row: Row): Promise<void> {
    if (!this.canEdit || !row.report) return;
    const type = scheduleTypeFor(row.report.slug);
    if (!type) return;
    // The list rows are summaries without an id: find the full schedule among the ones of this type.
    const full = await this.svc.resolveFull(row.item).catch(() => null);
    if (!full) { this.toast.error('REPORTS.SCHEDULE_LIST.LOAD_ONE_FAILED'); return; }
    const branches = await this.svc.branches();
    const ref = this.modal.open<ReportScheduleModalComponent, ReportScheduleModalData, ReportScheduleModalResult>(
      ReportScheduleModalComponent, {
        size: 'md', closeOnBackdrop: false,
        data: { type, titleKey: row.report.titleKey, caps: scheduleCapsFor(row.report.slug), branches, schedule: full },
      });
    if (await ref.afterClosed()) await this.load();
  }

  askDelete(row: Row): void { this.confirmingDelete.set(row); }
  cancelDelete(): void { this.confirmingDelete.set(null); }

  async remove(row: Row): Promise<void> {
    try {
      const full = await this.svc.resolveFull(row.item);
      if (!full) throw new Error('not found');
      await this.svc.remove(full.id);
      this.rows.update(rs => rs.filter(r => r !== row));
      this.toast.success('REPORTS.SCHEDULE.DELETED');
    } catch (e: any) {
      this.toast.error('REPORTS.SCHEDULE_LIST.DELETE_FAILED', e?.message ?? '');
    } finally {
      this.confirmingDelete.set(null);
    }
  }
}
