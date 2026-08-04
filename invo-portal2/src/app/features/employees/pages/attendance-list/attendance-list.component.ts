import { Component, OnInit, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import {
  TableColumn,
  ListQueryParams,
  BulkActionConfig,
} from '@shared/components/list-page/interfaces/list-page.types';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';

import { EmployeeAttendanceService } from '../../services/employee-attendance.service';
import { AttendanceSummary } from '../../models/employee.types';
import {
  AttendanceQuickAdjustModalComponent,
  QuickAdjustData,
  QuickAdjustResult,
} from './components/attendance-quick-adjust-modal.component';

/** The two adjustable columns. */
type AdjField = 'adjClockedIn' | 'adjClockedOut';

/**
 * Attendance log — shared `<app-list-page>`. Read-only clock-in / clock-out
 * records; row click opens the adjust form. Adjusted times (and who adjusted
 * them) are shown inline via a custom cell template.
 */
@Component({
  selector: 'app-attendance-list',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ListPageComponent,
    ListCellTemplateDirective,
    ListRowActionsDirective,
  ],
  templateUrl: './attendance-list.component.html',
  styleUrl: './attendance-list.component.scss',
})
export class AttendanceListComponent implements OnInit {
  private service = inject(EmployeeAttendanceService);
  private router  = inject(Router);
  private lang    = inject(LanguageService);
  private modal   = inject(ModalService);
  private toast   = inject(ToastService);

  /** Handle to the shared list so we can refresh after a save. */
  private listPage = viewChild(ListPageComponent);

  columns: TableColumn[] = [];
  bulkActions: BulkActionConfig[] = [];

  paginationConfig = { enabled: true, pageLimits: [20, 50, 100], default: 20 };
  searchConfig     = { enabled: true, placeholder: '', debounceMs: 400 };
  sortingConfig    = { enabled: true };
  emptyState       = { title: '', message: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('employees');
    this.initTranslations();
  }

  private initTranslations(): void {
    const t = (k: string) => this.lang.instant(k);
    this.columns = [
      { key: 'employeeName', label: t('EMPLOYEES.ATTENDANCE.EMPLOYEE_NAME'), sortable: true, primary: true, interactive: true, customTemplate: true, visible: true, order: 0 },
      { key: 'clockedIn',    label: t('EMPLOYEES.ATTENDANCE.CLOCKED_IN'),    noApi: true, sortable: false, customTemplate: true, visible: true, order: 1 },
      { key: 'clockedOut',   label: t('EMPLOYEES.ATTENDANCE.CLOCKED_OUT'),   noApi: true, sortable: false, customTemplate: true, visible: true, order: 2 },
      { key: 'branchName',   label: t('EMPLOYEES.ATTENDANCE.BRANCH_NAME'),   sortable: false, visible: true, order: 3 },
    ];
    this.searchConfig.placeholder = t('EMPLOYEES.ATTENDANCE.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('EMPLOYEES.ATTENDANCE.EMPTY'), message: '' };

    // Bulk: one action → one modal to set the clock-in → clock-out range
    // for every selected record at once.
    this.bulkActions = [
      { id: 'bulk-adjust', label: t('EMPLOYEES.ATTENDANCE.ADJUST_ATTENDANCE'), icon: 'edit', color: 'primary',
        handler: (rows) => this.bulkAdjust(rows as AttendanceSummary[]) },
    ];
  }

  loadAttendance = async (params: ListQueryParams) => {
    const res = await this.service.getList({
      page:       params.page,
      limit:      params.limit,
      searchTerm: params.searchTerm || '',
      sortBy:     params.sortBy
        ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
        : {},
    });
    return { list: res.list, count: res.count, pageCount: res.pageCount };
  };

  onRowClick(event: any): void {
    if (event?.row) this.edit(event.row);
  }

  edit(row: AttendanceSummary): void {
    void this.router.navigate(['/employees/attendance', row.id]);
  }

  // ─── Quick edit (single row, one field) ──────────────────────────────────
  async quickEdit(row: AttendanceSummary, field: AdjField, ev: Event): Promise<void> {
    ev.stopPropagation();
    const isIn = field === 'adjClockedIn';
    const result = await this.pick({
      title:    this.lang.instant(isIn ? 'EMPLOYEES.ATTENDANCE.ADJ_CLOCKED_IN' : 'EMPLOYEES.ATTENDANCE.ADJ_CLOCKED_OUT'),
      showIn:   isIn,
      showOut:  !isIn,
      valueIn:  isIn  ? this.currentValue(row, 'adjClockedIn')  : null,
      valueOut: !isIn ? this.currentValue(row, 'adjClockedOut') : null,
    });
    if (!result) return; // dismissed
    const value = isIn ? result.in : result.out;
    await this.runAdjustments([{ rows: [row], field, value }]);
  }

  // ─── Bulk edit (selected rows, in → out range) ───────────────────────────
  private async bulkAdjust(rows: AttendanceSummary[]): Promise<void> {
    if (!rows?.length) return;
    const result = await this.pick({
      title:    this.lang.instant('EMPLOYEES.ATTENDANCE.ADJUST_ATTENDANCE'),
      showIn:   true,
      showOut:  true,
      valueIn:  null,
      valueOut: null,
    });
    if (!result) return; // dismissed
    // Only touch fields the user actually set (empty = leave unchanged).
    const jobs: Array<{ rows: AttendanceSummary[]; field: AdjField; value: Date | null }> = [];
    if (result.in  != null) jobs.push({ rows, field: 'adjClockedIn',  value: result.in });
    if (result.out != null) jobs.push({ rows, field: 'adjClockedOut', value: result.out });
    if (!jobs.length) return;
    await this.runAdjustments(jobs);
  }

  /** Open the quick-adjust modal; resolves to the picked range, or `undefined`
   *  when the user cancels. */
  private async pick(data: QuickAdjustData): Promise<QuickAdjustResult | undefined> {
    const ref = this.modal.open<AttendanceQuickAdjustModalComponent, QuickAdjustData, QuickAdjustResult>(
      AttendanceQuickAdjustModalComponent,
      { size: 'md', closeOnBackdrop: false, data },
    );
    return (await ref.afterClosed()) ?? undefined;
  }

  /** Persist each job's field for its rows (legacy per-field payload), then
   *  refresh. */
  private async runAdjustments(jobs: Array<{ rows: AttendanceSummary[]; field: AdjField; value: Date | null }>): Promise<void> {
    try {
      for (const job of jobs) {
        for (const row of job.rows) {
          const res = await this.service.adjust({ id: row.id, [job.field]: this.toLocal(job.value), type: job.field });
          if (res?.success === false) {
            this.toast.error('COMMON.SAVE_FAILED', res?.msg);
            return;
          }
        }
      }
      this.toast.success('EMPLOYEES.ATTENDANCE.SAVED');
      this.listPage()?.refresh();
    } catch (e: any) {
      console.error('[attendance-list] adjust failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    }
  }

  private currentValue(row: AttendanceSummary, field: AdjField): Date | null {
    const recorded = field === 'adjClockedIn' ? row.clockedIn : row.clockedOut;
    const raw = (row[field] as string | null) || recorded;
    return raw ? new Date(raw) : null;
  }

  /** `Date` → local `"YYYY-MM-DD HH:mm"` (no UTC conversion) — matches the
   *  legacy payload so the saved time is exactly what was picked. */
  private toLocal(d: Date | null): string | null {
    if (!d) return null;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
}
