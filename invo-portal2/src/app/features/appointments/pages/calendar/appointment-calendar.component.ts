import { ChangeDetectionStrategy, Component, ElementRef, effect, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { addDays, buildCalendarGrid, formatDate as formatCalendarDate, startOfDay } from '@shared/components/datepicker/date-utils';
import { LayoutService } from '@core/layout/services/layout.service';
import { BranchConnectionService } from '@core/layout/services/branch.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { FormsModule } from '@angular/forms';
import { unwrapOptionValue } from '../../utils/option-compare';
import { EmployeeOptionsService } from '@core/layout/services/employee-options.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { EmployeeService } from '../../../employees/services/employee.service';
import { AppointmentsService } from '../../services/appointments.service';
import { AppointmentTask, EmployeeLite } from '../../models/appointment.types';
import { employeeColor } from '../../utils/employee-color';
import { startOfWeek, weekDates } from '../../utils/time-utils';
import { DayViewComponent, RescheduleEvent, ResizeEvent, SlotClickEvent } from './components/day-view/day-view.component';
import { WeekViewComponent, WeekSlotClickEvent, WeekRescheduleEvent, WeekResizeEvent } from './components/week-view/week-view.component';
import { EmployeeServicesComponent } from '../../../products/pages/employee-services/employee-services.component';
import { ServiceTeamComponent } from '../../../employees/pages/service-team/service-team.component';
import { EmployeesViewComponent } from './components/employees-view/employees-view.component';
import { MonthViewComponent } from './components/month-view/month-view.component';
import { AgendaDrawerComponent, AgendaDrawerData, AgendaDrawerResult } from './components/agenda-drawer/agenda-drawer.component';
import { PrintScheduleModalComponent, PrintScheduleModalData } from '../../components/print-schedule-modal/print-schedule-modal.component';
import { QuickCreatePopoverComponent, QuickCreateData, QuickCreateResult } from '../../components/quick-create-popover/quick-create-popover.component';
import { BranchFilterModalComponent, BranchFilterData } from '../../components/branch-filter-modal/branch-filter-modal.component';
import { StaffFilterModalComponent, StaffFilterData } from '../../components/staff-filter-modal/staff-filter-modal.component';
import { QueryParamsService, enumCodec, ParamDef, StringCodec } from '@shared/services/query-params.service';

type CalendarView = 'day' | 'week' | 'month';

const VIEW_PARAM: ParamDef<CalendarView> = { key: 'view', codec: enumCodec(['day', 'week', 'month'] as const, 'day') };
const DATE_PARAM: ParamDef<string> = { key: 'date', codec: StringCodec };
// Tool state also lives in the URL so a refresh / shared link keeps the page as it was.
const MODE_PARAM: ParamDef<'calendar' | 'employees' | 'settings'> = { key: 'mode', codec: enumCodec(['calendar', 'employees', 'settings'] as const, 'calendar') };
const SETTING_PARAM: ParamDef<'service-team' | 'pricing'> = { key: 'setting', codec: enumCodec(['service-team', 'pricing'] as const, 'service-team') };
const PANEL_PARAM: ParamDef<'open' | 'closed'> = { key: 'panel', codec: enumCodec(['open', 'closed'] as const, 'open') };
const SEARCH_PARAM: ParamDef<string> = { key: 'q', codec: StringCodec };

@Component({
  selector: 'app-appointment-calendar',
  standalone: true,
  imports: [FormsModule, SearchDropdownComponent, TranslateModule, DatePickerComponent, DayViewComponent, WeekViewComponent, MonthViewComponent, EmployeesViewComponent, ServiceTeamComponent, EmployeeServicesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './appointment-calendar.component.html',
  styleUrl: './appointment-calendar.component.scss',
})
export class AppointmentCalendarComponent implements OnInit, OnDestroy {
  private employeeSvc = inject(EmployeeService);
  private appointmentsSvc = inject(AppointmentsService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private qp = inject(QueryParamsService);
  private privileges = inject(PrivilegeService);
  private employeeOptions = inject(EmployeeOptionsService);
  private layout = inject(LayoutService);
  private branchSvc = inject(BranchConnectionService);

  viewOptions = computed(() => [
    { value: 'day', label: this.translate.instant('APPOINTMENTS.VIEW_DAY') },
    { value: 'week', label: this.translate.instant('APPOINTMENTS.VIEW_WEEK') },
    { value: 'month', label: this.translate.instant('APPOINTMENTS.VIEW_MONTH') },
  ]);
  onViewChange(v: string | null): void {
    if (v === 'day' || v === 'week' || v === 'month') this.setView(v);
  }

  /** Sidebar sections collapse like Google Calendar's "My calendars". */
  collapsed = signal<Record<string, boolean>>({});
  toggleSection(key: string): void {
    this.collapsed.update(c => ({ ...c, [key]: !c[key] }));
  }

  /** Branch the calendar is scoped to; `null` = every branch. */
  selectedBranchId = signal<string | null>(null);
  branchOptions = computed(() => [
    { value: '', label: this.translate.instant('APPOINTMENTS.ALL_BRANCHES') },
    ...this.branchSvc.branches().map(b => ({ value: b.id, label: b.name })),
  ]);
  branchLabel = (o: { value: string; label: string }) => o.label;
  branchValue = (o: { value: string; label: string }) => o.value;
  branchCompare = (a: unknown, b: unknown) => (unwrapOptionValue(a) ?? '') === (unwrapOptionValue(b) ?? '');

  /** Staff of the selected branch (staff with no branch assigned show under every branch). */
  branchEmployees = computed(() => {
    const branch = this.selectedBranchId();
    return branch ? this.employees().filter(e => !e.branchId || e.branchId === branch) : this.employees();
  });

  readonly canAdd = computed(() => this.privileges.check('appointmentsSecurity.actions.add.access'));

  view = signal<CalendarView>(this.qp.read({ view: VIEW_PARAM }).view);
  currentDate = signal<Date>(this.readInitialDate());

  employees = signal<EmployeeLite[]>([]);
  /** Staff the user has unchecked; everyone else is shown (an unchecked box hides just that person). */
  hiddenEmployeeIds = signal<Set<string>>(new Set());
  tasks = signal<AppointmentTask[]>([]);
  loading = signal(false);

  visibleEmployees = computed(() => {
    const hidden = this.hiddenEmployeeIds();
    return this.branchEmployees().filter(e => !hidden.has(e.id));
  });

  /** Three-letter weekday headings for the mini calendar ("Sun Mon Tue"), like the reference. */
  readonly dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /** The "..." tools menu (Print Employee Schedule lives here). */
  moreOpen = signal(false);

  /** Left panel (mini calendar, branch, staff) can be hidden to give the grid the whole width. */
  sidebarOpen = signal(this.qp.read({ panel: PANEL_PARAM }).panel === 'open');

  /** Google-style mode toggle: the time grid, or one card per employee with their own appointments. */
  mode = signal<'calendar' | 'employees' | 'settings'>(this.qp.read({ mode: MODE_PARAM }).mode);

  /** Which entry of the Settings view's side list is open. */
  setting = signal<'service-team' | 'pricing'>(this.qp.read({ setting: SETTING_PARAM }).setting);
  readonly canSeePricing = computed(() => this.privileges.check('productSecurity.actions.view.access'));
  readonly canSeeServiceTeam = computed(() => this.privileges.check('appointmentsSecurity.actions.serviceTeam.access'));

  /** Free-text filter over the appointments already loaded for the current range. */
  searchTerm = signal(this.qp.read({ q: SEARCH_PARAM }).q ?? '');

  private urlSync = effect(() => {
    // ONE navigation for all of them: separate writeOne() calls in the same tick each merge
    // against the not-yet-updated URL, so only the last one survived and the rest were lost.
    this.qp.write(
      { mode: MODE_PARAM, panel: PANEL_PARAM, q: SEARCH_PARAM, setting: SETTING_PARAM },
      { mode: this.mode(), panel: this.sidebarOpen() ? 'open' : 'closed', q: this.searchTerm(), setting: this.setting() },
    );
  });
  /** Search is an icon button that opens into a wide bar (like Google Calendar). */
  searchOpen = signal(!!this.qp.read({ q: SEARCH_PARAM }).q);
  private searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  openSearch(): void {
    this.searchOpen.set(true);
    setTimeout(() => this.searchInput()?.nativeElement.focus());
  }

  closeSearch(clear = false): void {
    if (clear) this.searchTerm.set('');
    if (!this.searchTerm().trim()) this.searchOpen.set(false);
  }

  visibleTasks = computed(() => {
    const ids = new Set(this.visibleEmployees().map(e => e.id));
    const term = this.searchTerm().trim().toLowerCase();
    return this.tasks().filter(t => {
      if (!ids.has(t.employeeId)) return false;
      if (!term) return true;
      return [t.customerName, t.customerPhone, t.serviceName, t.employeeName, t.taskNumber]
        .some(v => (v ?? '').toString().toLowerCase().includes(term));
    });
  });

  rangeLabel = computed(() => {
    const d = this.currentDate();
    if (this.view() === 'day') return formatCalendarDate(d, 'MMMM d, yyyy');
    if (this.view() === 'week') {
      const days = weekDates(d);
      return `${formatCalendarDate(days[0], 'MMM d')} – ${formatCalendarDate(days[6], 'MMM d, yyyy')}`;
    }
    return formatCalendarDate(d, 'MMMM yyyy');
  });

  async ngOnInit(): Promise<void> {
    // Full-bleed page: no content padding, and the wide grid gets the room of a collapsed side menu.
    this.layout.setNoPadding(true);
    this.layout.setCollapseSidebar(true);
    await this.loadEmployees();
    void this.branchSvc.load().catch(() => {});
    await this.restoreStaffFilter();
    await this.loadTasks();
  }

  ngOnDestroy(): void {
    this.layout.setNoPadding(false);
    this.layout.setCollapseSidebar(false);
  }

  private readInitialDate(): Date {
    const raw = this.qp.read({ date: DATE_PARAM }).date;
    const parsed = raw ? new Date(raw) : null;
    return parsed && !isNaN(parsed.getTime()) ? startOfDay(parsed) : startOfDay(new Date());
  }

  private syncUrl(): void {
    this.qp.write({ view: VIEW_PARAM, date: DATE_PARAM }, {
      view: this.view(),
      date: `${this.currentDate().getFullYear()}-${String(this.currentDate().getMonth() + 1).padStart(2, '0')}-${String(this.currentDate().getDate()).padStart(2, '0')}`,
    });
  }

  private async loadEmployees(): Promise<void> {
    try {
      const res = await this.employeeSvc.getList({ page: 1, limit: 500 });
      this.employees.set(
        res.list
          .filter(e => e.user)
          .map(e => ({ id: e.id, name: e.name, avatar: e.avatar, branchId: e.branchId })),
      );
    } catch {
      this.employees.set([]);
    }
  }

  private rangeForView(): { from: Date; to: Date } {
    const d = this.currentDate();
    if (this.view() === 'day') return { from: startOfDay(d), to: addDays(startOfDay(d), 1) };
    if (this.view() === 'week') {
      const start = startOfWeek(d);
      return { from: start, to: addDays(start, 7) };
    }
    const cells = buildCalendarGrid(d.getFullYear(), d.getMonth(), 1);
    return { from: cells[0], to: addDays(cells[cells.length - 1], 1) };
  }

  async loadTasks(): Promise<void> {
    this.loading.set(true);
    try {
      const { from, to } = this.rangeForView();
      this.tasks.set(await this.appointmentsSvc.getAppointments({ from, to }));
    } finally {
      this.loading.set(false);
    }
  }

  setView(v: CalendarView): void {
    this.view.set(v);
    this.syncUrl();
    void this.loadTasks();
  }

  goToday(): void {
    this.currentDate.set(startOfDay(new Date()));
    this.syncUrl();
    void this.loadTasks();
  }

  step(delta: number): void {
    const d = this.currentDate();
    const amount = this.view() === 'day' ? delta : this.view() === 'week' ? delta * 7 : 0;
    if (this.view() === 'month') {
      const next = new Date(d.getFullYear(), d.getMonth() + delta, 1);
      this.currentDate.set(next);
    } else {
      this.currentDate.set(addDays(d, amount));
    }
    this.syncUrl();
    void this.loadTasks();
  }

  onMiniCalendarChange(value: unknown): void {
    if (value instanceof Date) {
      this.currentDate.set(startOfDay(value));
      this.syncUrl();
      void this.loadTasks();
    }
  }

  /** The staff the user last hid is remembered per employee (server-side employee options). */
  private async restoreStaffFilter(): Promise<void> {
    const opts = (await this.employeeOptions.get())?.appointments;
    if (opts?.branchId) this.selectedBranchId.set(opts.branchId);
    const saved = opts?.hiddenEmployeeIds;
    if (!saved?.length) return;
    const known = new Set(this.employees().map(e => e.id));
    this.hiddenEmployeeIds.set(new Set(saved.filter(id => known.has(id))));
  }

  selectedBranchLabel = computed(() => {
    const id = this.selectedBranchId();
    const name = id ? this.branchSvc.branches().find(b => b.id === id)?.name : null;
    return `${this.translate.instant('APPOINTMENTS.BRANCH')}: ${name ?? this.translate.instant('APPOINTMENTS.ALL_BRANCHES')}`;
  });

  openBranchPicker(): void {
    this.modal.open<BranchFilterModalComponent, BranchFilterData, string>(BranchFilterModalComponent, {
      size: 'sm',
      data: { options: this.branchOptions(), selected: this.selectedBranchId() ?? '' },
    }).afterClosed().then(id => {
      if (id !== undefined) this.onBranchChange(id);
    });
  }

  onBranchChange(id: string | null): void {
    const branch = id || null;
    this.selectedBranchId.set(branch);
    void this.employeeOptions.patch({
      appointments: { hiddenEmployeeIds: Array.from(this.hiddenEmployeeIds()), branchId: branch },
    });
  }

  openStaffFilter(): void {
    this.modal.open<StaffFilterModalComponent, StaffFilterData, string[]>(StaffFilterModalComponent, {
      size: 'sm',
      data: { employees: this.branchEmployees(), hiddenIds: Array.from(this.hiddenEmployeeIds()) },
    }).afterClosed().then(hidden => {
      if (!hidden) return;
      this.hiddenEmployeeIds.set(new Set(hidden));
      void this.employeeOptions.patch({ appointments: { hiddenEmployeeIds: hidden, branchId: this.selectedBranchId() } });
    });
  }

  toggleEmployee(id: string): void {
    this.hiddenEmployeeIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  color(id: string): string {
    return employeeColor(id);
  }

  newAppointment(employeeId?: string, startTime?: Date, duration?: number, productId?: string, price?: number, extra?: { customerId?: string; walkInContact?: string }): void {
    if (!this.canAdd()) {
      this.toast.error(this.translate.instant('APPOINTMENTS.NO_ADD_PERMISSION'));
      return;
    }
    const at = startTime ?? this.currentDate();
    this.router.navigate(['/appointments/form'], {
      queryParams: {
        mode: 'new',
        date: at.toISOString(),
        ...(employeeId ? { employeeId } : {}),
        ...(duration ? { duration } : {}),
        ...(productId ? { productId } : {}),
        ...(price ? { price } : {}),
        ...(extra?.customerId ? { customerId: extra.customerId } : {}),
        ...(extra?.walkInContact ? { walkIn: extra.walkInContact } : {}),
      },
    });
  }

  /** Google Calendar's "click empty slot → quick popup" gesture. Day view
   *  only — its columns are per-employee, so there's always a concrete
   *  employee for the popup; Week view's day columns have no such context. */
  openQuickCreate(employeeId: string, startTime: Date, duration: number): void {
    if (!this.canAdd()) {
      this.toast.error(this.translate.instant('APPOINTMENTS.NO_ADD_PERMISSION'));
      return;
    }
    const employee = this.employees().find(e => e.id === employeeId);
    const data: QuickCreateData = {
      employeeId,
      employeeName: employee?.name ?? '',
      // The branch picked on the toolbar wins over the staff member's own.
      employeeBranchId: this.selectedBranchId() || employee?.branchId,
      startTime,
      duration,
    };
    this.modal.open<QuickCreatePopoverComponent, QuickCreateData, QuickCreateResult>(QuickCreatePopoverComponent, {
      size: 'sm',
      // "More options" navigates right after this closes. The modal service's
      // history sentinel is popped on a setTimeout(0), which can beat the
      // (lazy-loaded) route's pushState and bounce the navigation straight back.
      manageHistory: false,
      data,
    }).afterClosed().then(result => {
      if (!result) return;
      if (result.action === 'created') {
        // The popover already toasted success on save.
        void this.loadTasks();
      } else {
        this.newAppointment(employeeId, result.startTime ?? startTime, result.duration ?? duration, result.productId, result.price, {
          customerId: result.customerId,
          walkInContact: result.walkInContact,
        });
      }
    });
  }

  openTask(task: AppointmentTask): void {
    this.router.navigate(['/appointments/form'], {
      queryParams: { mode: 'edit', id: task.id, taskId: task.taskId, isInvoiced: task.isInvoiced ? 1 : 0 },
    });
  }

  openPrintSchedule(): void {
    const firstSelected = this.visibleEmployees()[0]?.id ?? null;
    this.modal.open<PrintScheduleModalComponent, PrintScheduleModalData, void>(PrintScheduleModalComponent, {
      size: 'lg',
      data: { employeeId: firstSelected, date: this.currentDate() },
    });
  }

  // ── Day view handlers ──
  onDaySlotClick(e: SlotClickEvent): void {
    this.openQuickCreate(e.employeeId, e.startTime, e.duration ?? 30);
  }

  async onWeekReschedule(e: WeekRescheduleEvent): Promise<void> {
    await this.onReschedule({ task: e.task, employeeId: e.task.employeeId, startTime: e.startTime });
  }

  async onReschedule(e: RescheduleEvent): Promise<void> {
    try {
      await this.appointmentsSvc.updateAppointmentTask({
        taskId: e.task.taskId,
        employeeId: e.employeeId,
        dateTime: e.startTime.toISOString(),
        isInvoiced: !!e.task.isInvoiced,
      });
      this.toast.success(this.translate.instant('APPOINTMENTS.RESCHEDULED'));
      await this.loadTasks();
    } catch {
      this.toast.error(this.translate.instant('APPOINTMENTS.RESCHEDULE_FAILED'));
    }
  }

  async onResize(e: ResizeEvent): Promise<void> {
    const ok = await this.appointmentsSvc.resizeTask(e.task.id, e.task.taskId, e.duration).catch(() => false);
    if (ok) {
      this.toast.success(this.translate.instant('APPOINTMENTS.RESCHEDULED'));
      await this.loadTasks();
    } else {
      // Local task data wasn't mutated — the card's height binding already
      // reverts to the original duration once the drag's inline style clears.
      this.toast.error(this.translate.instant('APPOINTMENTS.RESCHEDULE_FAILED'));
    }
  }

  async onWeekResize(e: WeekResizeEvent): Promise<void> {
    await this.onResize({ task: e.task, duration: e.duration });
  }

  // ── Week view handlers ──
  onWeekSlotClick(e: WeekSlotClickEvent): void {
    // A dragged range over genuinely empty time skips the agenda drawer and
    // goes straight to the form, matching the Day view's drag-to-create.
    if (e.duration && e.tasks.length === 0) {
      this.newAppointment(undefined, e.date, e.duration);
      return;
    }
    this.openAgenda(this.dayTitle(e.date), e.tasks, e.date);
  }

  private dayTitle(d: Date): string {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  onDayHeaderClick(day: Date): void {
    const dayTasks = this.tasks().filter(t => sameDay(new Date(t.serviceDate), day));
    this.openAgenda(formatCalendarDate(day, 'MMMM d, yyyy'), dayTasks, day);
  }

  private openAgenda(title: string, tasks: AppointmentTask[], contextDate: Date): void {
    const data: AgendaDrawerData = { title, tasks, canAdd: this.canAdd() };
    this.modal.open<AgendaDrawerComponent, AgendaDrawerData, AgendaDrawerResult>(AgendaDrawerComponent, {
      drawer: true,
      manageHistory: false, // closes straight into a router navigation (see openQuickCreate)
      data,
    }).afterClosed().then(result => {
      if (!result) return;
      if (result.action === 'new') this.newAppointment(undefined, contextDate);
      else this.openTask(result.task);
    });
  }

  trackByEmployeeId = (_: number, e: EmployeeLite) => e.id;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
