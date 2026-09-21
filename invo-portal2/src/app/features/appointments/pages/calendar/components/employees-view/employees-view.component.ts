import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { QueryParamsService, StringArrayCodec, StringCodec, enumCodec, ParamDef } from '@shared/services/query-params.service';
import { TranslateModule } from '@ngx-translate/core';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { AppointmentTask, appointmentStatus, EmployeeLite } from '../../../../models/appointment.types';
import { employeeColor } from '../../../../utils/employee-color';
import { formatTimeAmPm } from '../../../../utils/time-utils';

type GroupBy = 'employee' | 'time';
type FilterField = 'employee' | 'status' | 'service' | 'customer' | 'date';
type DatePreset = 'today' | 'tomorrow' | 'next7' | 'month';

interface FilterOption { value: string; label: string; }
interface ActiveChip { field: FilterField; label: string; text: string; }
type TimeFilter = 'all' | 'upcoming' | 'previous';

const GROUP_PARAM: ParamDef<GroupBy> = { key: 'group', codec: enumCodec(['employee', 'time'] as const, 'employee') };
const WHEN_PARAM: ParamDef<TimeFilter> = { key: 'when', codec: enumCodec(['all', 'upcoming', 'previous'] as const, 'all') };
const F_EMP: ParamDef<string[]> = { key: 'femp', codec: StringArrayCodec };
const F_STATUS: ParamDef<string[]> = { key: 'fstatus', codec: StringArrayCodec };
const F_SERVICE: ParamDef<string[]> = { key: 'fservice', codec: StringArrayCodec };
const F_CUSTOMER: ParamDef<string[]> = { key: 'fcustomer', codec: StringArrayCodec };
const F_DATE: ParamDef<string> = { key: 'fdate', codec: StringCodec };

interface ListGroup {
  key: string;
  title: string;
  /** Header tint. */
  tint: string;
  employee?: EmployeeLite;
  tasks: AppointmentTask[];
}

/**
 * List mode of the calendar (Huly-style): appointments as collapsible groups,
 * either one group per employee, or Upcoming / Previous. Uses the same
 * filtered tasks as the grid, so branch / staff / search filters apply.
 */
