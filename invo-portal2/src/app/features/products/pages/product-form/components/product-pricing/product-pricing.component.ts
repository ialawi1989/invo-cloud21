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
import { ModalService } from '@shared/modal';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { CompanyService } from '@core/auth/company.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { MynumberPipe } from '@core/pipes/mynumber.pipe';

import { ProductsService } from '../../../../services/products.service';
import { Product, Tax } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import {
  UnitCostAdjustModalComponent,
  UnitCostAdjustData,
  UnitCostAdjustResult,
} from './unit-cost-adjust-modal.component';

interface DropdownItem { label: string; value: string; }

type PriceModel = 'fixedPrice' | 'fixedPriceWOption' | 'totalPrice' | 'totalPriceWithDiscount';

/**
 * product-pricing
 * ───────────────
 * Pure reactive-form port of the old pricing card. Drives:
 *   - defaultPrice / comparePriceAt
 *   - unitCost (disabled for child items; kit/package auto-sum from totals)
 *   - taxId (async dropdown)
 *   - priceModel + discount (conditional)
 *
 * Derived values (profit, margin, tax amount) are recomputed reactively
 * from form + productInfo — no ngModel two-way binding.
 */
@Component({
  selector: 'app-pf-product-pricing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, SearchDropdownComponent, MycurrencyPipe, MynumberPipe],
  templateUrl: './product-pricing.component.html',
  styleUrl: './product-pricing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductPricingComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private productsService = inject(ProductsService);
  private privileges = inject(PrivilegeService);
  private companyService = inject(CompanyService);

  /** Same gate as branch-product-section — only shown to users who can adjust. */
  readonly canAdjust         = this.privileges.check('manualAdjustmentSecurity.access');
  /** Whole unit-cost / profit / margin block hides when the user can't manage unit cost (old parity). */
  readonly canManageUnitCost = this.privileges.check('productSecurity.actions.manageUnitCost.access');

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  group!: FormGroup;

  // Raw tax list cached after each page load — used to resolve taxPercentage
  // when the user picks a tax id.
  private taxListRaw = signal<Tax[]>([]);
  // Reactive snapshots that the template binds to (OnPush-friendly).
  defaultPriceValue = signal<number>(0);
  unitCostValue     = signal<number>(0);
  priceModelValue   = signal<PriceModel>('fixedPrice');
  discountValue     = signal<number>(0);

  // Derived readonly values
  profit = computed(() => {
    const p = this.productInfo();
    p.defaultPrice = this.defaultPriceValue();
    p.unitCost = this.unitCostValue();
    return p.getProfitValue;
  });
  margin = computed(() => {
    const p = this.productInfo();
    p.defaultPrice = this.defaultPriceValue();
    p.unitCost = this.unitCostValue();
    return p.getMarginValue;
  });

  // Display helpers for template branches
  showDiscount = computed(() => this.priceModelValue() === 'totalPriceWithDiscount');
  hideDefaultPriceInput = computed(() =>
    this.priceModelValue() === 'totalPrice' || this.priceModelValue() === 'totalPriceWithDiscount',
  );

  // Selling price fed into the PROFIT_EQUATION hint. Matches the old code's
  // ternary: totalPrice() for totalPrice / totalPriceWithDiscount models, else
  // the raw defaultPrice form value.
  formulaSellingPrice = computed<number>(() => {
    const model = this.priceModelValue();
    if (model === 'totalPrice' || model === 'totalPriceWithDiscount') {
      return this.productInfo().totalPrice();
    }
    return this.defaultPriceValue();
  });

  // The old product-pricing sourced isInclusiveTax from company settings
  // (not from the product itself — the product flag just mirrored it). Read
  // the setting reactively so the profit-equation hint toggles correctly
  // when settings load after first render.
  isInclusiveTax = computed<boolean>(() => !!this.companyService.settings()?.isInclusiveTax);

  /**
   * Backend populates `branchesUnitCost` with per-branch overrides when a
   * product has differing unit costs across branches. In that case there is
   * no single "unit cost" to show at the product level — the old app hides
   * the unit-cost / profit / margin row and redirects the user to the
   * branch section. We honour that here.
   */
  branchCostsVary = computed<boolean>(() => {
    const list = this.productInfo().branchesUnitCost;
    return Array.isArray(list) && list.length > 0;
  });

  /**
   * Unit-cost is read-only at rest. The "Adjust" button opens the
   * Inventory-adjustment modal, which posts a `saveManualAdjustmentMovement`
   * record and returns the new cost. We patch the form control on close so
   * the read-only display + derived profit/margin refresh instantly.
   */
  private modals = inject(ModalService);

  async openAdjustModal(): Promise<void> {
    const info = this.productInfo();
    if (!info.id) return; // can't log an adjustment for a brand-new product

    const ref = this.modals.open<UnitCostAdjustModalComponent, UnitCostAdjustData, UnitCostAdjustResult>(
      UnitCostAdjustModalComponent,
      {
        size: 'sm',
        data: {
          productId: info.id,
          currentUnitCost: Number(this.unitCostValue()) || 0,
        },
      },
    );

    const result = await ref.afterClosed();
    if (!result) return;

    // Patch both the form control and productInfo so profit/margin recompute.
    this.group.patchValue({ unitCost: result.unitCost });
    info.unitCost = result.unitCost;
  }

  // Paged async loader for the tax dropdown. Sends the currently-selected
  // `taxId` on page 1 so the backend can pin the selected row at the top of
  // the list — otherwise the dropdown trigger shows the stored id literally
  // until the user scrolls to the page that contains the row.
  loadTaxes: DropdownLoadFn<DropdownItem> = async ({ page, pageSize, search }) => {
    // Only pin the selected row on the first page-1, empty-search call.
    // Scroll/search fetches drop the id so the backend paginates cleanly.
    const selected = this.group?.get('taxId')?.value
      ?? this.productInfo()?.taxId
      ?? null;
    const taxId = page === 1 && !search ? selected : null;
    const res = await this.productsService.getTaxes({ page, pageSize, search, taxId });
    if (page === 1) this.taxListRaw.set(res.raw as Tax[]);
    else this.taxListRaw.update((prev) => [...prev, ...(res.raw as Tax[])]);
    return { items: res.items as DropdownItem[], hasMore: res.hasMore } as DropdownLoadResult<DropdownItem>;
  };

  // Fixed options for the priceModel dropdown
  priceModelOptions: DropdownItem[] = [
    { label: 'Fixed Price',                value: 'fixedPrice' },
    { label: 'Fixed Price With Option',    value: 'fixedPriceWOption' },
    { label: 'Total Price',                value: 'totalPrice' },
    { label: 'Total Price With Discount',  value: 'totalPriceWithDiscount' },
  ];

  priceModelDisplay = (v: DropdownItem | string): string =>
    typeof v === 'string'
      ? (this.priceModelOptions.find((o) => o.value === v)?.label ?? v)
      : v.label;

  // Angular template parser can't evaluate inline arrows — bind these methods.
  // For the tax dropdown the stored value is a bare UUID string (from
  // `info.taxId`); resolve it against the cached raw tax list so the trigger
  // shows the tax name on first render instead of the raw id.
  displayLabel = (item: any): string => {
    if (item?.label) return item.label;
    if (typeof item === 'string' && item) {
      const t: any = this.taxListRaw().find((x: any) => x.id === item);
      if (t?.name) return t.name;
    }
    return String(item ?? '');
  };
  compareByValue = (a: any, b: any): boolean => (a?.value ?? a) === (b?.value ?? b);
  /** Persist only the tax UUID to the form, not the whole `{label, value}` option. */
  toValueId = (item: any): string => item?.value ?? '';

  ngOnInit(): void {
    const info = this.productInfo();
    const f = this.fieldsOptions()?.pricing;

    // Mirror the company-wide `isInclusiveTax` onto productInfo so the
    // model's `getProfitValue` (which subtracts taxAmount when inclusive)
    // computes correctly before any explicit write.
    info.isInclusiveTax = !!this.companyService.settings()?.isInclusiveTax;

    const defaultPrice     = info.defaultPrice ?? 0;
    const unitCost         = this.initialUnitCost(info);
    const comparePriceAt   = info.comparePriceAt ?? 0;
    const priceModel       = ((info.priceModel as any)?.['model'] ?? 'fixedPrice') as PriceModel;
    const discount         = info.priceModel?.discount ?? 0;
    const taxId            = info.taxId ?? null;

    const unitCostDisabled = info.isChild || (info.parentId != null && info.parentId !== '');

    this.group = this.fb.group({
      defaultPrice:   [
        { value: defaultPrice, disabled: priceModel === 'totalPrice' && (info.type === 'menuSelection' || info.type === 'package') },
        f?.defaultPrice?.isRequired ? [Validators.required, Validators.min(0)] : [Validators.min(0)],
      ],
      comparePriceAt: [comparePriceAt, [Validators.min(0)]],
      unitCost:       [
        { value: unitCost, disabled: unitCostDisabled },
        f?.unitCost?.isRequired ? [Validators.required, Validators.min(0)] : [Validators.min(0)],
      ],
      taxId:          [taxId, f?.tax?.isRequired ? [Validators.required] : []],
      priceModel:     [priceModel],
      discount:       [discount, [Validators.min(0)]],
    });

    this.productForm().setControl('pricing', this.group);
    this.syncSignals();

    this.group.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncSignals());

    // Preload the tax list on init. Two cases:
    //  1. New product (no taxId yet) → fetch page 1 and seed the default tax
    //     if the backend flags one as `default`.
    //  2. Edit mode (taxId already set) → fetch page 1 with the selected id
    //     pinned so the trigger resolves to the tax name immediately and
    //     `syncSignals` can look up the correct taxPercentage. Without this
    //     pre-fetch the dropdown stays lazy and the raw UUID is shown until
    //     the user opens it.
    if (f?.tax?.isVisible !== false) {
      this.productsService.getTaxes({ page: 1, pageSize: 50, search: '', taxId }).then((res) => {
        this.taxListRaw.set(res.raw as Tax[]);

        if (!info.id && taxId == null) {
          const def = (res.raw as Tax[]).find((t: any) => t.default);
          if (def) {
            this.group.patchValue({ taxId: def.id });
            info.taxId = def.id;
            info.taxPercentage = def.taxPercentage ?? 0;
          }
        } else if (taxId) {
          // Edit mode — resolve taxPercentage from the selected row now that
          // the list is cached, so profit/margin/tax calculations are correct
          // before the user interacts with the dropdown.
          const t: any = (res.raw as Tax[]).find((x: any) => x.id === taxId);
          if (t) info.taxPercentage = t.taxPercentage ?? 0;
        }
      }).catch(() => void 0);
    }
  }

  // Mirror the form onto productInfo + signals so model getters & template signals stay aligned.
  private syncSignals(): void {
    const v = this.group.getRawValue();
    const info = this.productInfo();

    info.defaultPrice     = Number(v.defaultPrice ?? 0);
    info.unitCost         = v.unitCost == null || v.unitCost === '' ? null : Number(v.unitCost);
    info.comparePriceAt   = Number(v.comparePriceAt ?? 0);
    info.taxId            = v.taxId ?? null;
    (info.priceModel as any)['model'] = v.priceModel ?? 'fixedPrice';
    info.priceModel.discount = Number(v.discount ?? 0);

    // keep taxPercentage in sync with selected tax
    if (v.taxId) {
      const t: any = this.taxListRaw().find((x: any) => x.id === v.taxId);
      info.taxPercentage = t?.taxPercentage ?? 0;
    } else {
      info.taxPercentage = 0;
    }
    info.calculateTaxAmount(this.taxListRaw());

    this.defaultPriceValue.set(info.defaultPrice);
    this.unitCostValue.set(info.unitCost ?? 0);
    this.priceModelValue.set((v.priceModel ?? 'fixedPrice') as PriceModel);
    this.discountValue.set(info.priceModel.discount);

    // priceModel → enable/disable defaultPrice (menuSelection/package with totalPrice)
    const model = v.priceModel as PriceModel;
    const needsDisable =
      model === 'totalPrice' &&
      (info.type === 'menuSelection' || info.type === 'package');
    const ctl = this.group.controls['defaultPrice'];
    if (needsDisable && ctl.enabled) ctl.disable({ emitEvent: false });
    else if (!needsDisable && ctl.disabled) ctl.enable({ emitEvent: false });
  }

  // For kit/package the unit cost is auto-computed from sub-items.
  private initialUnitCost(info: Product): number {
    if (info.type === 'kit')     return info.calculateTotalUnitCostForKit;
    if (info.type === 'package') return info.calculateTotalUnitCostPackage;
    return info.unitCost ?? 0;
  }

  c(name: 'defaultPrice' | 'comparePriceAt' | 'unitCost' | 'taxId' | 'priceModel' | 'discount') {
    return this.group.controls[name];
  }

  totalPriceForDisplay(): number {
    return this.productInfo().totalPrice();
  }
}
