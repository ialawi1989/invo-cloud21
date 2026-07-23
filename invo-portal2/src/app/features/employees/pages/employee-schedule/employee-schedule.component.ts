import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';

import { EmployeeService } from '../../services/employee.service';
import { BranchSettingsService } from '../../../settings/services/branch-settings.service';
import {
  ScheduleDay,
  ScheduleDayOff,
  ScheduleEmployee,
  ScheduleShift,
  shiftsHours,
} from './employee-schedule.types';
import {
  ShiftFormComponent,
  ShiftFormData,
  ShiftFormResult,
} from './components/shift-form/shift-form.component';
import {
  RegularShiftFormComponent,
  RegularShiftFormData,
  RegularShiftFormResult,
} from './components/regular-shift-form/regular-shift-form.component';
import {
  TimeoffFormComponent,
  TimeoffFormData,
  TimeoffFormResult,
} from './components/timeoff-form/timeoff-form.component';

interface BranchOption { id: string; name: string; }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Employee Schedule board
 * ───────────────────────
 * Per-branch weekly grid (rows = team members, columns = Sat→Fri days).
 * Cells surface each member's shifts and time-off with contextual actions
 * to add / edit / delete shifts, set a recurring pattern, or record time
 * off — each opening a modal sub-form. Saving routes through
 * {@link EmployeeService} and reloads the board.
 *
 * Branch source: `BranchSettingsService.getList` (the same `branch/getBranches`
 * endpoint the settings pages use); the board defaults to the main branch,
 * falling back to the first one returned.
 */
@Component({
  selector: 'app-employee-schedule',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SearchDropdownComponent,
    DropdownMenuBtnComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-schedule.component.html',
  styleUrl: './employee-schedule.component.scss',
})
export class EmployeeScheduleComponent implements OnInit {
  private employeeService = inject(EmployeeService);
  private branchService   = inject(BranchSettingsService);
  private modal           = inject(ModalService);
  private toast           = inject(ToastService);
  private translate       = inject(TranslateService);
  private destroyRef      = inject(DestroyRef);

  loading  = signal<boolean>(false);
  branches = signal<BranchOption[]>([]);
  branchId = signal<string | null>(null);
  employees = signal<ScheduleEmployee[]>([]);

  /** The seven ISO dates (yyyy-MM-dd) of the visible week, Sat→Fri. */
  currentWeek = signal<string[]>([]);
  /** Saturday anchoring the visible week. */
  private weekStart = new Date();

  private i18nTick = signal(0);