@Component({
  selector: 'app-employees-view',
  standalone: true,
  imports: [TranslateModule, SegmentedToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employees-view.component.html',
  styleUrl: './employees-view.component.scss',
})
export class EmployeesViewComponent {
  employees = input.required<EmployeeLite[]>();
  tasks = input.required<AppointmentTask[]>();
  taskClick = output<AppointmentTask>();

  private qp = inject(QueryParamsService);
  private initial = this.qp.read({
    group: GROUP_PARAM, when: WHEN_PARAM, femp: F_EMP, fstatus: F_STATUS, fservice: F_SERVICE, fcustomer: F_CUSTOMER, fdate: F_DATE,
  });

  groupBy = signal<GroupBy>(this.initial.group);
  filter = signal<TimeFilter>(this.initial.when);
  private collapsedKeys = signal<Set<string>>(new Set());

  // ── Huly-style Filter menu: pick a field, then its values ──────────────────
  menuOpen = signal(false);
  menuField = signal<FilterField | null>(null);
  selected = signal<Record<'employee' | 'status' | 'service' | 'customer', Set<string>>>({
    employee: new Set(this.initial.femp ?? []),
    status: new Set(this.initial.fstatus ?? []),
    service: new Set(this.initial.fservice ?? []),
    customer: new Set(this.initial.fcustomer ?? []),
  });
  datePreset = signal<DatePreset | null>((this.initial.fdate || null) as DatePreset | null);

  /** Mirror the list tools into the URL (defaults / empty values are dropped by the service). */
  private urlSync = effect(() => {
    const sel = this.selected();
    this.qp.write(
      { group: GROUP_PARAM, when: WHEN_PARAM, femp: F_EMP, fstatus: F_STATUS, fservice: F_SERVICE, fcustomer: F_CUSTOMER, fdate: F_DATE },
      {
        group: this.groupBy(), when: this.filter(),
        femp: Array.from(sel.employee), fstatus: Array.from(sel.status),
        fservice: Array.from(sel.service), fcustomer: Array.from(sel.customer),
        fdate: this.datePreset() ?? '',
      },
    );
  });

  readonly fields: { key: FilterField; label: string }[] = [
    { key: 'employee', label: 'APPOINTMENTS.LIST.F_EMPLOYEE' },
    { key: 'date', label: 'APPOINTMENTS.LIST.F_DATE' },
    { key: 'status', label: 'APPOINTMENTS.LIST.F_STATUS' },
    { key: 'service', label: 'APPOINTMENTS.LIST.F_SERVICE' },
    { key: 'customer', label: 'APPOINTMENTS.LIST.F_CUSTOMER' },
  ];
  readonly datePresets: { key: DatePreset; label: string }[] = [
    { key: 'today', label: 'APPOINTMENTS.LIST.D_TODAY' },
    { key: 'tomorrow', label: 'APPOINTMENTS.LIST.D_TOMORROW' },
    { key: 'next7', label: 'APPOINTMENTS.LIST.D_NEXT7' },
    { key: 'month', label: 'APPOINTMENTS.LIST.D_MONTH' },
  ];

  /** Choices for the open field, built from what is actually in the list. */
  options = computed<FilterOption[]>(() => {
    const field = this.menuField();
    const tasks = this.tasks();
    const distinct = (pick: (t: AppointmentTask) => string | undefined | null) =>
      Array.from(new Set(tasks.map(pick).filter((v): v is string => !!v)))
        .sort((a, b) => a.localeCompare(b)).map(v => ({ value: v, label: v }));
    switch (field) {
      case 'employee': return this.employees().map(e => ({ value: e.id, label: e.name }));
      case 'status': return [
        { value: 'booked', label: 'APPOINTMENTS.LIST.S_BOOKED' },
        { value: 'checked-in', label: 'APPOINTMENTS.LIST.S_CHECKED_IN' },
        { value: 'paid', label: 'APPOINTMENTS.LIST.S_PAID' },
      ];
      case 'service': return distinct(t => t.serviceName);
      case 'customer': return distinct(t => t.customerName);
      default: return [];
    }
  });

  toggleMenu(): void {
    this.menuOpen.update(o => !o);
    this.menuField.set(null);
  }

  isChecked(field: FilterField, value: string): boolean {
    return field !== 'date' && this.selected()[field].has(value);
  }

  toggleValue(field: FilterField, value: string): void {
    if (field === 'date') return;
    this.selected.update(s => {
      const next = new Set(s[field]);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...s, [field]: next };
    });
  }

  setDate(preset: DatePreset): void {
    this.datePreset.update(p => (p === preset ? null : preset));
    this.menuOpen.set(false);
  }

  clearField(field: FilterField): void {
    if (field === 'date') { this.datePreset.set(null); return; }
    this.selected.update(s => ({ ...s, [field]: new Set() }));
  }

  clearAll(): void {
    this.selected.set({ employee: new Set(), status: new Set(), service: new Set(), customer: new Set() });
    this.datePreset.set(null);
  }

  /** Removable chips shown beside the Filter button. */
  chips = computed<ActiveChip[]>(() => {
    const out: ActiveChip[] = [];
    const sel = this.selected();
    const names = new Map(this.employees().map(e => [e.id, e.name]));
    for (const f of this.fields) {
      if (f.key === 'date') {
        const p = this.datePreset();
        if (p) out.push({ field: 'date', label: f.label, text: this.datePresets.find(d => d.key === p)!.label });
        continue;
      }
      const values = Array.from(sel[f.key]);
      if (!values.length) continue;
      const text = f.key === 'employee' ? values.map(v => names.get(v) ?? v).join(', ') : values.join(', ');
      out.push({ field: f.key, label: f.label, text });
    }
    return out;
  });

  private matchesDate(t: AppointmentTask, preset: DatePreset): boolean {
    const d = new Date(t.serviceDate);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const dayMs = 86_400_000;
    const diff = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / dayMs);
    switch (preset) {
      case 'today': return diff === 0;
      case 'tomorrow': return diff === 1;
      case 'next7': return diff >= 0 && diff < 7;
      case 'month': return d.getMonth() === start.getMonth() && d.getFullYear() === start.getFullYear();
    }
  }

  readonly groupOptions: SegmentedToggleOption<GroupBy>[] = [
    { value: 'employee', label: 'APPOINTMENTS.LIST.BY_EMPLOYEE' },
    { value: 'time', label: 'APPOINTMENTS.LIST.BY_TIME' },
  ];
  readonly filterOptions: SegmentedToggleOption<TimeFilter>[] = [
    { value: 'all', label: 'APPOINTMENTS.LIST.ALL' },
    { value: 'upcoming', label: 'APPOINTMENTS.LIST.UPCOMING' },
    { value: 'previous', label: 'APPOINTMENTS.LIST.PREVIOUS' },
  ];

  private isUpcoming(t: AppointmentTask): boolean {
    return new Date(t.serviceDate).getTime() >= Date.now();
  }

  private filtered = computed(() => {
    const f = this.filter();
    const sel = this.selected();
    const preset = this.datePreset();
    return this.tasks().filter(t =>
      (f === 'all' || (f === 'upcoming') === this.isUpcoming(t)) &&
      (!sel.employee.size || sel.employee.has(t.employeeId)) &&
      (!sel.status.size || sel.status.has(appointmentStatus(t))) &&
      (!sel.service.size || sel.service.has(t.serviceName)) &&
      (!sel.customer.size || sel.customer.has(t.customerName)) &&
      (!preset || this.matchesDate(t, preset)));
  });

  total = computed(() => this.filtered().length);

  groups = computed<ListGroup[]>(() => {
    const byTime = (a: AppointmentTask, b: AppointmentTask) =>
      new Date(a.serviceDate).getTime() - new Date(b.serviceDate).getTime();
    const tasks = this.filtered();

    if (this.groupBy() === 'time') {
      const upcoming = tasks.filter(t => this.isUpcoming(t)).sort(byTime);
      const previous = tasks.filter(t => !this.isUpcoming(t)).sort((a, b) => byTime(b, a));
      return [
        { key: 'upcoming', title: 'APPOINTMENTS.LIST.UPCOMING', tint: '#dbe8f6', tasks: upcoming },
        { key: 'previous', title: 'APPOINTMENTS.LIST.PREVIOUS', tint: '#e5e7eb', tasks: previous },
      ].filter(g => g.tasks.length > 0 || this.filter() === 'all');
    }

    // A filter narrows the groups too, not just the rows: only the chosen staff, and
    // (once any filter is active) no empty groups.
    const chosen = this.selected().employee;
    const narrowed = this.chips().length > 0 || this.filter() !== 'all';
    return this.employees()
      // Explicitly chosen staff always show (even with nothing to list); otherwise hide empty groups while filtering.
      .filter(e => chosen.size ? chosen.has(e.id) : (!narrowed || tasks.some(t => t.employeeId === e.id)))
      .map(employee => ({
      key: employee.id,
      title: employee.name,
      tint: `color-mix(in srgb, ${employeeColor(employee.id)} 18%, white)`,
      employee,
      tasks: tasks.filter(t => t.employeeId === employee.id).sort(byTime),
    }));
  });

  isCollapsed(key: string): boolean { return this.collapsedKeys().has(key); }

  toggle(key: string): void {
    this.collapsedKeys.update(set => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  color(id: string): string { return employeeColor(id); }
  initials(name: string): string { return name.trim().charAt(0).toUpperCase() || '?'; }
  status(t: AppointmentTask) { return appointmentStatus(t); }

  employeeName(t: AppointmentTask): string { return t.employeeName; }

  dateLabel(t: AppointmentTask): string {
    return new Date(t.serviceDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  timeRange(t: AppointmentTask): string {
    const start = new Date(t.serviceDate);
    const end = new Date(start.getTime() + t.serviceDuration * 60_000);
    return `${formatTimeAmPm(start)} – ${formatTimeAmPm(end)}`;
  }

  trackGroup = (_: number, g: ListGroup) => g.key;
}
