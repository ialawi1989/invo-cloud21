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

import { Product, ProductRecipe } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import {
  PickProductModalComponent,
  PickProductModalData,
  PickedProduct,
} from '../pick-product-modal/pick-product-modal.component';

/**
 * recipe-builder
 * ──────────────
 * Ingredient editor for `menuItem` products. Rows reference raw inventory
 * items (or sub-recipes) with a usage quantity. Total cost is
 * Σ (ingredient.unitCost × usages).
 *
 * `inventoryId` vs `recipeId` on ProductRecipe disambiguates the source —
 * we fill `inventoryId` when picking from the product list. Sub-recipe
 * support will come with a dedicated recipe endpoint in a later phase.
 */
@Component({
  selector: 'app-pf-recipe-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './recipe-builder.component.html',
  styleUrl: './recipe-builder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeBuilderComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private modal = inject(ModalService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  rows!: FormArray<FormGroup>;

  totalCost = computed<number>(() => {
    const rows = this.productInfo().recipes ?? [];
    return rows.reduce((sum, r: any) => sum + (Number(r.unitCost ?? 0) * Number(r.usages ?? 0)), 0);
  });

  ngOnInit(): void {
    const info = this.productInfo();
    if (!Array.isArray(info.recipes)) info.recipes = [];

    this.rows = this.fb.array(info.recipes.map((r) => this.buildRow(r)));
    this.productForm().setControl('recipes', this.rows);

    this.rows.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncBackToModel());
  }

  private buildRow(r: ProductRecipe): FormGroup {
    const f = this.fieldsOptions()?.recipe;
    return this.fb.group({
      inventoryId: [r['inventoryId'] ?? ''],
      recipeId:    [r['recipeId']    ?? null],
      name:        [r['name']        ?? ''],
      UOM:         [r['UOM']         ?? ''],
      unitCost:    [r['unitCost']    ?? 0, [Validators.min(0)]],
      usages:      [r['usages']      ?? 1,
                    f?.usages?.isRequired
                      ? [Validators.required, Validators.min(0.0001)]
                      : [Validators.min(0.0001)]],
    });
  }

  private syncBackToModel(): void {
    const info = this.productInfo();
    info.recipes = this.rows.controls.map((grp) => {
      const v = grp.getRawValue() as any;
      return {
        inventoryId: v.inventoryId ?? '',
        recipeId:    v.recipeId ?? null,
        name:        v.name ?? '',
        UOM:         v.UOM ?? '',
        unitCost:    Number(v.unitCost ?? 0),
        usages:      Number(v.usages ?? 0),
      } as ProductRecipe;
    });
  }

  async openPicker(): Promise<void> {
    // Only inventory-style products make sense as recipe ingredients.
    const existingIds = this.rows.controls
      .map((g) => (g.value as any).inventoryId || (g.value as any).recipeId);
    const ref = this.modal.open<PickProductModalComponent, PickProductModalData, PickedProduct[]>(
      PickProductModalComponent,
      {
        data: {
          types: ['inventory', 'serialized', 'batch'],
          excludedIds: existingIds,
          multiple: true,
          title: 'Add recipe ingredients',
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
    const r: ProductRecipe = {
      inventoryId: p.id,
      recipeId:    null,
      name:        p.name,
      UOM:         p.UOM ?? '',
      unitCost:    p.unitCost ?? 0,
      usages:      1,
    };
    this.rows.push(this.buildRow(r));
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
