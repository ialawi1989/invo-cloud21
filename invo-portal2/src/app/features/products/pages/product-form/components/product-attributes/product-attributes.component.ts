import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { Product, ProductAttributes } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

/**
 * product-attributes
 * ──────────────────
 * Flat list of named boolean attributes (e.g. "Halal", "Vegan", "Organic").
 * The attribute roster comes from the API on the product itself; we just
 * render checkboxes and maintain `checked` + `showInSearch` on each row.
 */
@Component({
  selector: 'app-pf-product-attributes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './product-attributes.component.html',
  styleUrl: './product-attributes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductAttributesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  rows!: FormArray<FormGroup>;

  ngOnInit(): void {
    const info = this.productInfo();
    const attrs: ProductAttributes[] = info.productAttributes ?? [];

    this.rows = this.fb.array(
      attrs.map((a) => this.fb.group({
        key:          [a['key'] ?? ''],
        title:        [a['title'] ?? ''],
        checked:      [!!a.checked],
        showInSearch: [a.showInSearch ?? null],
      })),
    );
    this.productForm().setControl('productAttributes', this.rows);

    this.rows.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        info.productAttributes = this.rows.controls.map((g) => {
          const v = g.getRawValue() as any;
          return Object.assign(new ProductAttributes(), v);
        });
      });
  }

  rowAt(i: number): FormGroup {
    return this.rows.at(i) as FormGroup;
  }
}
