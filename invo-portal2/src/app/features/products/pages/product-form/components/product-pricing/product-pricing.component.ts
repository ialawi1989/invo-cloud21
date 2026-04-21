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
import { Product, Tax } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

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
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, SearchDropdownComponent],
  templateUrl: './product-pricing.component.html',
  styleUrl: './product-pricing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductPricingComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private productsService = inject(ProductsService);

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

  // Paged async loader for the tax dropdown
  loadTaxes: DropdownLoadFn<DropdownItem> = async ({ page, pageSize, search }) => {
    const res = await this.productsService.getTaxes({ page, pageSize, search });
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
  displayLabel = (item: any): string => item?.label ?? String(item ?? '');
  compareByValue = (a: any, b: any): boolean => (a?.value ?? a) === (b?.value ?? b);

  ngOnInit(): void {
    const info = this.productInfo();
    const f = this.fieldsOptions()?.pricing;

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

    // Seed default tax for a new product — fires once taxes are loaded.
    if (!info.id && taxId == null) {
      this.productsService.getTaxes({ page: 1, pageSize: 50, search: '' }).then((res) => {
        this.taxListRaw.set(res.raw as Tax[]);
        const def = (res.raw as Tax[]).find((t: any) => t.default);
        if (def) {
          this.group.patchValue({ taxId: def.id });
          info.taxId = def.id;
          info.taxPercentage = def.taxPercentage ?? 0;
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
