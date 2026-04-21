import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { Fields } from '../../../../../models/product-fields.model';

/**
 * branch-serials
 * ──────────────
 * Serial-number editor for a single branch. Rows carry:
 *   • serial  — the serial/IMEI/whatever unique string
 *   • unitCost (required)
 *   • expireDate (optional — for serials with a shelf life, e.g. licenses)
 *
 * Inline filter + add-by-input for quick entry. The caller owns the
 * FormArray via @Input, so add/remove mutates the parent branch group.
 */
@Component({
  selector: 'app-pf-branch-serials',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, DatePickerComponent],
  templateUrl: './branch-serials.component.html',
  styleUrl: './branch-serials.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchSerialsComponent {
  private fb = inject(FormBuilder);

  array         = input.required<FormArray<FormGroup>>();
  fieldsOptions = input<Fields | null>(null);

  newSerial = signal<string>('');
  search    = signal<string>('');
  error     = signal<string>('');

  /** Filtered rows (indices into `array`) by search term. */
  visibleIndices = computed<number[]>(() => {
    const term = this.search().trim().toLowerCase();
    const ids: number[] = [];
    this.array().controls.forEach((row, i) => {
      const s = String(row.value['serial'] ?? '').toLowerCase();
      if (!term || s.includes(term)) ids.push(i);
    });
    return ids;
  });

  addSerial(): void {
    const value = this.newSerial().trim();
    this.error.set('');
    if (!value) return;

    const exists = this.array().controls.some(
      (row) => String(row.value['serial'] ?? '').toLowerCase() === value.toLowerCase(),
    );
    if (exists) {
      this.error.set('DUPLICATE');
      return;
    }

    this.array().push(this.fb.group({
      serial:     [value, [Validators.required]],
      unitCost:   [0, [Validators.required, Validators.min(0)]],
      expireDate: [null as Date | null],
    }));
    this.array().markAsDirty();
    this.newSerial.set('');
  }

  removeAt(i: number): void {
    if (i < 0 || i >= this.array().length) return;
    this.array().removeAt(i);
    this.array().markAsDirty();
  }

  rowAt(i: number): FormGroup {
    return this.array().at(i) as FormGroup;
  }

  onNewSerialInput(value: string): void {
    this.newSerial.set(value);
    if (this.error()) this.error.set('');
  }

  onSearchInput(value: string): void {
    this.search.set(value);
  }
}
