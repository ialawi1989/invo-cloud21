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

import { ProductCrudService } from '../../../../../services/product-crud.service';
import { Fields } from '../../../../../models/product-fields.model';
import { Product } from '../../../../../models/product-form.model';

/**
 * branch-batches
 * ──────────────
 * Batch editor for a single branch. Each row renders as a card carrying
 * batch / barcode / on-hand / unit-cost / prod-date / expire-date. The
 * cross-field rule (expire > prod) lives as a FormGroup-level validator
 * so it fires on either date change.
 *
 * Footer surfaces a quick "Valid X / Expired Y" tally — `Expired` means
 * `expireDate < today` so users can spot stale batches at a glance.
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
  private productCrud = inject(ProductCrudService);

  array         = input.required<FormArray<FormGroup>>();
  fieldsOptions = input<Fields | null>(null);
  productInfo   = input<Product | null>(null);

  newBatchName = signal<string>('');
  search       = signal<string>('');
  error        = signal<string>('');

  /**
   * Ticks on every FormArray mutation from within this component.
   * `array()` returns the same FormArray reference after push/removeAt, so
   * computeds that iterate `controls` need a separate signal dep to re-run.
   */
  private arrayTick = signal(0);

  visibleIndices = computed<number[]>(() => {
    this.arrayTick();
    const term = this.search().trim().toLowerCase();
    const out: number[] = [];
    this.array().controls.forEach((row, i) => {
      const s = String(row.getRawValue()['batch'] ?? '').toLowerCase();
      if (!term || s.includes(term)) out.push(i);
    });
    return out;
  });

  /** Today at 00:00 — used as the cutoff for "expired". Computed once per tick. */
  private todayMidnight = computed<number>(() => {
    void this.arrayTick();
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });

  validCount = computed<number>(() => {
    this.arrayTick();
    return this.array().controls.filter((row) => !this.rowIsExpired(row.getRawValue())).length;
  });

  expiredCount = computed<number>(() => {
    this.arrayTick();
    return this.array().controls.filter((row) => this.rowIsExpired(row.getRawValue())).length;
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
      (row) => String(row.getRawValue()['batch'] ?? '').toLowerCase() === name.toLowerCase(),
    );
    if (dup) {
      this.error.set('DUPLICATE');
      return;
    }

    // Mirror the parent's convention: barcode = `<product barcode>-<batch name>`
    // — keeps freshly-added rows consistent with what loaded ones display.
    const productBarcode = String(this.productInfo()?.barcode ?? '');
    const initialBarcode = productBarcode ? `${productBarcode}-${name}` : '';
    const grp = this.fb.group(
      {
        batch:      [name, [Validators.required]],
        barcode:    [initialBarcode],
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
    this.arrayTick.update(n => n + 1);
  }

  removeAt(i: number): void {
    if (i < 0 || i >= this.array().length) return;
    this.array().removeAt(i);
    this.array().markAsDirty();
    this.arrayTick.update(n => n + 1);
  }

  rowAt(i: number): FormGroup {
    return this.array().at(i) as FormGroup;
  }

  /**
   * Read a field via `getRawValue()` so disabled (saved-batch) groups still
   * surface their values to the template. Plain `.value` skips disabled
   * children, which would blank out every read once a batch is locked.
   */
  rowVal(i: number, key: string): any {
    return this.rowAt(i).getRawValue()[key];
  }

  hasDateError(i: number): boolean {
    const grp = this.rowAt(i);
    return !!grp.errors?.['expireBeforeProd'];
  }

  isExpired(i: number): boolean {
    return this.rowIsExpired(this.rowAt(i).getRawValue());
  }

  /**
   * True for batches that already exist on the server — they carry an `id`
   * and the parent locks the FormGroup so all fields render disabled. The
   * delete button is also suppressed for these.
   */
  isSaved(i: number): boolean {
    return !!this.rowVal(i, 'id');
  }

  /** Template helper — true when the unit-cost is zero (or empty) at this row. */
  isCostFree(i: number): boolean {
    const v = this.rowVal(i, 'unitCost');
    return v == null || v === '' || Number(v) === 0;
  }

  onBarcode(i: number): void {
    const row = this.rowAt(i).getRawValue() as Record<string, unknown>;
    const info = this.productInfo();
    if (!info) return;
    this.productCrud.showGenerateBarcode(info, 'batch', row);
  }

  onNewNameInput(value: string): void {
    this.newBatchName.set(value);
    if (this.error()) this.error.set('');
  }

  onSearchInput(value: string): void {
    this.search.set(value);
  }

  // ── Internals ───────────────────────────────────────────────────
  private rowIsExpired(v: { expireDate?: unknown }): boolean {
    const raw = v?.expireDate;
    if (!raw) return false;
    const t = raw instanceof Date ? raw.getTime() : new Date(raw as string | number).getTime();
    if (Number.isNaN(t)) return false;
    return t < this.todayMidnight();
  }
}
