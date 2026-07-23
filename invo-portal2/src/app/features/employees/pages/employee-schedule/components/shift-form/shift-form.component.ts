import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';

import {
  ScheduleShift,
  buildTimeOptions,
  noOverlaps,
  validTimeOrder,
} from '../../employee-schedule.types';

export interface ShiftFormData {
  employee: { employeeId: string; employeeName: string; avatar?: string };
  day: {
    date:               string;
    shift:              ScheduleShift[];
    employeeScheduleId: string | null;
  };
  branchId: string;
}

export interface ShiftFormResult {
  branchId:           string;
  employeeId:         string;
  employeeScheduleId: string | null;
  date:               string;
  /** Existing recurring shifts the user removed → saved as exceptions. */
  exceptions:         ScheduleShift[];
  /** Brand-new one-off shifts → saved as additional shifts. */
  additionalShifts:   ScheduleShift[];
}

/**
 * shift-form (modal)
 * ──────────────────
 * Add / edit the worked periods for a single team-member day. Existing
 * recurring shifts render locked (removing one records an exception);
 * new rows are freely editable. On save the component validates overlap
 * and start/end order, then returns the delta for the board to persist
 * via `saveShiftExceptions` / `saveAdditionalShifts`.
 */
@Component({
  selector: 'app-shift-form',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shift-form.component.html',
  styleUrl: './shift-form.component.scss',
})
export class ShiftFormComponent {
  private data  = inject<ShiftFormData>(MODAL_DATA);
  private ref   = inject<ModalRef<ShiftFormResult>>(MODAL_REF);
  private toast = inject(ToastService);

  readonly times = buildTimeOptions();

  employee = this.data.employee;
  date     = this.data.day?.date ?? '';

  /** Existing (locked) shifts — deletable only. */
  existing = signal<ScheduleShift[]>([...(this.data.day?.shift ?? [])]);
  /** New editable shift rows. */
  newShifts = signal<ScheduleShift[]>([]);
  /** Existing shifts the user removed — sent as exceptions. */
  private removed: ScheduleShift[] = [];

  isEdit = computed(() => this.existing().length > 0);

  constructor() {
    // Mirror the legacy behaviour: an empty day opens with one blank row.
    if (this.existing().length === 0) this.addShift();
  }

  addShift(): void {
    this.newShifts.update((rows) => [...rows, { from: '00:00', to: '00:00' }]);
  }

  removeExisting(index: number): void {
    this.existing.update((rows) => {
      const removed = rows[index];
      if (removed) this.removed.push(removed);
      return rows.filter((_, i) => i !== index);
    });
  }

  removeNew(index: number): void {
    this.newShifts.update((rows) => rows.filter((_, i) => i !== index));
  }

  setFrom(shift: ScheduleShift, value: string | string[] | null): void {
    shift.from = Array.isArray(value) ? value[0] ?? '' : value ?? '';
  }
  setTo(shift: ScheduleShift, value: string | string[] | null): void {
    shift.to = Array.isArray(value) ? value[0] ?? '' : value ?? '';
  }

  canSave = computed(() => this.existing().length > 0 || this.newShifts().length > 0);

  save(): void {
    const all = [...this.existing(), ...this.newShifts()];
    if (!noOverlaps(all)) {
      this.toast.error('EMPLOYEES.SCHEDULE.SHIFT_OVERLAP');
      return;
    }
    if (!validTimeOrder(all)) {
      this.toast.error('EMPLOYEES.SCHEDULE.SHIFT_INVALID_TIME');
      return;
    }
    this.ref.close({
      branchId:           this.data.branchId,
      employeeId:         this.employee.employeeId,
      employeeScheduleId: this.data.day?.employeeScheduleId ?? null,
      date:               this.date,
      exceptions:         this.removed,
      additionalShifts:   this.newShifts(),
    });
  }

  cancel(): void {
    this.ref.dismiss();
  }
}
