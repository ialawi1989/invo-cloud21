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
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { BranchConnectionService } from '@core/layout/services/branch.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ModalService } from '@shared/modal';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DropdownLoadFn, DropdownLoadResult } from '@shared/components/dropdown/search-dropdown.types';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';
import { ProductsService } from '../../../../services/products.service';

import {
  StockAdjustModalComponent,
  StockAdjustData,
  StockAdjustResult,
} from './stock-adjust-modal.component';
import {
  UnitCostAdjustModalComponent,
  UnitCostAdjustData,
  UnitCostAdjustResult,
} from '../product-pricing/unit-cost-adjust-modal.component';

import { Product, BranchProduct } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import { BranchPriceByQtyComponent } from './branch-price-by-qty/branch-price-by-qty.component';
import { BranchSerialsComponent }    from './branch-serials/branch-serials.component';
import { BranchBatchesComponent }    from './branch-batches/branch-batches.component';

type PricingType = '' | 'buyDownPrice' | 'priceBoundary' | 'priceByQty' | 'openPrice';

interface PricingTypeOption { value: PricingType; labelKey: string; }

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
    SearchDropdownComponent,
    SkeletonComponent,
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
  private modals = inject(ModalService);
  private productsService = inject(ProductsService);
  private privileges = inject(PrivilegeService);

  /**
   * Privilege gates — 1:1 port of the old project's branch component.
   *   - `canAdjust`           : `manualAdjustmentSecurity.access`
   *     Shows/hides the stock & unit-cost Adjust buttons.
   *   - `canManageUnitCost`   : `productSecurity.actions.manageUnitCost.access`
   *     Gates the Unit Cost column (bulk table) and the single-branch unit cost input.
   *   - `canViewStockValue`   : `productSecurity.actions.viewStockValue.access`
   *     Gates the low-stock / stock-value summary tiles.
   */
  readonly canAdjust         = this.privileges.check('manualAdjustmentSecurity.access');
  readonly canManageUnitCost = this.privileges.check('productSecurity.actions.manageUnitCost.access');
  readonly canViewStockValue = this.privileges.check('productSecurity.actions.viewStockValue.access');

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  rows!: FormArray<FormGroup>;
  activeTab = signal<number>(0);

  /**
   * Pane mode.
   *   - `'single'` (default): dropdown picker + detail panel for one branch.
   *   - `'bulk'`:   table showing every branch as a row, each cell bound to
   *                 its own FormGroup. No "apply to all" action — the user
   *                 types into the cell they want to change.
   */
  mode = signal<'single' | 'bulk'>('single');
  setMode(m: 'single' | 'bulk'): void { this.mode.set(m); }

  // ─── Single-mode UX state ─────────────────────────────────────────────
  /**
   * "Manage Stock" collapsible — closed by default, mirrors the old form.
   * Keyed by branch index so each branch remembers its expand state.
   */
  manageStockOpen = signal<Record<number, boolean>>({});
  toggleManageStock(i: number): void {
    this.manageStockOpen.update(m => ({ ...m, [i]: !m[i] }));
  }
  isManageStockOpen(i: number): boolean {
    return !!this.manageStockOpen()[i];
  }

  /** Pricing-type dropdown options — mirror old `branch.component.html` lines 467–479. */
  readonly PRICING_TYPE_OPTIONS: PricingTypeOption[] = [
    { value: '',             labelKey: 'PRODUCTS.FORM.PRICING_NONE' },
    { value: 'buyDownPrice', labelKey: 'PRODUCTS.FORM.BUY_DOWN' },
    { value: 'priceByQty',   labelKey: 'PRODUCTS.FORM.PRICE_BY_QTY' },
    { value: 'priceBoundary',labelKey: 'PRODUCTS.FORM.PRICE_BOUNDARY' },
    { value: 'openPrice',    labelKey: 'PRODUCTS.FORM.OPEN_PRICE' },
  ];
  private translate = inject(TranslateService);
  pricingTypeDisplay = (o: PricingTypeOption | string): string => {
    if (!o || o === '') return this.translate.instant('PRODUCTS.FORM.PRICING_TYPE_PLACEHOLDER');
    const opt = typeof o === 'string' ? this.PRICING_TYPE_OPTIONS.find(x => x.value === o) : o;
    return opt ? this.translate.instant(opt.labelKey) : '';
  };

  /** Currently-selected pricing type option for the dropdown trigger. */
  selectedPricingTypeOption = computed<PricingTypeOption>(() => {
    const v = this.selectedPricingTypeValue();
    return this.PRICING_TYPE_OPTIONS.find(o => o.value === v) ?? this.PRICING_TYPE_OPTIONS[0];
  });

  // ─── Bulk-table summary stats ─────────────────────────────────────────
  availableCount = computed<number>(() => {
    this.rowsTick();
    return this.rows?.controls?.filter(g => !!g.value['available']).length ?? 0;
  });
  onlineBranchesCount = computed<number>(() => {
    this.rowsTick();
    return this.rows?.controls?.filter(g => !!g.value['availableOnline']).length ?? 0;
  });
  lowStockCount = computed<number>(() => {
    this.rowsTick();
    return this.rows?.controls?.filter(g => {
      const on = Number(g.value['onHand'] ?? 0);
      const rp = Number(g.value['reorderPoint'] ?? 0);
      return on <= rp;
    }).length ?? 0;
  });

  activeBranchName = computed<string>(() =>
    this.productInfo().branchProduct[this.activeTab()]?.branchName ?? '',
  );

  /** Items fed to the branch-picker dropdown. Label carries status + onHand. */
  branchOptions = computed<Array<{ value: number; label: string; onHand: number; available: boolean; availableOnline: boolean }>>(() => {
    if (!this.rows) return [];
    return this.rows.controls.map((g, i) => {
      const v: any = g.value;
      return {
        value: i,
        label: v.branchName || 'Branch',
        onHand: Number(v.onHand ?? 0),
        available: !!v.available,
        availableOnline: !!v.availableOnline,
      };
    });
  });

  branchDisplay = (opt: any): string => opt?.label ?? '';
  branchCompare = (a: any, b: any): boolean => (a?.value ?? a) === (b?.value ?? b);

  selectedBranchOption = computed(() =>
    this.branchOptions().find(o => o.value === this.activeTab()) ?? null,
  );

  hasAnyDifferentPrice = computed<boolean>(() =>
    this.productInfo().branchProduct.some((b: any) => b.has_different_price),
  );
  totalStock = computed<number>(() => {
    this.rowsTick();
    if (!this.rows) return 0;
    return this.rows.controls.reduce((sum, g) => sum + Number(g.value['onHand'] ?? 0), 0);
  });

  /**
   * True until every init-time request the section depends on has settled.
   * Drives the skeleton overlay — mirrors branches-not-loaded flickers we
   * were seeing when the user landed on the product form before
   * `BranchConnectionService` finished its first fetch.
   */
  initializing = signal<boolean>(true);

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
      .subscribe(() => {
        this.syncBackToModel();
        // Bump the tick so signal-dependent computeds (hasDifferentPriceValue,
        // selectedPricingTypeValue, stats) recompute — FormControl.value
        // mutations alone don't notify the signal graph.
        this.rowsTick.update(n => n + 1);
      });

    this.initializing.set(false);
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
      locationId:          [(b as any)['locationId'] ?? null],
      priceByQty:          priceByQtyArr,
      serials:             serialsArr,
      batches:             batchesArr,
    });
  }

  // ─── Location picker (per-branch) ──────────────────────────────────────
  /**
   * Cached raw location lists per branchId — populated as the user opens
   * the picker for each branch. Keeps the trigger label resolvable after
   * the dropdown closes (otherwise the locationId UUID leaks through).
   */
  private locationListRaw = signal<Record<string, any[]>>({});

  loadLocations: DropdownLoadFn<{ label: string; value: string }> = async ({ page, pageSize, search }) => {
    const grp = this.activeGroup();
    if (!grp) return { items: [], hasMore: false };
    const branchId   = grp.value['branchId'] as string;
    const locationId = (grp.value['locationId'] as string | null) ?? null;
    const res = await this.productsService.getInventoryLocationsList({
      page, pageSize, search, branchId, locationId,
    });
    if (page === 1) {
      this.locationListRaw.update(m => ({ ...m, [branchId]: res.raw as any[] }));
    } else {
      this.locationListRaw.update(m => ({
        ...m,
        [branchId]: [...(m[branchId] ?? []), ...(res.raw as any[])],
      }));
    }
    return { items: res.items, hasMore: res.hasMore } as DropdownLoadResult<{ label: string; value: string }>;
  };

  /**
   * Resolves a locationId string to a human label by looking through the
   * cached raw list for the current branch. Used as `displayWith` so the
   * dropdown trigger renders the location name on first paint.
   */
  locationDisplay = (item: any): string => {
    if (!item) return '';
    if (typeof item === 'object' && item.label) return item.label;
    if (typeof item === 'string') {
      const branchId = this.activeGroup()?.value['branchId'] as string | undefined;
      const list = (branchId && this.locationListRaw()[branchId]) || [];
      const hit = list.find((l: any) => (l.id || l._id) === item);
      if (hit?.name) return hit.name;
    }
    return String(item ?? '');
  };

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
      target.locationId          = v.locationId ?? '';
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

  /** Dropdown handler — receives the full option object (or its `value`). */
  onBranchPicked(opt: any): void {
    const idx = typeof opt === 'object' ? opt?.value : opt;
    if (typeof idx === 'number') this.changeTab(idx);
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

  /**
   * Ticks on every FormArray valueChanges emission. Computeds that read
   * form values must depend on this tick so they re-evaluate — signals
   * don't see `FormControl.value` mutations on their own.
   */
  private rowsTick = signal(0);

  selectedPricingTypeValue = computed<PricingType>(() => {
    this.rowsTick();
    return (this.activeGroup()?.controls['selectedPricingType']?.value ?? '') as PricingType;
  });

  hasDifferentPriceValue = computed<boolean>(() => {
    this.rowsTick();
    return !!this.activeGroup()?.controls['has_different_price']?.value;
  });

  setPricingType(type: PricingType): void {
    const grp = this.activeGroup();
    if (!grp) return;
    grp.patchValue({ selectedPricingType: type });
  }

  /** Open the stock-adjust modal for the active single-mode branch. */
  openStockAdjustModal(): Promise<void> {
    return this.openStockAdjustModalFor(this.activeTab());
  }

  /**
   * Open the stock-adjust modal for a specific branch row (used by bulk
   * mode's per-cell Adjust button). No-op for new products.
   */
  async openStockAdjustModalFor(rowIdx: number): Promise<void> {
    const info = this.productInfo();
    const grp = this.rows?.at(rowIdx) as FormGroup | undefined;
    if (!info?.id || !grp) return;

    const branchId = grp.value['branchId'] as string;
    const currentOnHand = Number(grp.value['onHand'] ?? 0);

    const ref = this.modals.open<StockAdjustModalComponent, StockAdjustData, StockAdjustResult>(
      StockAdjustModalComponent,
      { size: 'sm', data: { productId: info.id, branchId, currentOnHand } },
    );

    const result = await ref.afterClosed();
    if (!result) return;
    grp.patchValue({ onHand: result.onHand });
  }

  /**
   * Open the unit-cost-adjust modal for a specific branch row. Reuses
   * the shared UnitCostAdjustModal but scoped to the branch's unitCost.
   */
  async openUnitCostAdjustModalFor(rowIdx: number): Promise<void> {
    const info = this.productInfo();
    const grp = this.rows?.at(rowIdx) as FormGroup | undefined;
    if (!info?.id || !grp) return;

    const currentUnitCost = Number(grp.value['unitCost'] ?? 0);

    const ref = this.modals.open<UnitCostAdjustModalComponent, UnitCostAdjustData, UnitCostAdjustResult>(
      UnitCostAdjustModalComponent,
      { size: 'sm', data: { productId: info.id, currentUnitCost } },
    );

    const result = await ref.afterClosed();
    if (!result) return;
    grp.patchValue({ unitCost: result.unitCost });
  }

  /**
   * Mirrors old `onChangeHasDifferentPrice` — when the user toggles the
   * "different price" flag, price becomes required-and-positive (when
   * enabled) or loses its validators and is nulled out (when disabled).
   * Keeps the form's invalid state honest.
   */
  onChangeHasDifferentPrice(checked: boolean): void {
    // The checkbox is bound via `formControlName` so `has_different_price`
    // is already written by the time this fires. Here we only run the
    // validator side-effect.
    const grp = this.activeGroup();
    const priceCtl = grp?.get('price');
    if (!priceCtl) return;

    if (checked) {
      priceCtl.setValidators([Validators.required, Validators.min(0)]);
      if (priceCtl.value == null || priceCtl.value === '') priceCtl.setValue(0, { emitEvent: false });
    } else {
      priceCtl.clearValidators();
      priceCtl.setValue(null, { emitEvent: false });
    }
    priceCtl.updateValueAndValidity();
  }

  getStockBadgeClass(onHand: number | null | undefined, reorderPoint: number | null | undefined): string {
    const on = Number(onHand ?? 0);
    const rp = Number(reorderPoint ?? 0);
    if (!on) return 'bad';
    if (on <= rp) return 'warn';
    return 'good';
  }
}
