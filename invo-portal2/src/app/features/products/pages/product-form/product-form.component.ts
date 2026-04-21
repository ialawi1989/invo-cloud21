import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';

import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { withTranslations } from '@core/i18n/with-translations';

import { ProductsService } from '../../services/products.service';
import { Product } from '../../models/product-form.model';
import { Fields, ProductFields } from '../../models/product-fields.model';

import { CommonFieldsComponent }         from './components/common-fields/common-fields.component';
import { ProductPricingComponent }       from './components/product-pricing/product-pricing.component';
import { InventoryDetailsComponent }     from './components/inventory-details/inventory-details.component';
import { CategoryOptionsComponent }      from './components/category-options/category-options.component';
import { ProductImageComponent }         from './components/product-image/product-image.component';
import { SupplierListProductComponent }  from './components/supplier-list-product/supplier-list-product.component';
import { BranchProductSectionComponent } from './components/branch-product-section/branch-product-section.component';
import { KitBuilderComponent }           from './components/kit-builder/kit-builder.component';
import { RecipeBuilderComponent }        from './components/recipe-builder/recipe-builder.component';
import { PackageBuilderComponent }       from './components/package-builder/package-builder.component';
import { MenuSelectionComponent }        from './components/menu-selection/menu-selection.component';
import { ServiceDurationComponent }      from './components/service-duration/service-duration.component';
import { MeasurementsComponent }         from './components/measurements/measurements.component';
import { ProductAttributesComponent }    from './components/product-attributes/product-attributes.component';
import { AltProductComponent }           from './components/alt-product/alt-product.component';
import { FoodNutritionComponent }        from './components/food-nutrition/food-nutrition.component';
import { ShippingOptionsComponent }      from './components/shipping-options/shipping-options.component';
import { ProductCustomFieldsComponent }  from './components/product-custom-fields/product-custom-fields.component';
import { AliasBarcodesComponent }        from './components/alias-barcodes/alias-barcodes.component';
import { Product3dModelComponent }       from './components/product-3dmodel/product-3dmodel.component';
import { ProductGalleryComponent }       from './components/product-gallery/product-gallery.component';
import { ProductTabBuilderSectionComponent } from './components/tab-builder/tab-builder-section.component';

type FormStatus = 'new' | 'edit';

/**
 * Product Form (Phase 1 — shell)
 * ──────────────────────────────
 * Owns the top-level reactive FormGroup and the in-memory `productInfo`
 * snapshot. Sub-sections (common-fields, pricing, branch, …) plug into the
 * same FormGroup in later phases and bind to their own child controls via
 * `formControlName` — no `[(ngModel)]`.
 *
 * Route:  /products/form/:type/:id
 * `type` is one of: inventory | serialized | batch | kit | service |
 *                   package | menuItem | menuSelection | tailoring
 * `id`   is '0' for a new product, otherwise the existing product id.
 */
