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
import { ToastService } from '@shared/components/toast/toast.service';

import {
  ScheduleShift,
  noOverlaps,
  validTimeOrder,
} from '../../employee-schedule.types';
import {
  DayShiftsEditorComponent,
  DayShiftsState,
} from '../day-shifts-editor/day-shifts-editor.component';

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
    DayShiftsEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shift-form.component.html',
  styleUrl: './shift-form.component.scss',
})
export class ShiftFormComponent {
  private data  = inject<ShiftFormData>(MODAL_DATA);
  private ref   = inject<ModalRef<ShiftFormResult>>(MODAL_REF);
  private toast = inject(ToastService);

  employee = this.data.employee;
  date     = this.data.day?.date ?? '';

  /** The day's shifts as loaded; the editor owns the editing state. */
  readonly dayShifts: ScheduleShift[] = this.data.day?.shift ?? [];

  /** Latest edit state reported by `<app-day-shifts-editor>`. */
  state = signal<DayShiftsState>({ kept: [], removed: [], added: [] });

  isEdit  = computed(() => this.dayShifts.length > 0);
  canSave = computed(() => this.state().kept.length > 0 || this.state().added.length > 0);

  save(): void {
    const { kept, removed, added } = this.state();
    const all = [...kept, ...added];
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
      exceptions:         removed,
      additionalShifts:   added,
    });
  }

  cancel(): void {
    this.ref.dismiss();
  }
}
