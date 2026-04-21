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
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { BranchConnectionService } from '@core/layout/services/branch.service';

import { Product, BranchProduct } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import { BranchPriceByQtyComponent } from './branch-price-by-qty/branch-price-by-qty.component';
import { BranchSerialsComponent }    from './branch-serials/branch-serials.component';
import { BranchBatchesComponent }    from './branch-batches/branch-batches.component';

type PricingType = '' | 'buyDownPrice' | 'priceBoundary' | 'priceByQty';

/**
 * branch-product-section (Phase 3 — base)
 * ────────────────────────────────────────
 * Per-branch pricing + on-hand + reorder points. A FormArray of FormGroups
 * — one row per branch. The user picks a branch tab to reveal the
 * underlying FormGroup; `activeTab` is a component signal, not a control.
 *
 * Branches are sourced from `BranchConnectionService` (company branches).
 * When the product is new, every branch gets a default row; when editing,
 * we merge existing `productInfo.branchProduct` with any branches that
 * weren't persisted yet.
 *
 * Scope for Phase 3:
 *   • available / availableOnline toggles
 *   • has_different_price + price override
 *   • selectedPricingType: '' | 'buyDownPrice' | 'priceBoundary'
 *     (the `priceByQty` nested FormArray is deferred to Phase 3b)
 *   • onHand / reorderPoint / reorderLevel
 *   • unitCost (if feature flag present)
 *
 * Deferred (Phase 3b):
 *   • priceByQty FormArray
 *   • serials & batches nested sections
 *   • location picker
 */
