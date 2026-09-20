import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { addDays, buildCalendarGrid, formatDate as formatCalendarDate, startOfDay } from '@shared/components/datepicker/date-utils';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { EmployeeService } from '../../../employees/services/employee.service';
import { AppointmentsService } from '../../services/appointments.service';
import { AppointmentTask, EmployeeLite } from '../../models/appointment.types';
import { employeeColor } from '../../utils/employee-color';
import { startOfWeek, weekDates } from '../../utils/time-utils';
import { DayViewComponent, RescheduleEvent, ResizeEvent, SlotClickEvent } from './components/day-view/day-view.component';
import { WeekViewComponent, WeekSlotClickEvent, WeekRescheduleEvent, WeekResizeEvent } from './components/week-view/week-view.component';
import { MonthViewComponent } from './components/month-view/month-view.component';
import { AgendaDrawerComponent, AgendaDrawerData, AgendaDrawerResult } from './components/agenda-drawer/agenda-drawer.component';
import { PrintScheduleModalComponent, PrintScheduleModalData } from '../../components/print-schedule-modal/print-schedule-modal.component';
import { QuickCreatePopoverComponent, QuickCreateData, QuickCreateResult } from '../../components/quick-create-popover/quick-create-popover.component';
import { QueryParamsService, enumCodec, ParamDef, StringCodec } from '@shared/services/query-params.service';

type CalendarView = 'day' | 'week' | 'month';

const VIEW_PARAM: ParamDef<CalendarView> = { key: 'view', codec: enumCodec(['day', 'week', 'month'] as const, 'day') };
const DATE_PARAM: ParamDef<string> = { key: 'date', codec: StringCodec };

@Component({
  selector: 'app-appointment-calendar',
  standalone: true,
  imports: [TranslateModule, DatePickerComponent, DayViewComponent, WeekViewComponent, MonthViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './appointment-calendar.component.html',
  styleUrl: './appointment-calendar.component.scss',
})
export class AppointmentCalendarComponent implements OnInit {
  private employeeSvc = inject(EmployeeService);
  private appointmentsSvc = inject(AppointmentsService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private qp = inject(QueryParamsService);
  private privileges = inject(PrivilegeService);

  readonly canAdd = computed(() => this.privileges.check('appointmentsSecurity.actions.add.access'));

  view = signal<CalendarView>(this.qp.read({ view: VIEW_PARAM }).view);
  currentDate = signal<Date>(this.readInitialDate());

  employees = signal<EmployeeLite[]>([]);
  selectedEmployeeIds = signal<Set<string>>(new Set());
  tasks = signal<AppointmentTask[]>([]);
  loading = signal(false);

  visibleEmployees = computed(() => {
    const selected = this.selectedEmployeeIds();
    const all = this.employees();
    return selected.size === 0 ? all : all.filter(e => selected.has(e.id));
  });

  visibleTasks = computed(() => {
    const ids = new Set(this.visibleEmployees().map(e => e.id));
    return this.tasks().filter(t => ids.has(t.employeeId));
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
    await this.loadEmployees();
    await this.loadTasks();
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

  toggleEmployee(id: string): void {
    this.selectedEmployeeIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  color(id: string): string {
    return employeeColor(id);
  }

  newAppointment(employeeId?: string, startTime?: Date, duration?: number, productId?: string, price?: number): void {
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
      employeeBranchId: employee?.branchId,
      startTime,
      duration,
    };
    this.modal.open<QuickCreatePopoverComponent, QuickCreateData, QuickCreateResult>(QuickCreatePopoverComponent, {
      size: 'sm',
      data,
    }).afterClosed().then(result => {
      if (!result) return;
      if (result.action === 'created') {
        // The popover already toasted success on save.
        void this.loadTasks();
      } else {
        this.newAppointment(employeeId, startTime, duration, result.productId, result.price);
      }
    });
  }

  openTask(task: AppointmentTask): void {
    this.router.navigate(['/appointments/form'], {
      queryParams: { mode: 'edit', id: task.id, taskId: task.taskId, isInvoiced: task.isInvoiced ? 1 : 0 },
    });
  }

  openPrintSchedule(): void {
    const firstSelected = Array.from(this.selectedEmployeeIds())[0] ?? null;
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
