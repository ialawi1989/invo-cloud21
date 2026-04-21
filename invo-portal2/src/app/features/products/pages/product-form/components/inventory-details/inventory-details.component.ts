import {
  ChangeDetectionStrategy,
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
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DropdownLoadFn, DropdownLoadResult } from '@shared/components/dropdown/search-dropdown.types';

import { ProductsService } from '../../../../services/products.service';
import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

interface DropdownItem { label: string; value: string; }
interface UomItem       { label: string; value: string; }

/**
 * inventory-details
 * ─────────────────
 * UOM picker + is-child toggle + parent-product selector + child qty.
 *
 * When `isChild` flips, we:
 *   - add/remove the `parentId` control and its Required validator
 *   - disable/enable the pricing `unitCost` control on the parent FormGroup
 *     (pricing card owns that control, but the rule lives here in the old
 *      form too — kept consistent)
 *   - recompute the child's unit cost via `productInfo.onTypeChildQty()`
 */
@Component({
  selector: 'app-pf-inventory-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, SearchDropdownComponent],
  templateUrl: './inventory-details.component.html',
  styleUrl: './inventory-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryDetailsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private productsService = inject(ProductsService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  group!: FormGroup;
  isChild = signal<boolean>(false);

  uomOptions: UomItem[] = [
    { label: 'Kg',     value: 'Kg' },
    { label: 'gram',   value: 'gram' },
    { label: 'Litre',  value: 'Litre' },
    { label: 'Galone', value: 'Galone' },
    { label: 'Ounce',  value: 'Ounce' },
    { label: 'Quart',  value: 'Quart' },
    { label: 'CTN',    value: 'CTN' },
    { label: 'BAG',    value: 'BAG' },
    { label: 'BUNDLE', value: 'BUNDLE' },
    { label: 'Pcs',    value: 'Pcs' },
  ];

  showParent = computed(() => this.isChild() && !!this.fieldsOptions()?.inventoryDetails?.parentItem?.isVisible);
  showChildQty = computed(() => this.isChild() && !!this.fieldsOptions()?.inventoryDetails?.childQty?.isVisible);

  loadParentProducts: DropdownLoadFn<DropdownItem> = async ({ page, pageSize, search }) => {
    const info = this.productInfo();
    const res = await this.productsService.getChildProducts({
      page,
      pageSize,
      search,
      productId: info.id || null,
      parentId: info.parentId || null,
    });
    return { items: res.items as DropdownItem[], hasMore: res.hasMore } as DropdownLoadResult<DropdownItem>;
  };

  ngOnInit(): void {
    const info = this.productInfo();
    const f = this.fieldsOptions();
    const invD = f?.inventoryDetails;

    // Initial is-child flag from API payload: parentId presence means child.
    const initiallyChild = !!info.parentId;
    info.isChild = initiallyChild;
    this.isChild.set(initiallyChild);

    this.group = this.fb.group({
      UOM:      [info.UOM || '',
                 invD?.UOM?.isRequired ? [Validators.required] : []],
      isChild:  [initiallyChild],
      parentId: [info.parentId ?? null,
                 initiallyChild && invD?.parentItem?.isRequired ? [Validators.required] : []],
      childQty: [info.childQty ?? 1,
                 invD?.childQty?.isRequired
                   ? [Validators.required, Validators.min(1)]
                   : [Validators.min(1)]],
    });

    this.productForm().setControl('inventoryDetails', this.group);

    // If starting as a child item, fetch parent product info to compute unit cost.
    if (initiallyChild && info.parentId) {
      this.loadParentInfo(info.parentId);
    }

    // isChild toggle effects
    this.group.controls['isChild'].valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((checked: boolean) => {
        this.isChild.set(!!checked);
        info.isChild = !!checked;
        if (!checked) {
          info.parentId = null;
          this.group.patchValue({ parentId: null }, { emitEvent: false });
          this.group.controls['parentId'].clearValidators();
          this.group.controls['parentId'].updateValueAndValidity({ emitEvent: false });
          // Re-enable unit cost on pricing group
          const pricing = this.productForm().get('pricing') as FormGroup | null;
          pricing?.controls['unitCost']?.enable({ emitEvent: false });
        } else {
          if (this.fieldsOptions()?.inventoryDetails?.parentItem?.isRequired) {
            this.group.controls['parentId'].setValidators([Validators.required]);
            this.group.controls['parentId'].updateValueAndValidity({ emitEvent: false });
          }
          // Disable unit cost — it's derived from parent.unitCost / childQty
          const pricing = this.productForm().get('pricing') as FormGroup | null;
          pricing?.controls['unitCost']?.disable({ emitEvent: false });
        }
      });

    // Parent selection → refresh parent product snapshot and recompute unit cost.
    this.group.controls['parentId'].valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (parentId: string | null) => {
        info.parentId = parentId ?? null;
        if (parentId) await this.loadParentInfo(parentId);
        this.recomputeChildUnitCost();
      });

    // Child qty change → recompute unit cost from parent.
    this.group.controls['childQty'].valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((qty: number) => {
        info.childQty = Number(qty ?? 1);
        this.recomputeChildUnitCost();
      });

    // UOM sync
    this.group.controls['UOM'].valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((uom: string) => {
        info.UOM = uom ?? '';
      });
  }

  private async loadParentInfo(parentId: string): Promise<void> {
    try {
      const parent = await this.productsService.getProduct(parentId);
      this.productInfo().parent = parent;
    } catch {
      /* swallow — invalid id or network issue */
    }
  }

  private recomputeChildUnitCost(): void {
    const info = this.productInfo();
    if (!info.isChild) return;
    info.onTypeChildQty();
    const pricing = this.productForm().get('pricing') as FormGroup | null;
    pricing?.patchValue({ unitCost: info.unitCost ?? 0 }, { emitEvent: false });
  }

  c(name: 'UOM' | 'isChild' | 'parentId' | 'childQty') {
    return this.group.controls[name];
  }

  // Template convenience — methods, not inline arrows (template parser).
  uomDisplay = (v: UomItem | string): string => (typeof v === 'string' ? v : v.label);
  displayLabel = (item: any): string => item?.label ?? String(item ?? '');
  compareByValue = (a: any, b: any): boolean => (a?.value ?? a) === (b?.value ?? b);
}
