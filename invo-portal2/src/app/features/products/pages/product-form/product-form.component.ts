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
  AbstractControl,
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
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { ModalService } from '@shared/modal/modal.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';

import { ProductsService } from '../../services/products.service';
import { Product } from '../../models/product-form.model';
import { Fields, ProductFields } from '../../models/product-fields.model';

import { CommonFieldsComponent }         from './components/common-fields/common-fields.component';
import { ProductPricingComponent }       from './components/product-pricing/product-pricing.component';
import { InventoryDetailsComponent }     from './components/inventory-details/inventory-details.component';
import { CategoryOptionsComponent }      from './components/category-options/category-options.component';
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
import { ProductMediaCardComponent }     from './components/product-media/product-media.component';
import { ProductTabBuilderSectionComponent } from './components/tab-builder/tab-builder-section.component';
import { ProductFormSkeletonComponent } from './components/product-form-skeleton/product-form-skeleton.component';

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
    ProductMediaCardComponent,
    ProductTabBuilderSectionComponent,
    ProductFormSkeletonComponent,
  ],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormComponent implements OnInit, OnDestroy, CanLeaveComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productsService = inject(ProductsService);
  private translate = inject(TranslateService);
  private modalService = inject(ModalService);
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
  /** i18n key for a load-time error banner. `null` = no error. */
  loadError   = signal<string | null>(null);
  productId   = signal<string>('0');
  productType = signal<string>('');
  fieldsOptions = signal<Fields | null>(null);

  // ── Top-level form group. Sub-components addControl/addControl to it. ──────
  // Kept loose on purpose — each phase appends its own sub-group / sub-array.
  productForm: FormGroup = this.fb.group({
    branchProduct: this.fb.array([]),
  });

  /**
   * Bumped every time the form's status or value changes. Computed signals
   * that walk the form (like `errorCount`) depend on this so they re-run
   * when validation state shifts.
   */
  private formTick = signal(0);

  /**
   * Total count of invalid controls across the whole form tree.
   * Drives the error badge on the Save button in the sticky footer.
   */
  errorCount = computed<number>(() => {
    void this.formTick();
    return this.countInvalid(this.productForm);
  });

  // ── Breadcrumbs ─────────────────────────────────────────────────────────────
  // Layout: [← icon-only chip that goes back] > [Current page title chip]
  // The back-arrow chip carries the parent label as aria-only (`iconOnly`)
  // and uses routerLink to /products so Ctrl+click / middle-click still work
  // as expected. This replaces the old separate `.btn-back` button.
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const type = this.productType();
    const status = this.formStatus();
    const name = this.productInfo()?.name;
    const typeLabel = this.translate.instant('PRODUCTS.TYPES.' + this.typeI18nKey(type));
    const titleKey = status === 'new' ? 'PRODUCTS.FORM.ADD_TITLE' : 'PRODUCTS.FORM.EDIT_TITLE';
    const title = this.translate.instant(titleKey, { value: typeLabel });
    const label = status === 'edit' && name ? `${title}: ${name}` : title;
    return [
      {
        icon: 'package',
        iconOnly: true,
        label: this.translate.instant('PRODUCTS.TITLE'),
        routerLink: '/products',
      },
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

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const rawId = params.get('id') ?? 'new';
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

      this.load();
    });
  }

  /**
   * Load (or reload) the product for the current `productId` + `productType`.
   * Extracted so the error-banner "Retry" action can re-trigger it without
   * bouncing through the router.
   */
  async load(): Promise<void> {
    const id = this.productId();
    const type = this.productType();
    const isNew = id === 'new' || id === '0';

    let info = new Product();
    this.loadError.set(null);

    if (!isNew) {
      this.formStatus.set('edit');
      this.loading.set(true);
      try {
        const isClone = this.route.snapshot.queryParamMap.get('clone') === 'true';
        const raw = isClone
          ? await this.productsService.cloneProduct(id)
          : await this.productsService.getProduct(id);

        if (!raw || typeof raw !== 'object') {
          // Defensive: backend returned empty/null — keep the skeleton
          // visible with an error banner rather than rendering an empty
          // form that would mislead the user into editing nothing.
          this.loadError.set('PRODUCTS.FORM.LOAD_FAILED_TITLE');
          return;
        }
        info.ParseJson(raw);
      } catch (err) {
        console.error('[product-form] getProduct failed', err);
        this.loadError.set('PRODUCTS.FORM.LOAD_FAILED_TITLE');
        return;
      } finally {
        // Keep `loading` true on error so the skeleton stays up and the
        // error banner renders on top, instead of a broken-looking empty form.
        if (!this.loadError()) this.loading.set(false);
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
    this.wireFormTick();

    // Sub-components populate their fields during their `ngOnInit`, and a
    // few of them (tab-builder, product-image, gallery, …) emit change events
    // on initial mount that call `markAsDirty()`. That would wrongly flip
    // the form to dirty before the user has touched anything, which makes
    // the browser's `beforeunload` prompt fire on every refresh.
    //
    // After the first macrotask — by which time every child's ngOnInit has
    // run and the initial valueChanges have flushed — snapshot the form as
    // pristine. Any genuine user interaction after that sets dirty the
    // normal way.
    setTimeout(() => {
      this.productForm.markAsPristine();
      this.productForm.markAsUntouched();
    }, 0);
  }

  /**
   * Subscribe to the active productForm's status + value streams and bump
   * `formTick` so computed signals (e.g. `errorCount`) re-evaluate.
   * Re-called after every form rebuild.
   */
  private formTickSub?: { unsubscribe(): void };
  private wireFormTick(): void {
    this.formTickSub?.unsubscribe();
    const statusSub = this.productForm.statusChanges.subscribe(() => this.formTick.update(n => n + 1));
    const valueSub  = this.productForm.valueChanges.subscribe(() => this.formTick.update(n => n + 1));
    this.formTickSub = {
      unsubscribe: () => { statusSub.unsubscribe(); valueSub.unsubscribe(); },
    };
    // Initial tick so the first computed read reflects current state.
    this.formTick.update(n => n + 1);
  }

  /** Recursively count invalid leaf controls under the given node. */
  private countInvalid(ctrl: AbstractControl | null | undefined): number {
    if (!ctrl) return 0;
    if (ctrl instanceof FormGroup || ctrl instanceof FormArray) {
      const children: AbstractControl[] = ctrl instanceof FormArray
        ? ctrl.controls
        : Object.values(ctrl.controls);
      let sum = 0;
      for (const c of children) sum += this.countInvalid(c);
      return sum;
    }
    return ctrl.invalid ? 1 : 0;
  }

  ngOnDestroy(): void {
    this.formTickSub?.unsubscribe();
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
    if (info.getProfitValue < 0) {
      const ref = this.modalService.open<ConfirmModalComponent, ConfirmModalData, boolean>(
        ConfirmModalComponent,
        {
          size: 'sm',
          data: {
            title:   this.translate.instant('PRODUCTS.FORM.PROFIT_LOSS_TITLE'),
            message: this.translate.instant('PRODUCTS.FORM.CONFIRM_PROFIT_LOSS'),
            confirm: this.translate.instant('COMMON.SAVE'),
            danger:  true,
          },
        },
      );
      const ok = await ref.afterClosed();
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

  // ── Unsaved-changes guard ─────────────────────────────────────────────────
  /**
   * Called by the route CanDeactivate guard before navigating away. The
   * in-app `ConfirmModalComponent` is the sole prompt — we intentionally
   * don't register a `window:beforeunload` listener, because the native
   * browser dialog can't be styled and stacking it with the in-app modal
   * (as we had before) confused users. Tradeoff: a hard refresh or tab-close
   * with dirty state loses changes silently. Accepted.
   */
  hasUnsavedChanges(): boolean {
    // After a successful save we flip the form back to pristine (see
    // `saveProduct`). While saving is in-flight we also treat the page as
    // safe to leave — the user has explicitly committed.
    return !this.saving() && this.productForm.dirty;
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
