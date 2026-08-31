import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
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
import {
  LogsDrawerComponent,
  LogsDrawerData,
} from '@shared/components/logs-drawer/logs-drawer.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { ProductsService } from '../../services/products.service';
import { Product } from '../../models/product-form.model';
import { Fields, ProductFields } from '../../models/product-fields.model';

import { ProductFormPrefsService } from './services/product-form-prefs.service';
import {
  AdvancedOptionsModalComponent,
  AdvancedOptionsModalData,
} from './components/advanced-options-modal/advanced-options-modal.component';

import { CommonFieldsComponent }         from './components/common-fields/common-fields.component';
import { ProductPricingComponent }       from './components/product-pricing/product-pricing.component';
import { InventoryDetailsComponent }     from './components/inventory-details/inventory-details.component';
import { CategoryOptionsComponent }      from './components/category-options/category-options.component';
import { SupplierListProductComponent }  from './components/supplier-list-product/supplier-list-product.component';
import { BranchProductSectionComponent } from './components/branch-product-section/branch-product-section.component';
import { KitBuilderComponent }           from './components/kit-builder/kit-builder.component';
import { KitDetailsComponent }           from './components/kit-details/kit-details.component';
import { PriceByTeamComponent }          from './components/price-by-team/price-by-team.component';
import { RecipeBuilderComponent }        from './components/recipe-builder/recipe-builder.component';
import { PackageBuilderComponent }       from './components/package-builder/package-builder.component';
import { MenuSelectionComponent }        from './components/menu-selection/menu-selection.component';
import { OptionsTabComponent }           from './components/options-tab/options-tab.component';
import { MeasurementsComponent }         from './components/measurements/measurements.component';
import { ProductAttributesComponent }    from './components/product-attributes/product-attributes.component';
import { AltProductComponent }           from './components/alt-product/alt-product.component';
import { FoodNutritionComponent }        from './components/food-nutrition/food-nutrition.component';
import { AllergensComponent }            from './components/allergens/allergens.component';
import { ShippingOptionsComponent }      from './components/shipping-options/shipping-options.component';
import { EntityCustomFieldsComponent }   from '../../../settings/components/entity-custom-fields/entity-custom-fields.component';
import { ProductOptionsComponent }       from './components/product-options/product-options.component';
import { AliasBarcodesComponent }        from './components/alias-barcodes/alias-barcodes.component';
import { ProductMediaCardComponent }     from './components/product-media/product-media.component';
import { ProductTabBuilderSectionComponent } from './components/tab-builder/tab-builder-section.component';
import { ProductFormSkeletonComponent } from './components/product-form-skeleton/product-form-skeleton.component';
import { SeoSettingsComponent } from './components/seo-settings/seo-settings.component';
import { CollapsibleCardsDirective } from '@shared/directives/collapsible-cards.directive';

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
    KitDetailsComponent,
    PriceByTeamComponent,
    RecipeBuilderComponent,
    PackageBuilderComponent,
    MenuSelectionComponent,
    OptionsTabComponent,
    MeasurementsComponent,
    ProductAttributesComponent,
    AltProductComponent,
    FoodNutritionComponent,
    AllergensComponent,
    ShippingOptionsComponent,
    EntityCustomFieldsComponent,
    ProductOptionsComponent,
    AliasBarcodesComponent,
    ProductMediaCardComponent,
    ProductTabBuilderSectionComponent,
    ProductFormSkeletonComponent,
    SeoSettingsComponent,
    CollapsibleCardsDirective,
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
  private toast = inject(ToastService);
  private el = inject(ElementRef<HTMLElement>);
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
  /** Big H1 shown beneath the breadcrumb. */
  pageTitle = computed<string>(() => {
    const type = this.productType();
    const status = this.formStatus();
    const name = this.productInfo()?.name;
    const typeLabel = this.translate.instant('PRODUCTS.TYPES.' + this.typeI18nKey(type));
    const titleKey = status === 'new' ? 'PRODUCTS.FORM.ADD_TITLE' : 'PRODUCTS.FORM.EDIT_TITLE';
    const title = this.translate.instant(titleKey, { value: typeLabel });
    return status === 'edit' && name ? `${title}: ${name}` : title;
  });

  /** Trail above the H1 — parent (clickable) › current page (text only). */
  breadcrumbs = computed<BreadcrumbItem[]>(() => [
    {
      label: this.translate.instant('PRODUCTS.TITLE'),
      routerLink: '/products',
    },
    { label: this.pageTitle() },
  ]);

  // Query params we pass through when navigating back to the list
  private listQueryParams: Record<string, string> = {};
  private canGoBack = false;
  private destroy$ = new Subject<void>();

  constructor() {
    withTranslations('products');
    this.canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  }

  async ngOnInit(): Promise<void> {
    // Preserve list context for back navigation. `branch` is the deep-link
    // param from the matrix editor (select this branch on open) — kept here so
    // it survives the type-correction redirect below and reaches the branch
    // section after a reload.
    for (const key of ['pageNum', 'pageLimit', 'filterByType', 'searchTerm', 'branch']) {
      const v = this.route.snapshot.queryParamMap.get(key);
      if (v != null) this.listQueryParams[key] = v;
    }

    // Load the user's section visibility / order — runs in parallel
    // with the product fetch below; the form template binds to the
    // service's signals so it re-renders when prefs arrive.
    if (!this.sectionPrefs.loaded()) {
      void this.sectionPrefs.load();
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

  /** Recursively count invalid leaf controls under the given node, plus
   *  any errors set directly on intermediate FormGroup / FormArray nodes
   *  (e.g. a "required: empty list" error on a FormArray with no children). */
  private countInvalid(ctrl: AbstractControl | null | undefined): number {
    if (!ctrl) return 0;
    if (ctrl instanceof FormGroup || ctrl instanceof FormArray) {
      const children: AbstractControl[] = ctrl instanceof FormArray
        ? ctrl.controls
        : Object.values(ctrl.controls);
      let sum = 0;
      for (const c of children) sum += this.countInvalid(c);
      if (ctrl.errors) sum += 1;
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

  /** Privilege gate for the header Print Label button — same flag the
   *  list page uses, so toggling the feature off in roles hides both. */
  readonly canPrintLabel = this.privileges.check('productSecurity.actions.printBarcode.access');

  /** Section-prefs service drives the visibility / order of the form
   *  sections — keyed by product type, so each type
   *  (`inventory` / `batch` / `service` / `kit` / …) carries its own
   *  layout. The template binds to `mainSections()` / `asideSections()`
   *  and wraps each one in `[class.pf-section--hidden]="!sec.visible"`
   *  — components stay mounted when toggled off so their form data
   *  keeps flowing into the save payload. */
  readonly sectionPrefs = inject(ProductFormPrefsService);
  /** Multi-row layout for the active product type. Each row carries
   *  a layout (`'2-1'` / `'1-1'` / `'1-2'` / `'single'`) plus two
   *  ordered columns of resolved sections. The form template
   *  iterates this array — one row per `<div class="form-row">`
   *  with a `grid-template-columns` derived from the row's layout. */
  layoutRows = computed(() => this.sectionPrefs.resolveRows(this.productType() || 'default'));

  /** Set of section ids that the form would actually render for
   *  the current product type + company config + user privileges.
   *  Mirrors the per-section `@if` guards in the template so the
   *  Advanced Options modal hides anything the user couldn't make
   *  visible anyway. Reactive — flips with `fieldsOptions()` (which
   *  itself depends on the active product type). */
  availableSectionIds = computed<Set<string>>(() => {
    const f = this.fieldsOptions();
    const ids = new Set<string>();
    // Always-on sections — no `@if` guard in the form template.
    ids.add('common-fields');
    ids.add('tab-builder');
    ids.add('options-tab');
    ids.add('branches');
    ids.add('product-options');
    if (f?.pricing)                                               ids.add('pricing');
    if (f?.inventory)                                             ids.add('inventory');
    if (f?.suppliers?.isVisible
        && this.privileges.check('productSecurity.actions.supplierSection.access')) ids.add('suppliers');
    if (f?.priceByTeam?.isVisible)                                ids.add('price-by-team');
    if (f?.kitDetails?.isVisible)                                 ids.add('kit-details');
    if (f?.kitBuilder?.isVisible)                                 ids.add('kit-builder');
    if (f?.recipe?.isVisible
        && this.privileges.check('productRecipeSecurity.actions.view.access')) ids.add('recipe');
    if (f?.menuSelection?.isVisible)                              ids.add('menu-selection');
    if (f?.packageBuilder?.isVisible)                             ids.add('package-builder');
    if (f?.customFields?.isVisible)                               ids.add('custom-fields');
    if (f?.productAttributes?.isVisible)                          ids.add('product-attributes');
    if (f?.allergens?.isVisible)                                  ids.add('allergens');
    if (f?.nutrition?.isVisible)                                  ids.add('nutrition');
    if (f?.image)                                                 ids.add('media');
    if (f?.measurements?.isVisible)                               ids.add('measurements');
    if (f?.shippingOptions?.isVisible)                            ids.add('shipping-options');
    if (f?.department?.isVisible || f?.category?.isVisible || f?.brand?.isVisible) ids.add('category-options');
    if (f?.aliasBarcodes?.isVisible)                              ids.add('alias-barcodes');
    if (f?.altProduct?.isVisible)                                 ids.add('alt-product');
    // SEO section is always available — its inputs come from the
    // product's own name / description / image, so no per-type
    // visibility gate is required.
    ids.add('seo');
    return ids;
  });

  /** Open the Advanced Options modal — drag-reorders + toggles
   *  visibility for the form sections. Modal saves under the
   *  current product type so each type carries its own layout, and
   *  only lists sections the form would actually render. */
  openAdvancedOptions(): void {
    this.modalService.open<AdvancedOptionsModalComponent, AdvancedOptionsModalData, void>(
      AdvancedOptionsModalComponent,
      {
        size: 'lg',
        data: {
          productType:      this.productType() || 'default',
          // Naïve `.toUpperCase()` produces `MENUITEM` / `MENUSELECTION`,
          // but the i18n catalog stores those as `MENU_ITEM` and
          // `MENU_SELECTION` (screaming-snake). Insert an underscore
          // before each interior capital first so the key resolves
          // for every camelCase product type.
          productTypeLabel: this.translate.instant(
            `PRODUCTS.TYPES.${(this.productType() || 'default')
              .replace(/([a-z])([A-Z])/g, '$1_$2')
              .toUpperCase()}`,
          ),
          availableSectionIds: this.availableSectionIds(),
        },
      },
    );
  }

  /** True for an existing product (not the "new product" route). The
   *  Print Label button is hidden on the new-product flow because
   *  there's nothing yet to print. */
  isExistingProduct = computed<boolean>(() => {
    const id = this.productId();
    return !!id && id !== '0' && id !== 'new';
  });

  /** Open the Print Label modal for the in-form product. Reads the
   *  current `productInfo` snapshot (form values may differ from
   *  saved state, but printing reflects what the canvas will see). */
  printLabel(): void {
    const info = this.productInfo();
    if (!info) return;
    this.productsService.showGenerateBarcode(info);
  }

  /**
   * Maps the backend's `meta.field` diff keys (see `LogsDrawerComponent`'s
   * `FIELD_DIFFS`) to the reactive-form path that field lives at. Only
   * `name`/`defaultPrice`/`barcode` are diffed by the backend today — see
   * `product.controller.ts` `editProduct()` — so that's all a "Restore"
   * action can act on; every other field has no history to restore.
   */
  private static readonly HISTORY_FIELD_PATHS: Record<string, [group: string, control: string]> = {
    name:         ['common', 'name'],
    barcode:      ['common', 'barcode'],
    defaultPrice: ['pricing', 'defaultPrice'],
  };

  /** Activity log for this product, with per-field "Restore" on the 3
   *  fields the backend actually diffs (name/price/barcode — see above). */
  openHistory(): void {
    this.modalService.open<LogsDrawerComponent, LogsDrawerData, void>(LogsDrawerComponent, {
      drawer: true,
      drawerWidth: '480px',
      drawerResizable: true,
      data: {
        sourceTable: 'Products',
        sourceId: this.productId(),
        title: this.pageTitle(),
        onRestore: (field, value) => this.restoreHistoryField(field, value),
      },
    });
  }

  private restoreHistoryField(field: string, value: string): void {
    const path = ProductFormComponent.HISTORY_FIELD_PATHS[field];
    const control = path && this.productForm.get(path);
    if (!control) return;
    control.patchValue(field === 'defaultPrice' ? Number(value) : value);
    control.markAsDirty();
    this.toast.success('COMMON.LOGS.RESTORED');
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async saveProduct(): Promise<void> {
    const info = this.productInfo();
    if (!info || this.productForm.invalid) {
      // Reveal every field's validation UI (messages are gated on `touched`)
      // and take the user straight to the first offending field — otherwise
      // a required control they never focused (e.g. an empty UOM) blocks the
      // save with no on-screen hint about where the problem is.
      this.productForm.markAllAsTouched();
      this.scrollToFirstError();
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

  /**
   * Scroll to (and focus) the first invalid form field so the user can see
   * exactly what's blocking the save. Deferred a tick so `markAllAsTouched`
   * has flushed `ng-invalid` / the error messages into the DOM first.
   * Prefers a *visible* control — a required control in a collapsed/hidden
   * section can't be scrolled to — but falls back to the first match so we
   * never silently do nothing.
   */
  private scrollToFirstError(): void {
    setTimeout(() => {
      const host = this.el.nativeElement as HTMLElement;
      const invalids = Array.from(
        host.querySelectorAll<HTMLElement>('[formcontrolname].ng-invalid'),
      );
      const target = invalids.find((elm) => elm.offsetParent !== null) ?? invalids[0];
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = target.matches('input,select,textarea,button')
        ? target
        : target.querySelector<HTMLElement>('input,select,textarea,button,[tabindex]');
      focusable?.focus({ preventScroll: true });
    });
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
