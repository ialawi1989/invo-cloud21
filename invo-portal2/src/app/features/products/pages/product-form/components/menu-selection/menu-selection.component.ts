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

import { Product, SelectionItem } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import {
  PickProductModalComponent,
  PickProductModalData,
  PickedProduct,
} from '../pick-product-modal/pick-product-modal.component';

/**
 * menu-selection
 * ──────────────
 * Tiered selection editor for `menuSelection` products — e.g. a meal with
 * 3 sections: "Choose 1 drink", "Choose 2 sides", "Choose 1 dessert".
 *
 * Shape: `selection: SelectionItem[]` where each tier has:
 *   • name             — human label of the tier
 *   • noOfSelection    — how many the customer picks
 *   • items            — list of candidate products
 *
 * Pricing for `totalPrice` / `totalPriceWithDiscount` models is computed
 * via `Product.totalPrice()` (sums the lowest `noOfSelection` prices per
 * tier). Here we just own the editor; the Product model is source of truth.
 */
@Component({
  selector: 'app-pf-menu-selection',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './menu-selection.component.html',
  styleUrl: './menu-selection.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuSelectionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private modal = inject(ModalService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  tiers!: FormArray<FormGroup>;

  totalFromLowestSelections = computed<number>(() => this.productInfo().totalPrice());

  ngOnInit(): void {
    const info = this.productInfo();
    if (!Array.isArray(info.selection)) info.selection = [];

    this.tiers = this.fb.array(info.selection.map((s) => this.buildTier(s)));
    this.productForm().setControl('selection', this.tiers);

    this.tiers.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncBackToModel());
  }

  private buildTier(s: SelectionItem): FormGroup {
    const items = this.fb.array(
      (s.items ?? []).map((it: any) => this.buildItemRow(it)),
    );
    return this.fb.group({
      name:          [s['name'] ?? '', [Validators.required]],
      noOfSelection: [s.noOfSelection ?? 1, [Validators.required, Validators.min(1)]],
      items,
    });
  }

  private buildItemRow(it: any): FormGroup {
    return this.fb.group({
      id:           [it.id ?? ''],
      name:         [it.name ?? ''],
      defaultPrice: [it.defaultPrice ?? 0, [Validators.min(0)]],
      UOM:          [it.UOM ?? ''],
    });
  }

  private syncBackToModel(): void {
    const info = this.productInfo();
    info.selection = this.tiers.controls.map((tier) => {
      const v = tier.getRawValue() as any;
      return {
        name:          v.name ?? '',
        noOfSelection: Number(v.noOfSelection ?? 1),
        items:         (v.items ?? []).map((it: any) => ({
          id:           it.id,
          name:         it.name,
          defaultPrice: Number(it.defaultPrice ?? 0),
          UOM:          it.UOM ?? '',
        })),
      } as SelectionItem;
    });
  }

  addTier(): void {
    this.tiers.push(this.buildTier({
      name:          '',
      noOfSelection: 1,
      items:         [],
    } as any));
    this.productForm().markAsDirty();
  }

  removeTier(i: number): void {
    if (i < 0 || i >= this.tiers.length) return;
    this.tiers.removeAt(i);
    this.productForm().markAsDirty();
  }

  tierAt(i: number): FormGroup {
    return this.tiers.at(i) as FormGroup;
  }

  itemsOf(i: number): FormArray<FormGroup> {
    return this.tierAt(i).get('items') as FormArray<FormGroup>;
  }

  itemAt(tierIdx: number, itemIdx: number): FormGroup {
    return this.itemsOf(tierIdx).at(itemIdx) as FormGroup;
  }

  async openPicker(tierIdx: number): Promise<void> {
    const arr = this.itemsOf(tierIdx);
    const existingIds = arr.controls.map((g) => g.value['id']);
    const ref = this.modal.open<PickProductModalComponent, PickProductModalData, PickedProduct[]>(
      PickProductModalComponent,
      {
        data: {
          types: ['inventory', 'serialized', 'batch', 'service', 'menuItem', 'kit'],
          excludedIds: existingIds,
          multiple: true,
          title: 'Add selection items',
        },
        size: 'md',
      },
    );
    const picked = await ref.afterClosed();
    if (!picked?.length) return;
    picked.forEach((p) => arr.push(this.buildItemRow({
      id:           p.id,
      name:         p.name,
      defaultPrice: p.price ?? 0,
      UOM:          p.UOM ?? '',
    })));
    this.productForm().markAsDirty();
  }

  removeItem(tierIdx: number, itemIdx: number): void {
    const arr = this.itemsOf(tierIdx);
    if (itemIdx < 0 || itemIdx >= arr.length) return;
    arr.removeAt(itemIdx);
    this.productForm().markAsDirty();
  }
}
