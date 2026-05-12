import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { TimePickerComponent } from '@shared/components/time-picker/time-picker.component';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { getProductTypeBadgeStyle } from '../../../products/utils/product-type-badge';

import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';
import {
  PickProductPlModalComponent,
  PickProductPlModalData,
  PickProductPlModalResult,
} from '../../../price-label/components/pick-product-modal/pick-product-pl-modal.component';
import {
  PickCategoryModalComponent,
  PickCategoryModalData,
  PickCategoryModalResult,
} from '../../components/pick-category-modal/pick-category-modal.component';
import type {
  DropdownLoadFn,
  DropdownLoadResult,
} from '@shared/components/dropdown/search-dropdown.types';

import { DiscountService } from '../../services/discount.service';
import { Discount, DiscountApplyTo, DiscountType, emptyDiscount } from '../../services/discount.types';
import { ProductListService } from '../../../products/services/product-list.service';
import { BranchSettingsService } from '../../../settings/services/branch-settings.service';

interface ProductOption  {
  id:            string;
  name:          string;
  image?:        string;
  barcode?:      string;
  type?:         string;
  defaultPrice?: number;
}
interface CategoryOption {
  id:    string;
  name:  string;
  image?: string;
}
interface BranchOption   { id: string; name: string; }
interface EmployeeOption { id: string; name: string; }

/**
 * Discount editor (`/settings/discounts/:id`). Uses `id === 'new'`
 * for creates so the URL is meaningful before save. Lean MVP:
 *
 *   • name, amount, percent vs fixed toggle, min product qty
 *   • apply-to-product picker (multi-select; empty = applies to all)
 *   • branch restriction (multi-select; empty = all branches)
 *
 * Type=automatic (scheduled start/expire) and `permittedEmployees`
 * are intentionally not surfaced here — the wire fields are still
 * round-tripped on the model, so a follow-up patch can add the UI
 * without touching the backend or the service.
 *
 * Same chrome conventions as the price-label / surcharge forms:
 * fixed save bar, Cmd/Ctrl+S, snapshot-based unsaved-changes guard,
 * Toast on save result.
 */
