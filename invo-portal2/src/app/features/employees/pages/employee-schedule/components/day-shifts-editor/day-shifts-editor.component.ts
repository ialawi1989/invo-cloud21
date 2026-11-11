import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import {
  ScheduleShift,
  buildEndTimeOptions,
  buildTimeOptions,
} from '../../employee-schedule.types';

/** What the user did to one day's shifts, as the board persists it. */
export interface DayShiftsState {
  /** Existing recurring shifts still in place. */
  kept:    ScheduleShift[];
  /** Existing shifts the user removed → saved as exceptions. */
  removed: ScheduleShift[];
  /** Brand-new one-off shifts → saved as additional shifts. */
  added:   ScheduleShift[];
}

/**
 * day-shifts-editor
 * ─────────────────
 * Edits the worked periods of ONE team-member day. Existing (recurring)
 * shifts render locked — deleting one records an exception — while new rows
 * are freely editable. Shared by the single-shift modal and the single-day
 * mode of the regular-shifts modal so the two can never drift apart.
 *
 * The component owns the editing state and reports it through `stateChange`
 * (once on every reset and after each edit). Changing the `shifts` input — i.e.
 * switching to another day — discards the previous edits and starts over.
 */
@Component({
  selector: 'app-day-shifts-editor',
  standalone: true,
  imports: [CommonModule, TranslateModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-shifts-editor.component.html',
  styleUrl: './day-shifts-editor.component.scss',
})
export class DayShiftsEditorComponent {
  /** The day's existing shifts. */
  readonly shifts = input<ScheduleShift[]>([]);

  readonly stateChange = output<DayShiftsState>();

  readonly times    = buildTimeOptions();
  /** End-of-shift choices: the same list plus 23:59. */
  readonly endTimes = buildEndTimeOptions();

  readonly existing = signal<ScheduleShift[]>([]);
  readonly newShifts = signal<ScheduleShift[]>([]);
  private removed: ScheduleShift[] = [];

  constructor() {
    effect(() => {
      const src = this.shifts();
      untracked(() => this.reset(src));
    });
  }

  private reset(src: ScheduleShift[]): void {
    this.existing.set((src ?? []).map((s) => ({ from: s.from, to: s.to })));
    this.removed = [];
    // Mirror the legacy behaviour: an empty day opens with one blank row.
    this.newShifts.set(this.existing().length ? [] : [{ from: '00:00', to: '00:00' }]);
    this.emit();
  }

  private emit(): void {
    this.stateChange.emit({
      kept:    this.existing(),
      removed: [...this.removed],
      added:   this.newShifts(),
    });
  }

  addShift(): void {
    this.newShifts.update((rows) => [...rows, { from: '00:00', to: '00:00' }]);
    this.emit();
  }

  removeExisting(index: number): void {
    this.existing.update((rows) => {
      const gone = rows[index];
      if (gone) this.removed.push(gone);
      return rows.filter((_, i) => i !== index);
    });
    this.emit();
  }

  removeNew(index: number): void {
    this.newShifts.update((rows) => rows.filter((_, i) => i !== index));
    this.emit();
  }

  setFrom(shift: ScheduleShift, value: string | string[] | null): void {
    shift.from = Array.isArray(value) ? value[0] ?? '' : value ?? '';
    this.emit();
  }

  setTo(shift: ScheduleShift, value: string | string[] | null): void {
    shift.to = Array.isArray(value) ? value[0] ?? '' : value ?? '';
    this.emit();
  }
}
