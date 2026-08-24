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
import { Router } from '@angular/router';
import { OverlayModule, ConnectedPosition } from '@angular/cdk/overlay';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import type { DateRange } from '@shared/components/datepicker/date-picker.types';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';
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
  formatShiftRange,
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
import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { hrGrantFor } from '../../hr-privilege';
import {
  PendingLeaveModalComponent,
  PendingLeaveModalData,
} from './components/pending-leave-modal/pending-leave-modal.component';

interface BranchOption { id: string; name: string; }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** How the team-member rows are ordered (Fresha-style "Custom order" menu). */
type SortKey =
  | 'custom'
  | 'shifts-desc' | 'shifts-asc'
  | 'hours-desc'  | 'hours-asc'
  | 'name-asc'    | 'name-desc';

interface SortOption { value: SortKey; labelKey: string; }
const SORT_OPTIONS: SortOption[] = [
  { value: 'custom',      labelKey: 'EMPLOYEES.SCHEDULE.SORT_CUSTOM' },
  { value: 'shifts-desc', labelKey: 'EMPLOYEES.SCHEDULE.SORT_SHIFTS_DESC' },
  { value: 'shifts-asc',  labelKey: 'EMPLOYEES.SCHEDULE.SORT_SHIFTS_ASC' },
  { value: 'hours-desc',  labelKey: 'EMPLOYEES.SCHEDULE.SORT_HOURS_DESC' },
  { value: 'hours-asc',   labelKey: 'EMPLOYEES.SCHEDULE.SORT_HOURS_ASC' },
  { value: 'name-asc',    labelKey: 'EMPLOYEES.SCHEDULE.SORT_NAME_ASC' },
  { value: 'name-desc',   labelKey: 'EMPLOYEES.SCHEDULE.SORT_NAME_DESC' },
];

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
    DatePickerComponent,
    OverlayModule,
    SegmentedToggleComponent,
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
  private router          = inject(Router);
  private destroyRef      = inject(DestroyRef);
  private privileges      = inject(PrivilegeService);
  private auth            = inject(AuthService);

  /**
   * May this user decide a leave?
   *
   * The SAME grant the HR leave screen reads, so a supervisor who can approve
   * there can approve here and one who cannot sees neither action. Anything
   * else would make the board a way around the privilege.
   *
   * A computed, not a plain call: the privilege payload hydrates after the
   * component is built, and a value read once would decide from an empty
   * payload and never revisit it.
   */
  readonly canApproveLeave = computed(() =>
    hrGrantFor(this.privileges, this.auth, 'employeeLeaveSecurity', 'approve'));

  /**
   * How many DISTINCT leaves are waiting on a decision for this person.
   *
   * By row id, not by day: a leave spanning a week draws seven chips over one
   * row, and counting days would say "7 waiting" for one request - a number
   * nobody could reconcile with the list they are about to open.
   *
   * Read from data the board already has, so it costs no request. Without it
   * the row menu is a blind door: nothing on the roster says whether opening
   * it will show a queue or an empty panel.
   */
  pendingLeaveCount(employee: ScheduleEmployee): number {
    const ids = new Set<string>();
    for (const d of employee.days ?? []) {
      for (const off of d.dayOffShift ?? []) {
        if (off.status === 'Pending') ids.add(off.offDayId);
      }
    }
    return ids.size;
  }

  loading  = signal<boolean>(false);
  branches = signal<BranchOption[]>([]);
  branchId = signal<string | null>(null);
  employees = signal<ScheduleEmployee[]>([]);

  readonly sortOptions = SORT_OPTIONS;
  /** Active row-ordering (persisted only for the session). */
  sortKey = signal<SortKey>('custom');

  /** 12-hour shift label helper exposed to the template. */
  shiftRange = formatShiftRange;

  /** The seven ISO dates (yyyy-MM-dd) of the visible week, Sat→Fri. */
  currentWeek = signal<string[]>([]);
  /** Saturday anchoring the visible week. */
  private weekStart = new Date();

  /** Week-jump calendar (opened from the date range label). */
  weekPickerOpen = signal<boolean>(false);
  readonly weekPickerPositions: ConnectedPosition[] = [
    // Prefer centered under the date label; fall back to edge-aligned near
    // the viewport edges so the calendar never clips off-screen.
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top',    offsetY: 8 },
    { originX: 'center', originY: 'top',    overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
    { originX: 'start',  originY: 'bottom', overlayX: 'start',  overlayY: 'top',    offsetY: 8 },
    { originX: 'end',    originY: 'bottom', overlayX: 'end',    overlayY: 'top',    offsetY: 8 },
  ];
  /** The visible week as a Sat→Fri range, so the calendar highlights the
   *  whole week as a band (not a single day). */
  weekPickerValue = computed<DateRange | null>(() => {
    const wk = this.currentWeek();
    if (wk.length < 7) return null;
    return { start: new Date(`${wk[0]}T00:00:00`), end: new Date(`${wk[6]}T00:00:00`) };
  });

  /** Jump the board to the week containing the picked day. In range mode the
   *  first click emits `{ start, end: null }`, so we snap on `start`. */
  onWeekDatePicked(value: Date | DateRange | null): void {
    this.weekPickerOpen.set(false);
    if (!value) return;
    const date = value instanceof Date ? value : (value.start ?? value.end ?? null);
    if (date) this.setWeekFrom(date);
  }

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
    // Fresha format: "Jul 25 – 31, 2026" (collapse the month when it repeats).
    const left  = `${MONTHS[start.getMonth()]} ${start.getDate()}`;
    const right = start.getMonth() === end.getMonth()
      ? `${end.getDate()}`
      : `${MONTHS[end.getMonth()]} ${end.getDate()}`;
    return `${left} – ${right}, ${end.getFullYear()}`;
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

  /** Number of worked days (cells with ≥1 shift) per employee this week. */
  shiftsByEmployee = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const emp of this.employees()) {
      let count = 0;
      emp.days?.forEach((day) => {
        if (!day.dayOffShift?.length && day.shift?.length) count++;
      });
      map[emp.employeeId] = count;
    }
    return map;
  });

  /** Rows in the currently-selected order. `custom` keeps the backend order. */
  sortedEmployees = computed<ScheduleEmployee[]>(() => {
    const rows = [...this.employees()];
    const key = this.sortKey();
    if (key === 'custom') return rows;
    const hours  = this.hoursByEmployee();
    const shifts = this.shiftsByEmployee();
    const name = (e: ScheduleEmployee) => (e.employeeName || '').toLowerCase();
    rows.sort((a, b) => {
      switch (key) {
        case 'name-asc':    return name(a).localeCompare(name(b));
        case 'name-desc':   return name(b).localeCompare(name(a));
        case 'hours-desc':  return (hours[b.employeeId] || 0) - (hours[a.employeeId] || 0);
        case 'hours-asc':   return (hours[a.employeeId] || 0) - (hours[b.employeeId] || 0);
        case 'shifts-desc': return (shifts[b.employeeId] || 0) - (shifts[a.employeeId] || 0);
        case 'shifts-asc':  return (shifts[a.employeeId] || 0) - (shifts[b.employeeId] || 0);
        default:            return 0;
      }
    });
    return rows;
  });

  /** Label shown on the sort trigger (reacts to i18n + selection). */
  sortLabel = computed<string>(() => {
    this.i18nTick();
    const opt = SORT_OPTIONS.find((o) => o.value === this.sortKey()) ?? SORT_OPTIONS[0];
    return this.translate.instant(opt.labelKey);
  });

  /** Items for the "Custom order" sort menu (checkmark on the active one). */
  sortMenu = computed<DropdownMenuBtnItem[]>(() => {
    this.i18nTick();
    const active = this.sortKey();
    return SORT_OPTIONS.map((o) => ({
      label: this.translate.instant(o.labelKey),
      iconPath: o.value === active ? 'M20 6 9 17l-5-5' : undefined,
      click: () => this.sortKey.set(o.value),
    }));
  });

  // ─── Mobile view (small screens) ─────────────────────────────────────────
  /** Small-screen layout: group by team member (accordion) or by week/day. */
  mobileView = signal<'member' | 'week'>('member');
  readonly mobileViewOptions: SegmentedToggleOption[] = [
    { value: 'member', label: 'EMPLOYEES.SCHEDULE.TEAM_MEMBER' },
    { value: 'week',   label: 'EMPLOYEES.SCHEDULE.WEEK_VIEW' },
  ];
  onMobileView(v: string): void { this.mobileView.set(v === 'week' ? 'week' : 'member'); }

  /** Collapsed team-member cards in the mobile accordion (default expanded). */
  private collapsedEmp = signal<Set<string>>(new Set());
  isEmpExpanded(id: string): boolean { return !this.collapsedEmp().has(id); }
  toggleEmp(id: string): void {
    this.collapsedEmp.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /** Header "Add" split-button menu. */
  addMenuTop = computed<DropdownMenuBtnItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('EMPLOYEES.SCHEDULE.ADD_TIME_OFF'),     click: () => this.openTimeOff() },
      { label: this.translate.instant('EMPLOYEES.SCHEDULE.NEW_TEAM_MEMBER'),  click: () => this.router.navigate(['/employees', '0']) },
    ];
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
    date.setHours(0, 0, 0, 0);
    // Days since the most recent Saturday (Sat=0, Sun=1, … Fri=6).
    const diff = (date.getDay() + 1) % 7;
    date.setDate(date.getDate() - diff);
    return date;
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
      { label: this.translate.instant('EMPLOYEES.SCHEDULE.ADD_SHIFT'),            click: () => this.openShift(employee, target) },
      { label: this.translate.instant('EMPLOYEES.SCHEDULE.SET_REPEATING_SHIFTS'), click: () => this.openRegular(employee) },
      { label: this.translate.instant('EMPLOYEES.SCHEDULE.ADD_TIME_OFF'),         click: () => this.openTimeOff(employee, target) },
    ];
  }

  shiftMenu(employee: ScheduleEmployee, day: ScheduleDay, shift: ScheduleShift): DropdownMenuBtnItem[] {
    return [
      { label: this.translate.instant('EMPLOYEES.SCHEDULE.EDIT_THIS_DAY'),        click: () => this.openShift(employee, day) },
      { label: this.translate.instant('EMPLOYEES.SCHEDULE.SET_REPEATING_SHIFTS'), click: () => this.openRegular(employee) },
      { label: this.translate.instant('EMPLOYEES.SCHEDULE.ADD_TIME_OFF'),         click: () => this.openTimeOff(employee, day) },
      { label: this.translate.instant('EMPLOYEES.SCHEDULE.DELETE_THIS_SHIFT'), danger: true, separator: true,
        click: () => this.deleteShift(employee, day, shift) },
    ];
  }

  dayOffMenu(employee: ScheduleEmployee, day: ScheduleDay, off: ScheduleDayOff): DropdownMenuBtnItem[] {
    const items: DropdownMenuBtnItem[] = [
      { label: this.translate.instant('COMMON.EDIT'), click: () => this.openEditDayOff(employee, day, off) },
    ];

    // Only a PENDING leave is a decision waiting to be made. Offering approve
    // on one already approved invites a second decision over the first, and
    // the audit would then show two.
    if (off.status === 'Pending' && this.canApproveLeave()) {
      items.push(
        { label: this.translate.instant('EMPLOYEES.SCHEDULE.APPROVE_LEAVE'),
          click: () => this.decideDayOff(off, 'Approved') },
        { label: this.translate.instant('EMPLOYEES.SCHEDULE.REJECT_LEAVE'), danger: true,
          click: () => this.decideDayOff(off, 'Rejected') },
      );
    }

    items.push({
      label: this.translate.instant('EMPLOYEES.SCHEDULE.CANCEL_LEAVE'), danger: true,
      click: () => this.cancelDayOff(off.offDayId),
    });
    return items;
  }

  /** Team-member row menu (pencil), mirroring Fresha's two-section layout. */
  rowMenu(employee: ScheduleEmployee): DropdownMenuBtnItem[] {
    return [
      { header: 'EMPLOYEES.SCHEDULE.SCHEDULE_SECTION',
        label: this.translate.instant('EMPLOYEES.SCHEDULE.SET_REPEATING_SHIFTS'), click: () => this.openRegular(employee) },
      { label: this.translate.instant('EMPLOYEES.SCHEDULE.ADD_TIME_OFF'),         click: () => this.openTimeOff(employee) },
      // Deciding leave is a task somebody sits down to do, so it opens its own
      // surface instead of putting controls on every leave cell of the rota.
      { label: this.manageLeaveLabel(employee),                                   click: () => this.openLeaveManager(employee) },
      { header: 'EMPLOYEES.SCHEDULE.TEAM_MEMBER_SECTION', separator: true,
        label: this.translate.instant('EMPLOYEES.SCHEDULE.VIEW_TEAM_MEMBER'),     click: () => this.router.navigate(['/employees', employee.employeeId]) },
      // Straight to the form, not the overview: the menu item says EDIT, and
      // landing on a read-only page would make it a two-click no-op.
      { label: this.translate.instant('EMPLOYEES.SCHEDULE.EDIT_TEAM_MEMBER'),     click: () => this.router.navigate(['/employees', employee.employeeId, 'edit']) },
    ];
  }

  /** Native-title tooltip for a day header: bookable vs non-bookable split. */
  dayTooltip(index: number): string {
    const bookable = this.hoursByDay()[index] || 0;
    const b = this.translate.instant('EMPLOYEES.SCHEDULE.BOOKABLE');
    const n = this.translate.instant('EMPLOYEES.SCHEDULE.NON_BOOKABLE');
    const suffix = this.translate.instant('EMPLOYEES.SCHEDULE.HR_SUFFIX');
    return `${b}: ${bookable} ${suffix}\n${n}: 0 ${suffix}`;
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

  /**
   * The menu label, carrying the count when there is one.
   *
   * Only when there IS one: "Leave requests (0)" is noise on every row of a
   * roster where most people have nothing pending, and a zero in a badge reads
   * as a thing to look at.
   */
  private manageLeaveLabel(employee: ScheduleEmployee): string {
    const n = this.pendingLeaveCount(employee);
    const base = this.translate.instant('EMPLOYEES.SCHEDULE.MANAGE_LEAVE');
    return n > 0 ? `${base} (${n})` : base;
  }

  /**
   * Leave for one team member: filtered, decided, cancelled.
   *
   * Reloads the board on close whatever the result. A decision taken in there
   * changes what the rota should show, and leaving the board on its old data
   * would have the two disagree on the screen they share.
   */
  async openLeaveManager(employee: ScheduleEmployee): Promise<void> {
    const ref = this.modal.open<PendingLeaveModalComponent, PendingLeaveModalData, boolean>(
      PendingLeaveModalComponent,
      { data: { employeeId: employee.employeeId, employeeName: employee.employeeName } },
    );
    await ref.afterClosed();
    await this.afterSave();
  }

  /**
   * Cancel a leave and every day of it.
   *
   * The board draws one chip per day, but a leave is ONE row spanning its
   * dates, so this clears the whole span in a single request. The confirmation
   * says so - a supervisor clicking Friday must not be surprised that Monday
   * went with it.
   */
  async cancelDayOff(offDayId: string): Promise<void> {
    const ok = await this.confirm(
      'EMPLOYEES.SCHEDULE.CANCEL_TIMEOFF_CONFIRM_TITLE',
      'EMPLOYEES.SCHEDULE.CANCEL_TIMEOFF_CONFIRM_MSG',
    );
    if (!ok) return;
    try {
      const res = await this.employeeService.cancelEmployeeOffDays([offDayId]);
      // Reported, not assumed: somebody else may have decided it a moment ago.
      if ((res?.data?.cancelled ?? 0) === 0) {
        this.toast.error('EMPLOYEES.SCHEDULE.CANCEL_LEAVE_SKIPPED');
      } else {
        this.toast.success('COMMON.SAVED_OK');
      }
      await this.afterSave();
    } catch (e) {
      console.error('[employee-schedule] cancel time off failed', e);
      this.toast.error('COMMON.SAVE_FAILED');
    }
  }

  /** Approve or reject, through the HR module's own endpoint. */
  async decideDayOff(off: ScheduleDayOff, decision: 'Approved' | 'Rejected'): Promise<void> {
    const ok = await this.confirm(
      decision === 'Approved'
        ? 'EMPLOYEES.SCHEDULE.APPROVE_CONFIRM_TITLE'
        : 'EMPLOYEES.SCHEDULE.REJECT_CONFIRM_TITLE',
      decision === 'Approved'
        ? 'EMPLOYEES.SCHEDULE.APPROVE_CONFIRM_MSG'
        : 'EMPLOYEES.SCHEDULE.REJECT_CONFIRM_MSG',
    );
    if (!ok) return;
    try {
      await this.employeeService.decideLeaveRequest(off.offDayId, decision);
      this.toast.success('COMMON.SAVED_OK');
      await this.afterSave();
    } catch (e) {
      console.error('[employee-schedule] leave decision failed', e);
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