@Component({
  selector: 'app-pf-branch-product-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    BranchPriceByQtyComponent,
    BranchSerialsComponent,
    BranchBatchesComponent,
  ],
  templateUrl: './branch-product-section.component.html',
  styleUrl: './branch-product-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchProductSectionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private branchesSvc = inject(BranchConnectionService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  rows!: FormArray<FormGroup>;
  activeTab = signal<number>(0);

  activeBranchName = computed<string>(() =>
    this.productInfo().branchProduct[this.activeTab()]?.branchName ?? '',
  );

  hasAnyDifferentPrice = computed<boolean>(() =>
    this.productInfo().branchProduct.some((b: any) => b.has_different_price),
  );
  totalStock = computed<number>(() =>
    this.productInfo().branchProduct.reduce((sum, b: any) => sum + Number(b.onHand ?? 0), 0),
  );

  async ngOnInit(): Promise<void> {
    const info = this.productInfo();
    if (!Array.isArray(info.branchProduct)) info.branchProduct = [];

    // Ensure we have a BranchConnectionService snapshot — it loads once per session.
    if (!this.branchesSvc.loaded()) {
      try { await this.branchesSvc.load(); } catch { /* swallow — empty list = no tabs */ }
    }
    this.mergeBranchesIntoProduct();

    this.rows = this.fb.array(info.branchProduct.map((b) => this.buildRow(b)));
    this.productForm().setControl('branchProduct', this.rows);

    // Keep productInfo.branchProduct in sync with FormArray values so model
    // getters (checkBranchPrice…Empty, etc.) keep reporting fresh values.
    this.rows.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncBackToModel());
  }

  /** Merge BranchConnectionService branches into productInfo.branchProduct. */
  private mergeBranchesIntoProduct(): void {
    const info = this.productInfo();
    const allBranches = this.branchesSvc.branches();
    console.log('[branch-merge] incoming info.branchProduct:', JSON.parse(JSON.stringify(info.branchProduct ?? [])));
    console.log('[branch-merge] allBranches from BranchConnectionService:', allBranches.map((b: any) => ({ id: b.id, name: b.name })));
    if (!allBranches.length) return;

    const isNew = !info.id;

    // Add missing branches as empty rows
    allBranches.forEach((b) => {
      const existing = info.branchProduct.find((x: any) => x.branchId === b.id);
      if (existing) {
        (existing as any).branchName = b.name;
        return;
      }
      const seed: BranchProduct = {
        branchId: b.id,
        branchName: b.name,
        price: null,
        buyDownPrice: null,
        buyDownQty: null,
        priceBoundriesFrom: null,
        priceBoundriesTo: null,
        selectedPricingType: '',
        has_different_price: false,
        priceByQty: [],
        serials: [],
        batches: [],
        // Sensible defaults for a new product.
        available: isNew ? true : false,
        availableOnline: isNew ? true : false,
        onHand: 0,
        openingBalance: 0,
        openingBalanceCost: 0,
        reorderPoint: 0,
        reorderLevel: 0,
        unitCost: 0,
        locationId: '',
      } as any;
      info.branchProduct.push(seed);
    });

    // Drop any branches that no longer exist in the company list — defensive.
    info.branchProduct = info.branchProduct.filter((bp: any) =>
      allBranches.some((b) => b.id === bp.branchId),
    );
    console.log('[branch-merge] final info.branchProduct (ids preserved?):',
      info.branchProduct.map((bp: any) => ({ id: bp.id, branchId: bp.branchId, productId: bp.productId })));
  }

  private buildRow(b: BranchProduct): FormGroup {
    const f = this.fieldsOptions()?.branchProduct;
    const productHasId = !!this.productInfo().id;

    // Nested FormArrays — populated from incoming row data; children own
    // add/remove behaviour.
    const priceByQtyArr = this.fb.array(
      (b.priceByQty ?? []).map((r: any) =>
        this.fb.group({
          qty:   [r.qty ?? null,   [Validators.min(0)]],
          price: [r.price ?? null, [Validators.min(0)]],
        }),
      ),
    );
    const serialsArr = this.fb.array(
      (b.serials ?? []).map((s: any) =>
        this.fb.group({
          serial:     [s.serial ?? ''],
          unitCost:   [s.unitCost ?? null, [Validators.required, Validators.min(0)]],
          expireDate: [s.expireDate ? new Date(s.expireDate) : null],
        }),
      ),
    );
    const batchesArr = this.fb.array(
      (b.batches ?? []).map((bt: any) =>
        this.fb.group({
          batch:      [bt.batch ?? '',    [Validators.required]],
          barcode:    [bt.barcode ?? ''],
          onHand:     [bt.onHand ?? null, [Validators.required, Validators.min(0)]],
          unitCost:   [bt.unitCost ?? 0,  [Validators.min(0)]],
          prodDate:   [bt.prodDate   ? new Date(bt.prodDate)   : null],
          expireDate: [bt.expireDate ? new Date(bt.expireDate) : null],
        }),
      ),
    );

    return this.fb.group({
      branchId:            [b.branchId ?? ''],
      branchName:          [b.branchName ?? ''],
      available:           [b['available'] ?? true],
      availableOnline:     [b['availableOnline'] ?? true],
      has_different_price: [!!b.has_different_price],
      price:               [b.price ?? null, [Validators.min(0)]],
      selectedPricingType: [(b.selectedPricingType ?? '') as PricingType],
      buyDownPrice:        [b.buyDownPrice ?? null, [Validators.min(0)]],
      buyDownQty:          [b.buyDownQty ?? null,   [Validators.min(0)]],
      priceBoundriesFrom:  [b.priceBoundriesFrom ?? null, [Validators.min(0)]],
      priceBoundriesTo:    [b.priceBoundriesTo ?? null,   [Validators.min(0)]],
      onHand:              [{ value: b['onHand'] ?? 0, disabled: !productHasId },
                            f?.onHand?.isRequired ? [Validators.required, Validators.min(0)] : [Validators.min(0)]],
      reorderPoint:        [b['reorderPoint'] ?? 0, [Validators.min(0)]],
      reorderLevel:        [b['reorderLevel'] ?? 0, [Validators.min(0)]],
      openingBalance:      [b['openingBalance'] ?? 0, [Validators.min(0)]],
      openingBalanceCost:  [b['openingBalanceCost'] ?? 0, [Validators.min(0)]],
      unitCost:            [b['unitCost'] ?? 0, [Validators.min(0)]],
      priceByQty:          priceByQtyArr,
      serials:             serialsArr,
      batches:             batchesArr,
    });
  }

  private syncBackToModel(): void {
    const info = this.productInfo();
    this.rows.controls.forEach((grp, i) => {
      const v = grp.getRawValue() as any;
      const target: any = info.branchProduct[i];
      if (!target) return;
      target.available           = v.available;
      target.availableOnline     = v.availableOnline;
      target.has_different_price = v.has_different_price;
      target.price               = v.has_different_price ? (v.price ?? null) : null;
      target.selectedPricingType = v.selectedPricingType ?? '';
      target.buyDownPrice        = v.buyDownPrice ?? null;
      target.buyDownQty          = v.buyDownQty ?? null;
      target.priceBoundriesFrom  = v.priceBoundriesFrom ?? null;
      target.priceBoundriesTo    = v.priceBoundriesTo ?? null;
      target.onHand              = Number(v.onHand ?? 0);
      target.reorderPoint        = Number(v.reorderPoint ?? 0);
      target.reorderLevel        = Number(v.reorderLevel ?? 0);
      target.openingBalance      = Number(v.openingBalance ?? 0);
      target.openingBalanceCost  = Number(v.openingBalanceCost ?? 0);
      target.unitCost            = Number(v.unitCost ?? 0);
      // Nested arrays
      target.priceByQty = (v.priceByQty ?? []).map((r: any) => ({
        qty:   r.qty   ?? null,
        price: r.price ?? null,
      }));
      target.serials = (v.serials ?? []).map((s: any) => ({
        serial:     s.serial ?? '',
        unitCost:   s.unitCost ?? null,
        expireDate: s.expireDate ? this.toIsoDate(s.expireDate) : null,
      }));
      target.batches = (v.batches ?? []).map((b: any) => ({
        batch:      b.batch ?? '',
        barcode:    b.barcode ?? '',
        onHand:     b.onHand ?? null,
        unitCost:   b.unitCost ?? 0,
        prodDate:   b.prodDate   ? this.toIsoDate(b.prodDate)   : null,
        expireDate: b.expireDate ? this.toIsoDate(b.expireDate) : null,
      }));
    });
  }

  private toIsoDate(v: any): string {
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  changeTab(i: number): void {
    if (i < 0 || i >= this.rows.length) return;
    this.activeTab.set(i);
  }

  activeGroup = computed<FormGroup | null>(() => {
    if (!this.rows) return null;
    const grp = this.rows.at(this.activeTab()) as FormGroup | undefined;
    return grp ?? null;
  });

  // Template convenience — safe accessor used by @if blocks.
  ctl(name: string) {
    return this.activeGroup()?.controls[name];
  }

  selectedPricingTypeValue = computed<PricingType>(
    () => (this.activeGroup()?.controls['selectedPricingType']?.value ?? '') as PricingType,
  );

  hasDifferentPriceValue = computed<boolean>(
    () => !!this.activeGroup()?.controls['has_different_price']?.value,
  );

  setPricingType(type: PricingType): void {
    const grp = this.activeGroup();
    if (!grp) return;
    grp.patchValue({ selectedPricingType: type });
  }

  getStockBadgeClass(onHand: number | null | undefined, reorderPoint: number | null | undefined): string {
    const on = Number(onHand ?? 0);
    const rp = Number(reorderPoint ?? 0);
    if (!on) return 'bad';
    if (on <= rp) return 'warn';
    return 'good';
  }
}
