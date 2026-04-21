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
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { Fields } from '../../../../../models/product-fields.model';

/**
 * branch-batches
 * ──────────────
 * Batch editor for a single branch. Each row has batch name, barcode,
 * on-hand, unit cost, production date, and expiry date. Cross-row
 * duplicate-name check lives on add; cross-field rule (expire > prod)
 * lives as a FormGroup-level validator so it fires on either date change.
 */
@Component({
  selector: 'app-pf-branch-batches',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, DatePickerComponent],
  templateUrl: './branch-batches.component.html',
  styleUrl: './branch-batches.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchBatchesComponent {
  private fb = inject(FormBuilder);

  array         = input.required<FormArray<FormGroup>>();
  fieldsOptions = input<Fields | null>(null);

  newBatchName = signal<string>('');
  search       = signal<string>('');
  error        = signal<string>('');

  visibleIndices = computed<number[]>(() => {
    const term = this.search().trim().toLowerCase();
    const out: number[] = [];
    this.array().controls.forEach((row, i) => {
      const s = String(row.value['batch'] ?? '').toLowerCase();
      if (!term || s.includes(term)) out.push(i);
    });
    return out;
  });

  /** Cross-field validator: expireDate must strictly follow prodDate. */
  private dateRangeValidator = (group: AbstractControl): ValidationErrors | null => {
    const prod   = group.get('prodDate')?.value   as Date | null;
    const expire = group.get('expireDate')?.value as Date | null;
    if (!prod || !expire) return null;
    const p = prod   instanceof Date ? prod.getTime()   : new Date(prod).getTime();
    const e = expire instanceof Date ? expire.getTime() : new Date(expire).getTime();
    return e > p ? null : { expireBeforeProd: true };
  };

  addBatch(): void {
    const name = this.newBatchName().trim();
    this.error.set('');
    if (!name) return;

    const dup = this.array().controls.some(
      (row) => String(row.value['batch'] ?? '').toLowerCase() === name.toLowerCase(),
    );
    if (dup) {
      this.error.set('DUPLICATE');
      return;
    }

    const grp = this.fb.group(
      {
        batch:      [name, [Validators.required]],
        barcode:    [''],
        onHand:     [null, [Validators.required, Validators.min(0)]],
        unitCost:   [0,    [Validators.min(0)]],
        prodDate:   [null as Date | null],
        expireDate: [null as Date | null],
      },
      { validators: this.dateRangeValidator },
    );
    this.array().push(grp);
    this.array().markAsDirty();
    this.newBatchName.set('');
  }

  removeAt(i: number): void {
    if (i < 0 || i >= this.array().length) return;
    this.array().removeAt(i);
    this.array().markAsDirty();
  }

  rowAt(i: number): FormGroup {
    return this.array().at(i) as FormGroup;
  }

  hasDateError(i: number): boolean {
    const grp = this.rowAt(i);
    return !!grp.errors?.['expireBeforeProd'];
  }

  onNewNameInput(value: string): void {
    this.newBatchName.set(value);
    if (this.error()) this.error.set('');
  }

  onSearchInput(value: string): void {
    this.search.set(value);
  }
}
