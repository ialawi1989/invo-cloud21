import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { ModalService } from '@shared/modal/modal.service';

import { Product, PackageItem } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import {
  PickProductModalComponent,
  PickProductModalData,
  PickedProduct,
  PickProductResult,
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
  private cdr = inject(ChangeDetectorRef);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  rows!: FormArray<FormGroup>;

  /** Mirrors `rows.length` as a signal so dependent computeds re-run on
   *  push/remove. Reading the FormArray directly isn't reactive. */
  private rowCount = signal<number>(0);
  /** Bumped on every row value change so `totalPrice` re-runs on field edits. */
  private rowsVersion = signal<number>(0);

  totalPrice = computed<number>(() => {
    this.rowCount();
    this.rowsVersion();
    return this.productInfo().totalPrice();
  });

  /** True when the section is required by `fieldsOptions` and the list is empty. */
  isRequiredEmpty = computed<boolean>(() =>
    !!this.fieldsOptions()?.packageBuilder?.isRequired
    && this.rowCount() === 0,
  );

  ngOnInit(): void {
    const info = this.productInfo();
    if (!Array.isArray(info.package)) info.package = [];

    this.rows = this.fb.array(info.package.map((p) => this.buildRow(p)));
    // When `packageBuilder.isRequired` is on, an empty list should make the
    // FormArray itself invalid so the parent form's `errorCount` ticks up
    // and the Save button is disabled.
    if (this.fieldsOptions()?.packageBuilder?.isRequired) {
      this.rows.addValidators((arr) => (arr.value?.length ?? 0) === 0 ? { required: true } : null);
      this.rows.updateValueAndValidity({ emitEvent: false });
    }
    this.rowCount.set(this.rows.length);
    this.productForm().setControl('package', this.rows);

    this.rows.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.syncBackToModel();
        this.rowsVersion.update((n) => n + 1);
      });
  }

  private buildRow(p: PackageItem): FormGroup {
    const f = this.fieldsOptions()?.packageBuilder;
    return this.fb.group({
      productId:    [p.productId ?? ''],
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
        productId:    v.productId,
        name:         v.name,
        defaultPrice: Number(v.defaultPrice ?? 0),
        qty:          v.qty == null || v.qty === '' ? null : Number(v.qty),
      } as PackageItem;
    });
  }

  async openPicker(): Promise<void> {
    const existingIds = this.rows.controls.map((g) => g.value['productId']);
    const ref = this.modal.open<PickProductModalComponent, PickProductModalData, PickProductResult>(
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
    const result = await ref.afterClosed();
    if (!result) return;
    if (!result.added.length && !result.removed.length) return;
    if (result.removed.length) {
      const removeSet = new Set(result.removed);
      for (let i = this.rows.length - 1; i >= 0; i--) {
        if (removeSet.has(this.rows.at(i).value['productId'])) this.rows.removeAt(i);
      }
    }
    result.added.forEach((p) => this.addFromPick(p));
    this.rowCount.set(this.rows.length);
    this.productForm().markAsDirty();
    // OnPush + post-await mutation: tell the view to re-check so the new
    // rows render. The click event that opened the modal already finished
    // its CD pass by the time `afterClosed` resolves.
    this.cdr.markForCheck();
  }

  private addFromPick(p: PickedProduct): void {
    const item: PackageItem = {
      productId:    p.id,
      name:         p.name,
      defaultPrice: p.price ?? 0,
      qty:          1,
    };
    this.rows.push(this.buildRow(item));
  }

  removeRow(i: number): void {
    if (i < 0 || i >= this.rows.length) return;
    this.rows.removeAt(i);
    this.rowCount.set(this.rows.length);
    this.productForm().markAsDirty();
    this.cdr.markForCheck();
  }

  rowAt(i: number): FormGroup {
    return this.rows.at(i) as FormGroup;
  }
}
