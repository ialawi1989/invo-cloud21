import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
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

import { Fields } from '../../../../../models/product-fields.model';

/**
 * branch-price-by-qty
 * ───────────────────
 * Nested FormArray editor: qty / price pairs. Owned by the parent branch
 * FormGroup — this component only mutates the array it receives.
 */
@Component({
  selector: 'app-pf-branch-price-by-qty',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './branch-price-by-qty.component.html',
  styleUrl: './branch-price-by-qty.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchPriceByQtyComponent {
  private fb = inject(FormBuilder);

  array         = input.required<FormArray<FormGroup>>();
  fieldsOptions = input<Fields | null>(null);

  addRow(): void {
    const arr = this.array();
    arr.push(this.fb.group({
      qty:   [null, [Validators.required, Validators.min(0)]],
      price: [null, [Validators.required, Validators.min(0)]],
    }));
    arr.markAsDirty();
  }

  removeRow(idx: number): void {
    const arr = this.array();
    if (idx < 0 || idx >= arr.length) return;
    arr.removeAt(idx);
    arr.markAsDirty();
  }

  rowAt(i: number): FormGroup {
    return this.array().at(i) as FormGroup;
  }
}
