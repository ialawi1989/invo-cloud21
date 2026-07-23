import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { EmployeeService } from '../../../../services/employee.service';
import {
  EmployeeOffDayPayload,
  ScheduleEmployee,
} from '../../employee-schedule.types';

export interface TimeoffFormData {
  employees: ScheduleEmployee[];
  branchId:  string;
  employee?: ScheduleEmployee | null;
  day?:      { date: string } | null;
  dayOffShift?: { offDayId: string } | null;
}

export interface TimeoffFormResult {
  offDay: EmployeeOffDayPayload;
}

interface TypeOption { value: string; labelKey: string; icon: string; }

const TYPE_OPTIONS: TypeOption[] = [
  { value: 'Annual leave',          labelKey: 'EMPLOYEES.SCHEDULE.ANNUAL_LEAVE', icon: 'bx-sun' },
  { value: 'Sick leave',            labelKey: 'EMPLOYEES.SCHEDULE.SICK_LEAVE',   icon: 'bx-plus-medical' },
  { value: 'Training',              labelKey: 'EMPLOYEES.SCHEDULE.TRAINING',     icon: 'bx-book-open' },
  { value: 'Other absence reasons', labelKey: 'EMPLOYEES.SCHEDULE.OTHER',        icon: 'bx-dots-horizontal-rounded' },
];

/** Item shape fed to the team-member dropdown. */
interface EmployeeOption { id: string; name: string; }

/**
 * timeoff-form (modal)
 * ────────────────────
 * Create / edit a time-off entry (annual, sick, training, other) for a
 * team member with an optional repeat range and note. Editing an
 * existing entry hydrates from `getEmployeeOffDay`. On save it validates
 * the required fields and returns the payload for the board to persist
 * via `saveEmployeeOffDay`.
 */
@Component({
  selector: 'app-timeoff-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    SearchDropdownComponent,
    ToggleComponent,
    DatePickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeoff-form.component.html',
  styleUrl: './timeoff-form.component.scss',
})
export class TimeoffFormComponent {
  private data     = inject<TimeoffFormData>(MODAL_DATA);
  private ref      = inject<ModalRef<TimeoffFormResult>>(MODAL_REF);
  private toast    = inject(ToastService);
  private employeeService = inject(EmployeeService);

  readonly typeOptions = TYPE_OPTIONS;

  employeeOptions: EmployeeOption[] = (this.data.employees ?? []).map((e) => ({
    id:   e.employeeId,
    name: e.employeeName,
  }));

  employeeId  = signal<string | null>(this.data.employee?.employeeId ?? null);
  type        = signal<string>('');
  from        = signal<string>(this.data.day?.date ?? this.today());
  to          = signal<string | null>(null);
  description = signal<string>('');
  isRepeat    = signal<boolean>(false);
  loading     = signal<boolean>(false);

  /** Off-day id when editing an existing entry, else null. */
  private offDayId: string | null = this.data.dayOffShift?.offDayId ?? null;

  employeeDisplay = (o: EmployeeOption) => o?.name ?? '';
  employeeCompare = (a: EmployeeOption, b: EmployeeOption) => a?.id === b?.id;

  /** Selected team-member option (drives the dropdown value). */
  selectedEmployee = computed<EmployeeOption | null>(
    () => this.employeeOptions.find((e) => e.id === this.employeeId()) ?? null,
  );

  onEmployeePick(option: EmployeeOption | EmployeeOption[] | null): void {
    const opt = Array.isArray(option) ? option[0] ?? null : option;
    this.employeeId.set(opt?.id ?? null);
  }

  /** `Date` views of the ISO 'yyyy-MM-dd' signals for `<app-date-picker>`. */
  fromObj = computed<Date | null>(() => this.toDate(this.from()));
  toObj   = computed<Date | null>(() => this.toDate(this.to()));

  onFromDate(d: Date | null): void { this.onFromChange(this.toIso(d) ?? ''); }
  onToDate(d: Date | null): void { this.to.set(this.toIso(d)); }

  totalDays = computed<number>(() => {
    const from = this.from();
    if (!from) return 0;
    const to = this.to();
    if (!this.isRepeat() || !to) return 1;
    const diff = Math.abs(new Date(to).getTime() - new Date(from).getTime());
    return Math.max(1, Math.ceil(diff / 86_400_000) + 1);
  });

  constructor() {
    if (this.offDayId) void this.loadExisting(this.offDayId);
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async loadExisting(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const raw = await this.employeeService.getEmployeeOffDay(id);
      if (raw) {
        this.employeeId.set(raw.employeeId ?? this.employeeId());
        this.type.set(raw.type ?? '');
        this.from.set(this.toDateInput(raw.from) ?? this.from());
        this.to.set(this.toDateInput(raw.to));
        this.description.set(raw.description ?? '');
        if (raw.to && raw.from !== raw.to) this.isRepeat.set(true);
      }
    } finally {
      this.loading.set(false);
    }
  }

  /** Normalise whatever date shape the backend returns to `yyyy-MM-dd`. */
  private toDateInput(v: any): string | null {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toISOString().slice(0, 10);
  }

  // ─── Date <-> ISO 'yyyy-MM-dd' helpers (picker boundary, date-only) ──────
  /** ISO 'yyyy-MM-dd' string → local `Date` (midnight). `null` when empty. */
  private toDate(iso: string | null): Date | null {
    if (!iso) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** `Date` → ISO 'yyyy-MM-dd' string (local parts). `null` for null. */
  private toIso(d: Date | null): string | null {
    if (!d) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  selectType(value: string): void {
    this.type.set(value);
  }

  onRepeatChange(checked: boolean): void {
    this.isRepeat.set(checked);
    if (!checked) this.to.set(null);
  }

  onFromChange(value: string): void {
    this.from.set(value);
    // Reset the end date if it now precedes the new start.
    if (this.to() && this.to()! < value) this.to.set(null);
  }

  save(): void {
    if (!this.employeeId() || !this.type() || !this.from()) {
      this.toast.error('EMPLOYEES.SCHEDULE.REQUIRED_FIELDS');
      return;
    }
    this.ref.close({
      offDay: {
        id:          this.offDayId,
        employeeId:  this.employeeId(),
        branchId:    this.data.branchId,
        type:        this.type(),
        from:        this.from(),
        to:          this.isRepeat() ? this.to() : this.from(),
        description: this.description(),
      },
    });
  }

  cancel(): void {
    this.ref.dismiss();
  }
}