@Component({
  selector: 'app-discount-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SearchDropdownComponent,
    DatePickerComponent,
    TimePickerComponent,
    SegmentedToggleComponent,
    MycurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './discount-form.component.html',
  styleUrl:    './discount-form.component.scss',
})
export class DiscountFormComponent implements OnInit, CanLeaveComponent {
  private service     = inject(DiscountService);
  private products    = inject(ProductListService);
  private branchSvc   = inject(BranchSettingsService);
  private translate   = inject(TranslateService);
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);
  private toast       = inject(ToastService);
  private modal       = inject(ModalService);
  private destroyRef  = inject(DestroyRef);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  discount = signal<Discount>(emptyDiscount());

  /** Cached selections for the picker dropdowns — used so
   *  `displayWith` can resolve a name from an id on first render
   *  without an extra request. Each cache is keyed by id. */
  productCache  = signal<Map<string, ProductOption>>(new Map());
  categoryCache = signal<Map<string, CategoryOption>>(new Map());
  branchCache   = signal<Map<string, BranchOption>>(new Map());
  employeeCache = signal<Map<string, EmployeeOption>>(new Map());

  /** Async name-uniqueness state. `validating` drives a small
   *  spinner near the name field; `duplicate` shorts the save
   *  button. */
  nameValidating = signal<boolean>(false);
  nameDuplicate  = signal<boolean>(false);
  private nameCheckDebounce?: ReturnType<typeof setTimeout>;
  private nameCheckToken = 0;

  // ── Segmented-toggle options ────────────────────────────────────
  // Static option arrays for the shared `<app-segmented-toggle>`.
  // Labels are i18n keys — the toggle pipes them through translate.
  readonly typeOptions:    SegmentedToggleOption<DiscountType>[] = [
    { value: 'manual',    label: 'DISCOUNT.FORM.TYPE_MANUAL' },
    { value: 'automatic', label: 'DISCOUNT.FORM.TYPE_AUTOMATIC' },
  ];
  readonly applyToOptions: SegmentedToggleOption<DiscountApplyTo>[] = [
    { value: 'product',  label: 'DISCOUNT.FORM.APPLY_PRODUCT' },
    { value: 'category', label: 'DISCOUNT.FORM.APPLY_CATEGORY' },
  ];
  readonly amountKindOptions: SegmentedToggleOption<'fixed' | 'percent'>[] = [
    { value: 'fixed',   label: 'DISCOUNT.FORM.FIXED' },
    { value: 'percent', label: 'DISCOUNT.FORM.PERCENT' },
  ];

  /** Bridge between the boolean `percentage` flag on the model and
   *  the segmented toggle's `'fixed' | 'percent'` value space. */
  amountKind = computed<'fixed' | 'percent'>(() => this.discount().percentage ? 'percent' : 'fixed');
  onAmountKindChange(kind: 'fixed' | 'percent'): void {
    this.setPercentage(kind === 'percent');
  }

  cleanSnapshot = signal<string>('');

  private i18nTick = signal(0);

  isExisting = computed<boolean>(() => !!this.discount().id);

  pageTitle = computed<string>(() => {
    this.i18nTick();
    const d = this.discount();
    return d.id
      ? this.translate.instant('DISCOUNT.FORM.EDIT_TITLE', { name: d.name || '—' })
      : this.translate.instant('DISCOUNT.FORM.NEW_TITLE');
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'),         routerLink: '/settings' },
      { label: this.translate.instant('DISCOUNT.LIST.TITLE'),    routerLink: '/settings/discounts' },
      { label: this.pageTitle() },
    ];
  });

  // ─── Dropdown adapters (generic over `{ id, name }`) ────────────
  display = (o: { name?: string } | null) => o?.name ?? '';
  compare = (a: { id?: string } | null, b: { id?: string } | null) => (a?.id ?? '') === (b?.id ?? '');
  toValue = (o: { id?: string } | null) => o?.id ?? '';

  /** Product loader — paginates server-side via the standard
   *  `product/getProductsListByType` endpoint. First page is cached
   *  so the trigger can render selected names on first paint.
   *  The backend's `name` field is sometimes a translation object
   *  (`{en, ar}`); prefer `displayName` and resolve via `resolveName`
   *  so the trigger never renders `[object Object]`. */
  loadProducts: DropdownLoadFn<ProductOption> = async (params) => {
    const res = await this.products.getProductsListByType({
      page:       params.page,
      limit:      params.pageSize,
      searchTerm: params.search || '',
    });
    const list: any[] = Array.isArray(res?.list) ? res.list : [];
    const mapped: ProductOption[] = list
      .map(p => this.toProductOption(p))
      .filter(p => p.id);
    if (params.page === 1) this.mergeProductCache(mapped);
    const total = Number(res?.count ?? mapped.length) || 0;
    const hasMore = params.page * params.pageSize < total;
    return { items: mapped, hasMore } satisfies DropdownLoadResult<ProductOption>;
  };

  /** Branch loader — same pattern, hits `branch/getBranches`. */
  loadBranches: DropdownLoadFn<BranchOption> = async (params) => {
    const res = await this.branchSvc.getList({
      page:       params.page,
      limit:      params.pageSize,
      searchTerm: params.search || '',
    });
    const mapped: BranchOption[] = res.list.map(b => ({ id: b.id, name: b.name }));
    if (params.page === 1) this.mergeBranchCache(mapped);
    const hasMore = params.page * params.pageSize < res.count;
    return { items: mapped, hasMore } satisfies DropdownLoadResult<BranchOption>;
  };

  /** Category loader (multi-select). Hits `product/getCategoryList`
   *  via the service wrapper. */
  loadCategories: DropdownLoadFn<CategoryOption> = async (params) => {
    const res = await this.service.loadCategoriesPage({
      page:       params.page,
      limit:      params.pageSize,
      searchTerm: params.search || '',
    });
    const enriched = res.list.map(c => ({
      ...c,
      // Service returns `{id, name}` plus opportunistic image when
      // present in the raw row — cast loosely so the type allows it.
      image: (c as any).image,
    }));
    if (params.page === 1) this.mergeCategoryCache(enriched);
    const hasMore = params.page * params.pageSize < res.count;
    return { items: enriched, hasMore } satisfies DropdownLoadResult<CategoryOption>;
  };

  /** Employee loader for the "permitted employees" multi-select.
   *  Hits the service's `loadEmployeesPage` wrapper which maps to
   *  `employee/getEmployeeList`. Forwards the currently-selected
   *  employee ids on page 1 so the backend pins them at the top —
   *  the saved selections then resolve without paging. */
  loadEmployees: DropdownLoadFn<EmployeeOption> = async (params) => {
    const res = await this.service.loadEmployeesPage({
      page:       params.page,
      limit:      params.pageSize,
      searchTerm: params.search || '',
      employees:  params.page === 1 ? (this.discount().permittedEmployees ?? []) : undefined,
    });
    if (params.page === 1) this.mergeEmployeeCache(res.list);
    const hasMore = params.page * params.pageSize < res.count;
    return { items: res.list, hasMore } satisfies DropdownLoadResult<EmployeeOption>;
  };

  /** Resolve the currently-selected product ids back to `{id, name}`
   *  objects for the dropdown's `[value]` binding. Falls back to a
   *  best-effort id-only object when the cache hasn't loaded yet. */
  selectedProducts = computed<ProductOption[]>(() => {
    if (this.discount().applyTo !== 'product') return [];
    const cache = this.productCache();
    return this.discount().items.map(id => cache.get(id) ?? { id, name: id });
  });
  selectedCategories = computed<CategoryOption[]>(() => {
    if (this.discount().applyTo !== 'category') return [];
    const cache = this.categoryCache();
    return this.discount().items.map(id => cache.get(id) ?? { id, name: id });
  });
  selectedBranches = computed<BranchOption[]>(() => {
    const cache = this.branchCache();
    return this.discount().branches.map(id => cache.get(id) ?? { id, name: id });
  });
  selectedEmployees = computed<EmployeeOption[]>(() => {
    const cache = this.employeeCache();
    return (this.discount().permittedEmployees ?? []).map(id => cache.get(id) ?? { id, name: id });
  });

  constructor() {
    withTranslations('discount');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));

    // Name uniqueness — runs whenever the user edits `name`. 500ms
    // debounce + a monotonic token so an in-flight check that loses
    // the race against a newer one is silently discarded. Skips
    // when the value matches the saved snapshot (no point asking
    // the server about a name we already saved successfully).
    effect(() => {
      const d = this.discount();
      const name = d.name.trim();
      // `untracked()` for cleanSnapshot so the effect doesn't fire
      // every time we snapshot (which happens on every save).
      const isPristine = untracked(() => this.snapshotMatches(d));

      clearTimeout(this.nameCheckDebounce);
      if (!name || isPristine) {
        this.nameValidating.set(false);
        this.nameDuplicate.set(false);
        return;
      }

      this.nameValidating.set(true);
      const myToken = ++this.nameCheckToken;
      this.nameCheckDebounce = setTimeout(async () => {
        try {
          const free = await this.service.isNameAvailable(name, d.id || null);
          if (myToken !== this.nameCheckToken) return; // superseded
          this.nameDuplicate.set(!free);
        } catch {
          // Network errors don't block the save — fall through.
          if (myToken === this.nameCheckToken) this.nameDuplicate.set(false);
        } finally {
          if (myToken === this.nameCheckToken) this.nameValidating.set(false);
        }
      }, 500);
    });
  }

  /** True when the current in-memory state matches the last saved
   *  snapshot — used by the name-uniqueness effect to skip pinging
   *  the backend about a name that hasn't changed since load. */
  private snapshotMatches(d: Discount): boolean {
    return JSON.stringify(d) === this.cleanSnapshot();
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.loading.set(true);
      try {
        const fresh = await this.service.getById(id);
        if (fresh) {
          // Seed the picker caches with the server's inline snapshots
          // so saved selections render with real names on first paint
          // — without these the trigger would fall back to bare ids
          // until the user opened the picker and the preload paged
          // to the right entries.
          this.mergeProductCache(fresh.selections.items);
          this.mergeCategoryCache(fresh.selections.items);
          this.mergeBranchCache(fresh.selections.branches);
          this.mergeEmployeeCache(fresh.selections.employees);

          // Snapshot the loaded state BEFORE pushing it into the
          // signal. The name-uniqueness effect compares the current
          // discount against `cleanSnapshot()` to skip when nothing's
          // changed; doing this in this order means an existing row
          // doesn't fire a redundant validation request on load.
          this.cleanSnapshot.set(JSON.stringify(fresh.discount));
          this.discount.set(fresh.discount);
        }
      } finally {
        this.loading.set(false);
      }
    }
    // Pre-load first page of every picker so the triggers can
    // resolve the saved selections' display names on first render
    // without an extra round-trip per dropdown open.
    await Promise.all([
      this.preloadProducts(),
      this.preloadCategories(),
      this.preloadBranches(),
      this.preloadEmployees(),
    ]);
    // For new records the snapshot is still '' from construction —
    // resnap here so the dirty-check baseline matches the empty
    // initial state. For loaded records we already snapshotted above.
    if (!this.discount().id) this.cleanSnapshot.set(this.snapshot());
  }

  // ─── Field setters ──────────────────────────────────────────────
  setName(v: string): void {
    this.discount.update(d => ({ ...d, name: v }));
  }
  setAmount(v: number | string): void {
    const n = Number(v);
    this.discount.update(d => ({ ...d, amount: Number.isFinite(n) ? n : 0 }));
  }
  setPercentage(percentage: boolean): void {
    this.discount.update(d => ({
      ...d,
      percentage,
      // Quantity-based cash discount is mutually exclusive with
      // percentage — flipping to percent clears the flag.
      quantityBasedCashDiscount: percentage ? false : d.quantityBasedCashDiscount,
    }));
  }
  setQtyBasedCash(on: boolean): void {
    this.discount.update(d => ({ ...d, quantityBasedCashDiscount: on }));
  }
  setMinProductQty(v: number | string): void {
    const n = Number(v);
    this.discount.update(d => ({ ...d, minProductQty: Number.isFinite(n) ? Math.max(0, n) : 0 }));
  }
  /** Toggle apply-to between products and categories. The `items`
   *  array references different entities for each, so switching
   *  wipes it. Confirm with the user first when there's something
   *  to lose — silent switch otherwise. */
  async setApplyTo(value: DiscountApplyTo): Promise<void> {
    if (this.discount().applyTo === value) return;
    if (this.discount().items.length > 0) {
      const ok = await this.confirmApplyToSwitch(value);
      if (!ok) return;
    }
    this.discount.update(d => ({ ...d, applyTo: value, items: [] }));
  }

  private async confirmApplyToSwitch(next: DiscountApplyTo): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        closeOnBackdrop: false,
        data: {
          title:   this.translate.instant('DISCOUNT.FORM.APPLY_SWITCH_TITLE'),
          message: this.translate.instant(
            next === 'category'
              ? 'DISCOUNT.FORM.APPLY_SWITCH_TO_CATEGORY_MSG'
              : 'DISCOUNT.FORM.APPLY_SWITCH_TO_PRODUCT_MSG',
          ),
          confirm: this.translate.instant('COMMON.CONFIRM'),
          danger:  true,
        },
      },
    );
    return (await ref.afterClosed()) === true;
  }
  setProducts(v: ProductOption[] | ProductOption | null): void {
    const list = Array.isArray(v) ? v : v ? [v] : [];
    this.mergeProductCache(list);
    this.discount.update(d => ({ ...d, items: list.map(p => p.id) }));
  }
  setCategories(v: CategoryOption[] | CategoryOption | null): void {
    const list = Array.isArray(v) ? v : v ? [v] : [];
    this.mergeCategoryCache(list);
    this.discount.update(d => ({ ...d, items: list.map(c => c.id) }));
  }
  setBranches(v: BranchOption[] | BranchOption | null): void {
    const list = Array.isArray(v) ? v : v ? [v] : [];
    this.mergeBranchCache(list);
    this.discount.update(d => ({ ...d, branches: list.map(b => b.id) }));
  }
  setEmployees(v: EmployeeOption[] | EmployeeOption | null): void {
    const list = Array.isArray(v) ? v : v ? [v] : [];
    this.mergeEmployeeCache(list);
    this.discount.update(d => ({ ...d, permittedEmployees: list.map(e => e.id) }));
  }
  // ─── Modal-based product / category pickers ────────────────────
  /** Open the shared price-label product picker. Reusing it
   *  saves us building a near-duplicate; we just ignore the
   *  price-tracking fields it carries and only keep `{id, name,
   *  barcode, type, defaultPrice}` for the selected-item card. */
  async pickProducts(): Promise<void> {
    // Snapshot the live scroll position from whichever element
    // actually owns it. `window.scrollY` is 0 when a child element
    // is the scroll root, so fall through to `documentElement` and
    // `body` to cover all browser layouts.
    const scrollY = window.scrollY
      || document.documentElement.scrollTop
      || document.body.scrollTop
      || 0;
    const ref = this.modal.open<
      PickProductPlModalComponent,
      PickProductPlModalData,
      PickProductPlModalResult
    >(PickProductPlModalComponent, {
      size: 'md',
      data: {
        selectedIds: this.discount().items,
        title:       this.translate.instant('DISCOUNT.PICKER.PRODUCTS_TITLE'),
      },
      // Don't push a history sentinel for picker modals — the
      // `history.back()` issued on close drives the Angular router
      // through its scroll-position-restoration, which jumps to top.
      manageHistory: false,
    });
    const result = await ref.afterClosed();
    if (!result) {
      this.restoreScroll(scrollY);
      return;
    }

    const picked: ProductOption[] = result.selected.map(p => ({
      id:           p.productId,
      name:         p.productName,
      barcode:      p.barcode,
      type:         p.type,
      defaultPrice: p.defaultPrice,
    }));
    this.mergeProductCache(picked);
    this.discount.update(d => ({ ...d, items: picked.map(p => p.id) }));
    this.restoreScroll(scrollY);
  }

  async pickCategories(): Promise<void> {
    // Snapshot the live scroll position from whichever element
    // actually owns it. `window.scrollY` is 0 when a child element
    // is the scroll root, so fall through to `documentElement` and
    // `body` to cover all browser layouts.
    const scrollY = window.scrollY
      || document.documentElement.scrollTop
      || document.body.scrollTop
      || 0;
    const ref = this.modal.open<
      PickCategoryModalComponent,
      PickCategoryModalData,
      PickCategoryModalResult
    >(PickCategoryModalComponent, {
      size: 'md',
      data: {
        selectedIds: this.discount().items,
        title:       this.translate.instant('DISCOUNT.PICKER.CATEGORIES_TITLE'),
      },
      manageHistory: false,
    });
    const result = await ref.afterClosed();
    if (!result) {
      this.restoreScroll(scrollY);
      return;
    }

    const picked: CategoryOption[] = result.selected.map(c => ({
      id:    c.id,
      name:  c.name,
      image: c.image,
    }));
    this.mergeCategoryCache(picked);
    this.discount.update(d => ({ ...d, items: picked.map(c => c.id) }));
    this.restoreScroll(scrollY);
  }

  /** Restore the page's scroll position after a picker closes.
   *  CDK's `BlockScrollStrategy` saves + restores scroll, but our
   *  signal updates fire a re-render of the items list right after,
   *  which under some conditions clobbers the restore. We re-apply
   *  the pre-open scroll twice:
   *    • once on the next microtask, immediately after Angular's
   *      change detection has rendered the items update;
   *    • once on the following animation frame, to overwrite any
   *      late scroll-restore from `BlockScrollStrategy`.
   *  Targets `documentElement` AND `window` so both the legacy and
   *  modern browsers' scroll roots are covered. */
  private restoreScroll(y: number): void {
    const apply = () => {
      // Disable native smooth scroll briefly so the restore is
      // instant — `scroll-behavior: smooth` would animate the jump.
      const html = document.documentElement;
      const prev = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      try {
        window.scrollTo(0, y);
        if (html.scrollTop !== y) html.scrollTop = y;
        if (document.body.scrollTop && document.body.scrollTop !== y) {
          document.body.scrollTop = y;
        }
      } finally {
        html.style.scrollBehavior = prev;
      }
    };
    // Microtask: catches the restore once Angular's signal-driven
    // re-render has committed to the DOM.
    queueMicrotask(apply);
    // Animation frame: catches any later scroll restore from CDK
    // (BlockScrollStrategy.detach() runs async on some platforms).
    requestAnimationFrame(apply);
  }

  /** Drop a single item (product or category) from the selection. */
  removeItem(id: string): void {
    this.discount.update(d => ({ ...d, items: (d.items ?? []).filter(x => x !== id) }));
  }

  /** Per-product-type chip palette — wraps the shared util so the
   *  template can call it via `[ngStyle]`. Same palette across
   *  surfaces (products list, price-label form, picker modals). */
  getTypeBadgeStyle(type: string | undefined): Record<string, string> {
    return getProductTypeBadgeStyle(type);
  }

  /** Drop a single employee from the selection — driven by the
   *  chip's ✕ button so the user can prune the list without
   *  re-opening the picker. */
  removeEmployee(id: string): void {
    this.discount.update(d => ({
      ...d,
      permittedEmployees: (d.permittedEmployees ?? []).filter(x => x !== id),
    }));
  }
  setAvailable(on: boolean): void {
    this.discount.update(d => ({ ...d, available: on }));
  }
  setAvailableOnline(on: boolean): void {
    this.discount.update(d => ({ ...d, availableOnline: on }));
  }

  // ─── Type + automatic schedule ──────────────────────────────────
  /** Toggle between `manual` and `automatic`. Switching back to
   *  manual clears schedule fields so they don't sneak back when
   *  the user flips again — keeps the save payload clean. */
  setType(type: DiscountType): void {
    this.discount.update(d => {
      if (type === 'automatic') {
        // Seed sensible defaults the first time the user enters
        // automatic mode so the form is immediately valid: today's
        // start date, all-day window.
        return {
          ...d,
          type,
          startDate:    d.startDate    ?? new Date().toISOString(),
          expireDate:   d.expireDate   ?? null,
          startAtTime:  d.startAtTime  ?? null,
          expireAtTime: d.expireAtTime ?? null,
        };
      }
      return {
        ...d,
        type,
        startDate:    null,
        expireDate:   null,
        startAtTime:  null,
        expireAtTime: null,
      };
    });
  }

  /** When `true`, both `startAtTime` and `expireAtTime` are null —
   *  matches the legacy `Discount.allDay` derivation rule. Drives
   *  the All-day checkbox in the template. */
  isAllDay = computed<boolean>(() => {
    const d = this.discount();
    return d.type === 'automatic' && !d.startAtTime && !d.expireAtTime;
  });

  setAllDay(on: boolean): void {
    this.discount.update(d => ({
      ...d,
      // Off → seed the legacy defaults (whole-day window). On → null
      // both times. The picker's local mode then renders disabled.
      startAtTime:  on ? null : (d.startAtTime  ?? '00:00:00'),
      expireAtTime: on ? null : (d.expireAtTime ?? '23:59:59'),
    }));
  }

  /** Date inputs round-trip as bare `YYYY-MM-DD` strings on the
   *  wire — no time component, no timezone offset. Picking "May
   *  20" sends `"2026-05-20"` regardless of where the user (or
   *  the server) sits in the world. The time-of-day for
   *  start/expire is carried separately on
   *  `startAtTime` / `expireAtTime`. */
  setStartDate(v: Date | null): void {
    this.discount.update(d => ({ ...d, startDate: this.toDateOnlyString(v) }));
  }
  setExpireDate(v: Date | null): void {
    this.discount.update(d => ({ ...d, expireDate: this.toDateOnlyString(v) }));
  }

  private toDateOnlyString(v: Date | null): string | null {
    if (!v) return null;
    const y  = v.getFullYear();
    const m  = String(v.getMonth() + 1).padStart(2, '0');
    const d  = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  /** TimePicker is CVA-friendly and emits `HH:mm` strings. */
  setStartAtTime(v: string | null): void {
    this.discount.update(d => ({ ...d, startAtTime: v || null }));
  }
  setExpireAtTime(v: string | null): void {
    this.discount.update(d => ({ ...d, expireAtTime: v || null }));
  }

  /** Picker `[value]` adapters — turn the wire ISO string into a
   *  `Date` object the picker accepts. */
  startDate   = computed<Date | null>(() => this.parseIsoDate(this.discount().startDate));
  expireDate  = computed<Date | null>(() => this.parseIsoDate(this.discount().expireDate));
  /** TimePicker takes `HH:mm` (or `HH:mm:ss` — both round-trip). */
  startAtTime  = computed<string>(() => this.discount().startAtTime  ?? '');
  expireAtTime = computed<string>(() => this.discount().expireAtTime ?? '');

  private parseIsoDate(v: string | null | undefined): Date | null {
    if (!v) return null;
    // Pure `YYYY-MM-DD` — build a LOCAL Date so the picker shows
    // the same calendar day. Native `new Date('2025-09-20')` parses
    // as UTC midnight, which displays as the previous day in
    // negative-offset zones.
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (dateOnly) {
      const [, y, m, d] = dateOnly;
      return new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
    }
    // Fall back to native parsing for legacy ISO timestamps still
    // sitting in the DB from before this change.
    const t = Date.parse(v);
    return Number.isFinite(t) ? new Date(t) : null;
  }

  // ─── Validation ─────────────────────────────────────────────────
  nameError = computed<string | null>(() => {
    if (!this.discount().name.trim()) return 'DISCOUNT.FORM.ERR_NAME_REQUIRED';
    if (this.nameDuplicate())          return 'DISCOUNT.FORM.ERR_NAME_DUPLICATE';
    return null;
  });
  amountError = computed<string | null>(() => {
    const d = this.discount();
    if (!Number.isFinite(d.amount) || d.amount <= 0) return 'DISCOUNT.FORM.ERR_AMOUNT_INVALID';
    if (d.percentage && d.amount > 100)              return 'DISCOUNT.FORM.ERR_PERCENT_RANGE';
    return null;
  });
  scheduleError = computed<string | null>(() => {
    const d = this.discount();
    if (d.type !== 'automatic') return null;
    if (!d.startDate) return 'DISCOUNT.FORM.ERR_START_REQUIRED';
    // If both dates set, expire must not be before start.
    if (d.expireDate && d.startDate && Date.parse(d.expireDate) < Date.parse(d.startDate)) {
      return 'DISCOUNT.FORM.ERR_EXPIRE_BEFORE_START';
    }
    return null;
  });

  // Per-field error flags — drive a red trigger border on the
  // exact picker that's at fault so the user doesn't have to read
  // the message text to find the offending field.
  startDateInvalid  = computed<boolean>(() => this.scheduleError() === 'DISCOUNT.FORM.ERR_START_REQUIRED');
  expireDateInvalid = computed<boolean>(() => this.scheduleError() === 'DISCOUNT.FORM.ERR_EXPIRE_BEFORE_START');

  /** Tailwind class string passed through to the date picker's
   *  trigger when the field is invalid. `!` prefix marks each rule
   *  `!important` so it beats the picker's default slate border. */
  private readonly invalidTriggerClass = '!border-rose-400 !bg-rose-50/40';
  startDateTriggerClass  = computed<string>(() => this.startDateInvalid()  ? this.invalidTriggerClass : '');
  expireDateTriggerClass = computed<string>(() => this.expireDateInvalid() ? this.invalidTriggerClass : '');
  isDirty = computed<boolean>(() => this.snapshot() !== this.cleanSnapshot());
  canSave = computed<boolean>(() =>
    !this.nameError() && !this.amountError() && !this.scheduleError() && !this.saving() && this.isDirty(),
  );

  // ─── Save / Cancel ──────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const res = await this.service.save(this.discount());
      if (res?.id) {
        this.discount.update(d => ({ ...d, id: res.id }));
        this.cleanSnapshot.set(this.snapshot());
        if (this.route.snapshot.paramMap.get('id') === 'new') {
          void this.router.navigate(['/settings/discounts', res.id], { replaceUrl: true });
        }
        this.toast.success('COMMON.SAVED_OK');
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
      throw err;
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/settings/discounts']);
  }

  // ─── Unsaved-changes guard ──────────────────────────────────────
  private snapshot(): string { return JSON.stringify(this.discount()); }
  hasUnsavedChanges(): boolean {
    return this.snapshot() !== this.cleanSnapshot();
  }

  // Cmd/Ctrl + S → save
  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      void this.save();
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────
  private async preloadProducts(): Promise<void> {
    try {
      const res = await this.products.getProductsListByType({ page: 1, limit: 50 });
      const list: any[] = Array.isArray(res?.list) ? res.list : [];
      this.mergeProductCache(
        list.map(p => this.toProductOption(p)).filter(p => p.id),
      );
    } catch { /* dropdown will lazy-load on open */ }
  }

  private async preloadBranches(): Promise<void> {
    try {
      const res = await this.branchSvc.getList({ page: 1, limit: 100 });
      this.mergeBranchCache(res.list.map(b => ({ id: b.id, name: b.name })));
    } catch { /* dropdown will lazy-load on open */ }
  }

  private async preloadCategories(): Promise<void> {
    try {
      const res = await this.service.loadCategoriesPage({ page: 1, limit: 50 });
      this.mergeCategoryCache(res.list);
    } catch { /* dropdown will lazy-load on open */ }
  }

  private async preloadEmployees(): Promise<void> {
    try {
      const res = await this.service.loadEmployeesPage({
        page:      1,
        limit:     50,
        // Pin the saved permitted employees at the top of page 1
        // so their names are in cache before the trigger renders.
        employees: this.discount().permittedEmployees ?? [],
      });
      this.mergeEmployeeCache(res.list);
    } catch { /* dropdown will lazy-load on open */ }
  }

  /** Build a `ProductOption` from a server product row — pulls
   *  out everything the selected-items card renders (image,
   *  barcode, type, default price) so the form doesn't need an
   *  extra fetch per row to display them. */
  private toProductOption(raw: any): ProductOption {
    return {
      id:           String(raw?.id ?? ''),
      name:         this.resolveName(raw),
      image:        raw?.imageUrl ?? raw?.image ?? raw?.thumbnail ?? undefined,
      barcode:      raw?.barcode ?? raw?.sku ?? undefined,
      type:         raw?.type ?? raw?.productType ?? undefined,
      defaultPrice: typeof raw?.price === 'number'
        ? raw.price
        : (raw?.price != null && Number.isFinite(Number(raw.price)) ? Number(raw.price) : undefined),
    };
  }

  /** Resolve a backend row's `name` to a plain string. The
   *  `name` field is sometimes a translation map (`{en, ar}`),
   *  sometimes a plain string. `displayName` is the server-side
   *  resolved variant when present. Falls through to the first
   *  non-empty value in the map, or the id, so we never emit
   *  `"[object Object]"`. */
  private resolveName(raw: any): string {
    if (!raw) return '';
    const dn = raw?.displayName;
    if (typeof dn === 'string' && dn.trim()) return dn;
    const n = raw?.name;
    if (typeof n === 'string') return n;
    if (n && typeof n === 'object') {
      const lang = this.translate.currentLang || this.translate.defaultLang;
      const langed = lang && n[lang];
      if (typeof langed === 'string' && langed.trim()) return langed;
      for (const v of Object.values(n)) {
        if (typeof v === 'string' && v.trim()) return v;
      }
    }
    return String(raw?.id ?? '');
  }

  private mergeProductCache(items: ProductOption[]): void {
    if (items.length === 0) return;
    this.productCache.update(cache => {
      const next = new Map(cache);
      items.forEach(p => next.set(p.id, p));
      return next;
    });
  }
  private mergeBranchCache(items: BranchOption[]): void {
    if (items.length === 0) return;
    this.branchCache.update(cache => {
      const next = new Map(cache);
      items.forEach(b => next.set(b.id, b));
      return next;
    });
  }
  private mergeCategoryCache(items: CategoryOption[]): void {
    if (items.length === 0) return;
    this.categoryCache.update(cache => {
      const next = new Map(cache);
      items.forEach(c => next.set(c.id, c));
      return next;
    });
  }
  private mergeEmployeeCache(items: EmployeeOption[]): void {
    if (items.length === 0) return;
    this.employeeCache.update(cache => {
      const next = new Map(cache);
      items.forEach(e => next.set(e.id, e));
      return next;
    });
  }
}