@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    CommonFieldsComponent,
    ProductPricingComponent,
    InventoryDetailsComponent,
    CategoryOptionsComponent,
    ProductImageComponent,
    SupplierListProductComponent,
    BranchProductSectionComponent,
    KitBuilderComponent,
    RecipeBuilderComponent,
    PackageBuilderComponent,
    MenuSelectionComponent,
    ServiceDurationComponent,
    MeasurementsComponent,
    ProductAttributesComponent,
    AltProductComponent,
    FoodNutritionComponent,
    ShippingOptionsComponent,
    ProductCustomFieldsComponent,
    AliasBarcodesComponent,
    Product3dModelComponent,
    ProductGalleryComponent,
    ProductTabBuilderSectionComponent,
  ],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productsService = inject(ProductsService);
  private translate = inject(TranslateService);
  readonly privileges = inject(PrivilegeService);

  // ── Types accepted by the form ──────────────────────────────────────────────
  private static readonly ALLOWED_TYPES = [
    'inventory', 'serialized', 'batch', 'kit', 'service',
    'package', 'menuItem', 'menuSelection', 'tailoring',
  ] as const;

  // ── Reactive state (signals) ────────────────────────────────────────────────
  productInfo = signal<Product>(new Product());
  formStatus  = signal<FormStatus>('new');
  loading     = signal<boolean>(false);
  saving      = signal<boolean>(false);
  productId   = signal<string>('0');
  productType = signal<string>('');
  fieldsOptions = signal<Fields | null>(null);

  // ── Top-level form group. Sub-components addControl/addControl to it. ──────
  // Kept loose on purpose — each phase appends its own sub-group / sub-array.
  productForm: FormGroup = this.fb.group({
    branchProduct: this.fb.array([]),
  });

  // ── Breadcrumbs ─────────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const type = this.productType();
    const status = this.formStatus();
    const name = this.productInfo()?.name;
    const typeLabel = this.translate.instant('PRODUCTS.TYPES.' + this.typeI18nKey(type));
    const titleKey = status === 'new' ? 'PRODUCTS.FORM.ADD_TITLE' : 'PRODUCTS.FORM.EDIT_TITLE';
    const title = this.translate.instant(titleKey, { value: typeLabel });
    const label = status === 'edit' && name ? `${title}: ${name}` : title;
    return [
      { label: this.translate.instant('PRODUCTS.TITLE'), routerLink: '/products' },
      { label },
    ];
  });

  // Query params we pass through when navigating back to the list
  private listQueryParams: Record<string, string> = {};
  private canGoBack = false;
  private destroy$ = new Subject<void>();

  constructor() {
    withTranslations('products');
    this.canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  }

  async ngOnInit(): Promise<void> {
    // Preserve list context for back navigation
    for (const key of ['pageNum', 'pageLimit', 'filterByType', 'searchTerm']) {
      const v = this.route.snapshot.queryParamMap.get(key);
      if (v != null) this.listQueryParams[key] = v;
    }

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(async (params) => {
      const rawId = params.get('id') ?? 'new';
      // 'new' (preferred) and '0' (legacy) both mean "create a new product".
      const isNew = rawId === 'new' || rawId === '0';
      const id = isNew ? 'new' : rawId;
      const type = params.get('type') ?? '';

      this.productId.set(id);
      this.productType.set(type);

      // Resolve field visibility map for this type
      this.fieldsOptions.set((new ProductFields() as any)[type] ?? null);

      // Guard: unsupported type → back to list
      if (!ProductFormComponent.ALLOWED_TYPES.includes(type as any)) {
        this.router.navigate(['products'], { queryParams: this.listQueryParams });
        return;
      }

      let info = new Product();
      if (!isNew) {
        this.formStatus.set('edit');
        this.loading.set(true);
        try {
          const isClone = this.route.snapshot.queryParamMap.get('clone') === 'true';
          const raw = isClone
            ? await this.productsService.cloneProduct(id)
            : await this.productsService.getProduct(id);
          console.log('[product-form] RAW top-level keys:', raw ? Object.keys(raw) : null);
          const branchLikeKeys = raw ? Object.keys(raw).filter(k => /branch|inventory|stock/i.test(k)) : [];
          console.log('[product-form] branch-like keys:', branchLikeKeys);
          branchLikeKeys.forEach(k => console.log(`[product-form] raw.${k}:`, raw[k]));
          if (raw) info.ParseJson(raw);
          console.log('[product-form] info.branchProduct after ParseJson:', info.branchProduct);
        } finally {
          this.loading.set(false);
        }

        // Type-mismatch → redirect to correct URL
        if (info.type && info.type !== type) {
          this.router.navigate(
            ['products', 'form', info.type, id],
            { queryParams: this.listQueryParams, replaceUrl: true },
          );
          return;
        }
      } else {
        this.formStatus.set('new');
        info.type = type;
      }

      this.productInfo.set(info);

      // Reset form group for the new context
      this.productForm = this.fb.group({
        branchProduct: this.fb.array([]),
      });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get branchProduct(): FormArray {
    return this.productForm.get('branchProduct') as FormArray;
  }

  // Sub-components (later phases) will receive this combined snapshot.
  combineData() {
    return {
      productInfo: this.productInfo(),
      productForm: this.productForm,
      formStatus: this.formStatus(),
    };
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async saveProduct(): Promise<void> {
    const info = this.productInfo();
    if (!info || this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    // Profit-loss confirm (same rule as old form: warn if profit < 0)
    const canContinue = info.getProfitValue >= 0;
    if (!canContinue) {
      const ok = confirm(this.translate.instant('PRODUCTS.FORM.CONFIRM_PROFIT_LOSS'));
      if (!ok) return;
    }

    this.saving.set(true);
    this.productForm.disable();
    try {
      // Mirrors old cleanup: flatten pricing type + attributes/tags
      info.tags = info.getTags;
      info.productAttributes = info.productAttributes.filter((a) => a.checked);
      info.branchProduct.forEach((bp: any) => {
        if (bp.selectedPricingType === 'priceBoundary') {
          if (bp.priceBoundriesFrom === '') {
            bp.priceBoundriesFrom = (bp.price > 0 && (bp.priceBoundriesTo ?? 0) > 0) ? 0 : null;
          }
          if (bp.priceBoundriesTo === '') bp.priceBoundriesTo = null;
          if (!bp.priceBoundriesFrom && !bp.priceBoundriesTo) bp.selectedPricingType = '';
        }
      });

      // Default cover image
      if (info.productMedia?.length > 0 && !info.mediaId) {
        info.mediaId = info.productMedia[0].id;
        info.mediaUrl = {
          id: info.productMedia[0].id,
          defaultUrl: info.productMedia[0].defaultUrl,
          thumbnailUrl: info.productMedia[0].defaultUrl,
        } as any;
      }

      const res = await this.productsService.saveProduct(info);
      if (res?.success) {
        this.productForm.markAsPristine();
        this.productForm.markAsUntouched();
        this.router.navigate(['products'], { queryParams: this.listQueryParams });
      } else {
        this.productForm.enable();
      }
    } catch (err) {
      console.error('[product-form] saveProduct failed', err);
      this.productForm.enable();
    } finally {
      this.saving.set(false);
    }
  }

  backPage(): void {
    if (this.canGoBack) history.back();
    else this.router.navigate(['products'], { queryParams: this.listQueryParams });
  }

  private typeI18nKey(type: string): string {
    switch (type) {
      case 'inventory':     return 'INVENTORY';
      case 'serialized':    return 'SERIALIZED';
      case 'batch':         return 'BATCH';
      case 'kit':           return 'KIT';
      case 'service':       return 'SERVICE';
      case 'package':       return 'PACKAGE';
      case 'menuItem':      return 'MENU_ITEM';
      case 'menuSelection': return 'MENU_SELECTION';
      case 'tailoring':     return 'TAILORING';
      default:              return type.toUpperCase();
    }
  }
}