  // ─── Derived ─────────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('EMPLOYEES.TITLE'), routerLink: '/employees' },
      { label: this.translate.instant('EMPLOYEES.SCHEDULE.TITLE') },
    ];
  });

  rangeLabel = computed<string>(() => {
    const week = this.currentWeek();
    if (week.length < 7) return '';
    const start = new Date(`${week[0]}T00:00:00`);
    const end   = new Date(`${week[6]}T00:00:00`);
    return `${start.getDate()} - ${end.getDate()} ${MONTHS[end.getMonth()]}, ${end.getFullYear()}`;
  });

  branchDisplay = (b: BranchOption) => b?.name ?? '';
  branchCompare = (a: BranchOption, b: BranchOption) => a?.id === b?.id;

  /** The currently-selected branch option (drives the dropdown value). */
  selectedBranch = computed<BranchOption | null>(
    () => this.branches().find((b) => b.id === this.branchId()) ?? null,
  );

  /** Total worked hours per day column (time-off days count as 0). */
  hoursByDay = computed<number[]>(() => {
    const totals = this.currentWeek().map(() => 0);
    for (const emp of this.employees()) {
      emp.days?.forEach((day, i) => {
        if (i >= totals.length || day.dayOffShift?.length) return;
        totals[i] += shiftsHours(day.shift);
      });
    }
    return totals.map((h) => Math.round(h * 10) / 10);
  });

  /** Total worked hours per employee for the visible week. */
  hoursByEmployee = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const emp of this.employees()) {
      let total = 0;
      emp.days?.forEach((day) => {
        if (!day.dayOffShift?.length) total += shiftsHours(day.shift);
      });
      map[emp.employeeId] = Math.round(total * 10) / 10;
    }
    return map;
  });

  constructor() {
    withTranslations('employees');
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.setThisWeek(false);
    await this.loadBranches();
    await this.load();
  }

  private async loadBranches(): Promise<void> {
    try {
      const res = await this.branchService.getList({ limit: 200 });
      const options = res.list.map((b) => ({ id: b.id, name: b.name }));
      this.branches.set(options);
      const main = res.list.find((b) => b.mainBranch) ?? res.list[0];
      this.branchId.set(main?.id ?? null);
    } catch (e) {
      console.error('[employee-schedule] loadBranches failed', e);
    }
  }

  // ─── Week navigation ─────────────────────────────────────────────────────
  private saturdayOf(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 6 ? 0 : day < 6 ? -1 : -6);
    return new Date(date.setDate(diff));
  }

  private buildWeek(start: Date): string[] {
    const out: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push(iso);
    }
    return out;
  }

  private setWeekFrom(anchor: Date, reload = true): void {
    this.weekStart = this.saturdayOf(anchor);
    this.currentWeek.set(this.buildWeek(this.weekStart));
    if (reload) void this.load();
  }

  setThisWeek(reload = true): void {
    this.setWeekFrom(new Date(), reload);
  }

  previousWeek(): void {
    const d = new Date(this.weekStart);
    d.setDate(d.getDate() - 7);
    this.setWeekFrom(d);
  }

  nextWeek(): void {
    const d = new Date(this.weekStart);
    d.setDate(d.getDate() + 7);
    this.setWeekFrom(d);
  }

  // ─── Data ────────────────────────────────────────────────────────────────
  async load(): Promise<void> {
    const branchId = this.branchId();
    const week = this.currentWeek();
    if (!branchId || week.length < 7) return;
    this.loading.set(true);
    try {
      const raw = await this.employeeService.getEmployeesSchedule({
        branchId,
        from: week[0],
        to:   week[6],
      });
      this.employees.set((raw ?? []).map((r) => this.normalizeRow(r)));
    } catch (e) {
      console.error('[employee-schedule] load failed', e);
      this.employees.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private normalizeRow(r: any): ScheduleEmployee {
    return {
      employeeId:   r.employeeId ?? r.id ?? '',
      employeeName: r.employeeName ?? r.name ?? '',
      avatar:       r.avatar ?? '',
      days: (r.days ?? []).map((d: any): ScheduleDay => ({
        date:               d.date ?? '',
        shift:              Array.isArray(d.shift) ? d.shift : [],
        dayOffShift:        Array.isArray(d.dayOffShift) ? d.dayOffShift : [],
        employeeScheduleId: d.employeeScheduleId ?? null,
      })),
    };
  }

  onBranchChange(option: BranchOption | BranchOption[] | null): void {
    // `<app-search-dropdown>` emits the selected item object on `(valueChange)`.
    const opt = Array.isArray(option) ? option[0] ?? null : option;
    this.branchId.set(opt?.id ?? null);
    void this.load();
  }

  getDayData(employee: ScheduleEmployee, index: number): ScheduleDay | null {
    return employee.days?.[index] ?? null;
  }

  private tempDay(date: string): ScheduleDay {
    return { date, shift: [], dayOffShift: [], employeeScheduleId: null };
  }

  // ─── Cell menus (shared dropdown-menu-btn) ───────────────────────────────
  addMenu(employee: ScheduleEmployee, date: string, day: ScheduleDay | null): DropdownMenuBtnItem[] {
    const target = day ?? this.tempDay(date);
    return [
      { label: this.translate.instant('EMPLOYEES.SCHEDULE.ADD_SHIFT'),          click: () => this.openShift(employee, target) },
      { label: this.translate.instant('EMPLOYEES.SCHEDULE.SET_REGULAR_SHIFTS'), click: () => this.openRegular(employee) },
      { label: this.translate.instant('EMPLOYEES.SCHEDULE.ADD_TIME_OFF'),       click: () => this.openTimeOff(employee, target) },
    ];
  }

  shiftMenu(employee: ScheduleEmployee, day: ScheduleDay, shift: ScheduleShift): DropdownMenuBtnItem[] {
    return [
      { label: this.translate.instant('COMMON.EDIT'),                     click: () => this.openShift(employee, day) },
      { label: this.translate.instant('EMPLOYEES.SCHEDULE.ADD_TIME_OFF'), click: () => this.openTimeOff(employee, day) },
      { label: this.translate.instant('COMMON.DELETE'), danger: true,     click: () => this.deleteShift(employee, day, shift) },
    ];
  }

  dayOffMenu(employee: ScheduleEmployee, day: ScheduleDay, off: ScheduleDayOff): DropdownMenuBtnItem[] {
    return [
      { label: this.translate.instant('COMMON.EDIT'),                 click: () => this.openEditDayOff(employee, day, off) },
      { label: this.translate.instant('COMMON.DELETE'), danger: true, click: () => this.deleteDayOff(off.offDayId) },
    ];
  }

  // ─── Modal openers ───────────────────────────────────────────────────────
  async openShift(employee: ScheduleEmployee, day: ScheduleDay): Promise<void> {
    const ref = this.modal.open<ShiftFormComponent, ShiftFormData, ShiftFormResult>(
      ShiftFormComponent,
      {
        size: 'md',
        closeOnBackdrop: false,
        data: {
          employee: { employeeId: employee.employeeId, employeeName: employee.employeeName, avatar: employee.avatar },
          day: { date: day.date, shift: day.shift, employeeScheduleId: day.employeeScheduleId },
          branchId: this.branchId() ?? '',
        },
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    try {
      if (result.exceptions.length) {
        await this.employeeService.saveShiftExceptions({
          branchId:           result.branchId,
          employeeId:         result.employeeId,
          employeeScheduleId: result.employeeScheduleId ?? '',
          date:               result.date,
          exceptions:         result.exceptions,
        });
      }
      if (result.additionalShifts.length) {
        await this.employeeService.saveAdditionalShifts({
          branchId:           result.branchId,
          employeeId:         result.employeeId,
          employeeScheduleId: result.employeeScheduleId ?? '',
          date:               result.date,
          additionalShifts:   result.additionalShifts,
        });
      }
      await this.afterSave();
    } catch (e) {
      console.error('[employee-schedule] save shift failed', e);
      this.toast.error('COMMON.SAVE_FAILED');
    }
  }

  async openRegular(employee: ScheduleEmployee): Promise<void> {
    const ref = this.modal.open<RegularShiftFormComponent, RegularShiftFormData, RegularShiftFormResult>(
      RegularShiftFormComponent,
      {
        size: 'lg',
        closeOnBackdrop: false,
        data: {
          employee,
          date: this.currentWeek()[0] ?? '',
          branchId: this.branchId() ?? '',
        },
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    try {
      await this.employeeService.saveEmployeeSchedule(result.schedule);
      await this.afterSave();
    } catch (e) {
      console.error('[employee-schedule] save regular schedule failed', e);
      this.toast.error('COMMON.SAVE_FAILED');
    }
  }

  async openTimeOff(employee?: ScheduleEmployee | null, day?: ScheduleDay | null): Promise<void> {
    const ref = this.modal.open<TimeoffFormComponent, TimeoffFormData, TimeoffFormResult>(
      TimeoffFormComponent,
      {
        size: 'md',
        closeOnBackdrop: false,
        data: {
          employees: this.employees(),
          branchId:  this.branchId() ?? '',
          employee:  employee ?? null,
          day:       day ? { date: day.date } : null,
        },
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    await this.saveTimeOff(result);
  }

  async openEditDayOff(employee: ScheduleEmployee, day: ScheduleDay, off: ScheduleDayOff): Promise<void> {
    const ref = this.modal.open<TimeoffFormComponent, TimeoffFormData, TimeoffFormResult>(
      TimeoffFormComponent,
      {
        size: 'md',
        closeOnBackdrop: false,
        data: {
          employees:   this.employees(),
          branchId:    this.branchId() ?? '',
          employee,
          day:         { date: day.date },
          dayOffShift: { offDayId: off.offDayId },
        },
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    await this.saveTimeOff(result);
  }

  private async saveTimeOff(result: TimeoffFormResult): Promise<void> {
    try {
      const res = await this.employeeService.saveEmployeeOffDay(result.offDay);
      if (res?.success) {
        await this.afterSave();
      } else {
        const msg = String(res?.msg ?? res?.message ?? '').replace(/^Error:\s*/, '');
        this.toast.error(msg || this.translate.instant('COMMON.SAVE_FAILED'));
      }
    } catch (e) {
      console.error('[employee-schedule] save time off failed', e);
      this.toast.error('COMMON.SAVE_FAILED');
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────────
  async deleteShift(employee: ScheduleEmployee, day: ScheduleDay, shift: ScheduleShift): Promise<void> {
    const ok = await this.confirm(
      'EMPLOYEES.SCHEDULE.DELETE_SHIFT_CONFIRM_TITLE',
      'EMPLOYEES.SCHEDULE.DELETE_SHIFT_CONFIRM_MSG',
    );
    if (!ok) return;
    try {
      await this.employeeService.saveShiftExceptions({
        branchId:           this.branchId() ?? '',
        employeeId:         employee.employeeId,
        employeeScheduleId: day.employeeScheduleId ?? '',
        date:               day.date,
        exceptions:         [shift],
      });
      await this.afterSave();
    } catch (e) {
      console.error('[employee-schedule] delete shift failed', e);
      this.toast.error('COMMON.SAVE_FAILED');
    }
  }

  async deleteDayOff(offDayId: string): Promise<void> {
    const ok = await this.confirm(
      'EMPLOYEES.SCHEDULE.DELETE_TIMEOFF_CONFIRM_TITLE',
      'EMPLOYEES.SCHEDULE.DELETE_TIMEOFF_CONFIRM_MSG',
    );
    if (!ok) return;
    try {
      await this.employeeService.deleteEmployeeOffDay(offDayId);
      await this.afterSave();
    } catch (e) {
      console.error('[employee-schedule] delete time off failed', e);
      this.toast.error('COMMON.SAVE_FAILED');
    }
  }

  private async confirm(titleKey: string, messageKey: string): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title:   this.translate.instant(titleKey),
          message: this.translate.instant(messageKey),
          confirm: this.translate.instant('COMMON.DELETE'),
          danger:  true,
        },
      },
    );
    return (await ref.afterClosed()) === true;
  }

  private async afterSave(): Promise<void> {
    await this.load();
    this.toast.success('EMPLOYEES.SCHEDULE.SAVED');
  }

  initial(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }
}
