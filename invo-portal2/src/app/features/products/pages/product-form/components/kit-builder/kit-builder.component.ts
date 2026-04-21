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

import { Product, KitBuilderItem } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import {
  PickProductModalComponent,
  PickProductModalData,
  PickedProduct,
} from '../pick-product-modal/pick-product-modal.component';

/**
 * kit-builder
 * ───────────
 * Composition editor for `kit` products. A kit is a bundle of N child
 * products, each with its own quantity. Total unit cost is derived from
 * `Σ (child.unitCost × child.qty)` — kept on the Product model as
 * `calculateTotalUnitCostForKit`.
 *
 * Also renders the `UOM` field (old project split this into `kit-details`
 * — folded here since UOM is the only field that component carried).
 */
@Component({
  selector: 'app-pf-kit-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './kit-builder.component.html',
  styleUrl: './kit-builder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KitBuilderComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private modal = inject(ModalService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  rows!: FormArray<FormGroup>;

  totalCost = computed<number>(() => {
    // Drive the Product getter with the current rows so the value is
    // fresh even before the blur-out.
    return this.productInfo().calculateTotalUnitCostForKit;
  });

  ngOnInit(): void {
    const info = this.productInfo();
    if (!Array.isArray(info.kitBuilder)) info.kitBuilder = [];

    this.rows = this.fb.array(
      info.kitBuilder.map((k) => this.buildRow(k)),
    );
    this.productForm().setControl('kitBuilder', this.rows);

    // One-way sync — writes rows back into `info.kitBuilder` so the
    // `calculateTotalUnitCostForKit` getter stays accurate.
    this.rows.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncBackToModel());
  }

  private buildRow(k: KitBuilderItem): FormGroup {
    const f = this.fieldsOptions()?.kitBuilder;
    return this.fb.group({
      id:       [k.id ?? ''],
      name:     [k.name ?? ''],
      UOM:      [k['UOM'] ?? ''],
      unitCost: [k.unitCost ?? 0, [Validators.min(0)]],
      qty:      [k.qty ?? 1,
                 f?.qty?.isRequired
                   ? [Validators.required, Validators.min(0.0001)]
                   : [Validators.min(0.0001)]],
    });
  }

  private syncBackToModel(): void {
    const info = this.productInfo();
    info.kitBuilder = this.rows.controls.map((grp) => {
      const v = grp.getRawValue() as any;
      return {
        id:       v.id,
        name:     v.name,
        UOM:      v.UOM,
        unitCost: Number(v.unitCost ?? 0),
        qty:      v.qty == null || v.qty === '' ? null : Number(v.qty),
      } as KitBuilderItem;
    });
  }

  async openPicker(): Promise<void> {
    const existingIds = this.rows.controls.map((g) => g.value['id']);
    const ref = this.modal.open<PickProductModalComponent, PickProductModalData, PickedProduct[]>(
      PickProductModalComponent,
      {
        data: {
          types: ['inventory', 'serialized', 'batch'],
          excludedIds: existingIds,
          multiple: true,
          title: 'Add kit components',
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
    const item: KitBuilderItem = {
      id:       p.id,
      name:     p.name,
      UOM:      p.UOM,
      unitCost: p.unitCost ?? 0,
      qty:      1,
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
