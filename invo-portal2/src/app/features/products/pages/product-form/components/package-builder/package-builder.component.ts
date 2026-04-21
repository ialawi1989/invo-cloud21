import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { ModalService } from '@shared/modal/modal.service';

import { Product, PackageItem } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import {
  PickProductModalComponent,
  PickProductModalData,
  PickedProduct,
} from '../pick-product-modal/pick-product-modal.component';

/**
 * package-builder
 * ───────────────
 * Bundled `package` products. Each line has its own quantity. Pricing on
 * the parent Product model (`priceModel.model === 'totalPrice'`) derives
 * the package price from the sum of line `defaultPrice × qty` — see
 * `Product.totalPrice()`.
 */
@Component({
  selector: 'app-pf-package-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './package-builder.component.html',
  styleUrl: './package-builder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PackageBuilderComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private modal = inject(ModalService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  rows!: FormArray<FormGroup>;

  totalPrice = computed<number>(() => this.productInfo().totalPrice());

  ngOnInit(): void {
    const info = this.productInfo();
    if (!Array.isArray(info.package)) info.package = [];

    this.rows = this.fb.array(info.package.map((p) => this.buildRow(p)));
    this.productForm().setControl('package', this.rows);

    this.rows.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncBackToModel());
  }

  private buildRow(p: PackageItem): FormGroup {
    const f = this.fieldsOptions()?.packageBuilder;
    return this.fb.group({
      id:           [p.id ?? ''],
      name:         [p.name ?? ''],
      defaultPrice: [p['defaultPrice'] ?? 0, [Validators.min(0)]],
      qty:          [p.qty ?? 1,
                     f?.productQty?.isRequired
                       ? [Validators.required, Validators.min(0.0001)]
                       : [Validators.min(0.0001)]],
    });
  }

  private syncBackToModel(): void {
    const info = this.productInfo();
    info.package = this.rows.controls.map((grp) => {
      const v = grp.getRawValue() as any;
      return {
        id:           v.id,
        name:         v.name,
        defaultPrice: Number(v.defaultPrice ?? 0),
        qty:          v.qty == null || v.qty === '' ? null : Number(v.qty),
      } as PackageItem;
    });
  }

  async openPicker(): Promise<void> {
    const existingIds = this.rows.controls.map((g) => g.value['id']);
    const ref = this.modal.open<PickProductModalComponent, PickProductModalData, PickedProduct[]>(
      PickProductModalComponent,
      {
        data: {
          types: ['inventory', 'serialized', 'batch', 'service', 'kit'],
          excludedIds: existingIds,
          multiple: true,
          title: 'Add package products',
        },
        size: 'md',
      },
    );
    const picked = await ref.afterClosed();
    if (!picked?.length) return;
    picked.forEach((p) => this.addFromPick(p));
    this.productForm().markAsDirty();
  }

  private addFromPick(p: PickedProduct): void {
    const item: PackageItem = {
      id:           p.id,
      name:         p.name,
      defaultPrice: p.price ?? 0,
      qty:          1,
    };
    this.rows.push(this.buildRow(item));
  }

  removeRow(i: number): void {
    if (i < 0 || i >= this.rows.length) return;
    this.rows.removeAt(i);
    this.productForm().markAsDirty();
  }

  rowAt(i: number): FormGroup {
    return this.rows.at(i) as FormGroup;
  }
}
