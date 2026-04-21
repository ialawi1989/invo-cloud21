import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

/**
 * alias-barcodes
 * ──────────────
 * Additional barcodes the product can be looked up by (multi-pack SKU,
 * supplier barcode, etc.). Stored as `productInfo.barcodesArr` — a plain
 * array of `{ value: string }` rows.
 */
@Component({
  selector: 'app-pf-alias-barcodes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './alias-barcodes.component.html',
  styleUrl: './alias-barcodes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AliasBarcodesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  rows!: FormArray<FormGroup>;
  newBarcode = signal<string>('');
  error = signal<string>('');

  ngOnInit(): void {
    const info = this.productInfo();
    if (!Array.isArray(info.barcodesArr)) info.barcodesArr = [];

    this.rows = this.fb.array(
      info.barcodesArr.map((b: any) =>
        this.fb.group({ value: [b?.value ?? '', [Validators.required]] }),
      ),
    );
    this.productForm().setControl('barcodesArr', this.rows);

    this.rows.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        info.barcodesArr = this.rows.controls.map((g) => ({ value: g.value['value'] ?? '' }));
      });
  }

  addBarcode(): void {
    const v = this.newBarcode().trim();
    this.error.set('');
    if (!v) return;

    // Duplicate check against primary barcode AND existing aliases.
    const exists =
      this.productInfo().barcode === v ||
      this.rows.controls.some((g) => String(g.value['value'] ?? '') === v);
    if (exists) {
      this.error.set('DUPLICATE');
      return;
    }

    this.rows.push(this.fb.group({ value: [v, [Validators.required]] }));
    this.newBarcode.set('');
    this.productForm().markAsDirty();
  }

  removeAt(i: number): void {
    if (i < 0 || i >= this.rows.length) return;
    this.rows.removeAt(i);
    this.productForm().markAsDirty();
  }

  onInput(value: string): void {
    this.newBarcode.set(value);
    if (this.error()) this.error.set('');
  }
}
