import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { getProductTypeBadgeStyle } from '../../../products/utils/product-type-badge';

import { ProductsService } from '../../../products/services/products.service';

export interface PriceLabelPickedProduct {
  productId:    string;
  productName:  string;
  barcode?:     string;
  type?:        string;
  defaultPrice?: number;
  /** Existing override price for products already on the label —
   *  the form uses it as the seed for the override input on rows
   *  that come back through the picker. */
  price:        number;
}

export interface PickProductPlModalData {
  /** Already-listed product ids — surface at the top of the
   *  picker (same `selectedProductId` contract as the legacy
   *  modal). The user can untick to remove or keep + add new. */
  selectedIds:    string[];
  /** Per-id existing override price → seed for the row's price
   *  input when the product is already on the label. Lets the
   *  modal remember the user's prior price across reopens. */
  existingPrices?: Record<string, number>;
  title?: string;
}

export interface PickProductPlModalResult {
  /** Snapshot of every row the user kept ticked when applying.
   *  Form merges with its current state by id. */
  selected: PriceLabelPickedProduct[];
}

interface ProductRow {
  id:           string;
  name:         string;
  barcode?:     string;
  type?:        string;
  defaultPrice?: number;
  price:        number;
  /** Cached "ticked" state — drives the row checkbox. */
  picked:       boolean;
}

interface DropdownItem { label: string; value: string; }

const PRODUCT_TYPES: { value: string; labelKey: string }[] = [
  { value: 'all',           labelKey: 'PRICE_LABEL.PICKER.TYPE_ALL' },
  { value: 'inventory',     labelKey: 'PRODUCTS.TYPES.INVENTORY' },
  { value: 'serialized',    labelKey: 'PRODUCTS.TYPES.SERIALIZED' },
  { value: 'batch',         labelKey: 'PRODUCTS.TYPES.BATCH' },
  { value: 'kit',           labelKey: 'PRODUCTS.TYPES.KIT' },
  { value: 'service',       labelKey: 'PRODUCTS.TYPES.SERVICE' },
  { value: 'package',       labelKey: 'PRODUCTS.TYPES.PACKAGE' },
  { value: 'menuItem',      labelKey: 'PRODUCTS.TYPES.MENU_ITEM' },
  { value: 'menuSelection', labelKey: 'PRODUCTS.TYPES.MENU_SELECTION' },
  { value: 'tailoring',     labelKey: 'PRODUCTS.TYPES.TAILORING' },
];

/**
 * Price-label-specific product picker.
 * ────────────────────────────────────
 * Hits `product/getProductsListByType` (NOT the regular
 * `getProductList`) so the backend can pin already-selected ids at
 * the top of page 1 via `selectedProductId`. Filters: search,
 * department, category, type — all server-side.
 *
 * Returns a snapshot of every row the user kept ticked. The form
 * merges with its existing state by `productId`, preserving any
 * prior override price the user already typed in.
 */
@Component({
  selector: 'app-pick-product-pl-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalHeaderComponent,
    SearchDropdownComponent,
    MycurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pick-product-pl-modal.component.html',
  styleUrl: './pick-product-pl-modal.component.scss',
})
export class PickProductPlModalComponent implements OnInit, AfterViewInit, OnDestroy {
  private products  = inject(ProductsService);
  private translate = inject(TranslateService);
  private modalRef  = inject<ModalRef<PickProductPlModalResult>>(MODAL_REF);
  private destroyRef = inject(DestroyRef);
  data = inject<PickProductPlModalData>(MODAL_DATA) ?? { selectedIds: [] };

  private i18nTick = signal(0);

  search       = signal<string>('');
  loading      = signal<boolean>(false);
  page         = signal<number>(1);
  hasMore      = signal<boolean>(false);
  rows         = signal<ProductRow[]>([]);

  /** Show/hide the department / category / type filter row.
   *  Collapsed by default — most users search by name and never
   *  need the filters. The legacy modal uses the same pattern
   *  (small filter icon next to the search input). */
  filtersOpen  = signal<boolean>(false);

  departmentId = signal<string>('');
  categoryId   = signal<string>('');
  type         = signal<string>('all');

  /** True when any filter has a non-default value — used to badge
   *  the filter toggle so a collapsed-but-active filter set is
   *  still discoverable. */
  hasActiveFilters = computed<boolean>(() =>
    !!this.departmentId() || !!this.categoryId() || (this.type() !== 'all'),
  );

  /** Selected ids tracked across pages so checking a row, paging
   *  forward, and paging back keeps the tick. Initialised from the
   *  caller's `selectedIds` so already-listed products land
   *  pre-checked on first paint. */
  private selected = signal<Set<string>>(new Set(this.data.selectedIds ?? []));

  /** Per-id snapshot of the row data — used by `confirm()` so we
   *  can return rows the user un-paged away from. */
  private rowCache = new Map<string, ProductRow>();

  selectedCount = computed<number>(() => this.selected().size);

  // Translate the i18n key here so the dropdown trigger renders
  // human text — `displayWith` returns `item.label`, which the
  // trigger paints directly. The custom popover template still
  // uses `| translate`, which is a no-op on already-translated
  // strings (safe).
  typeItems = computed<DropdownItem[]>(() => {
    this.i18nTick();
    return PRODUCT_TYPES.map(t => ({
      label: this.translate.instant(t.labelKey),
      value: t.value,
    }));
  });
  selectedTypeItem = computed(() => this.typeItems().find(t => t.value === this.type()) ?? null);

  // Department / Category load functions — paginated, search-aware.
  // Both signatures match `app-search-dropdown`'s `loadFn` contract.
  loadDepartments = (params: { page: number; pageSize: number; search: string }) =>
    this.products.getDepartments(params).then(r => ({ items: r.items, hasMore: r.hasMore }));
  loadCategories = (params: { page: number; pageSize: number; search: string }) =>
    this.products.getCategories({ ...params, departmentId: this.departmentId() || null })
      .then(r => ({ items: r.items, hasMore: r.hasMore }));

  display = (item: any) => item?.label ?? '';
  compare = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);
  toValue = (item: any) => item?.value ?? item;

  readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private scrollObserver?: IntersectionObserver;
  private debounce?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    void this.loadPage(1);
    // Re-translate the type-dropdown labels when the user toggles
    // the language. `i18nTick` invalidates the `typeItems`
    // computed without rebuilding the rest of the modal state.
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  ngAfterViewInit(): void {
    const sentinel = this.scrollSentinel();
    if (!sentinel) return;
    this.scrollObserver = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (e?.isIntersecting && this.hasMore() && !this.loading()) {
        this.loadMore();
      }
    });
    this.scrollObserver.observe(sentinel.nativeElement);
  }

  ngOnDestroy(): void {
    this.scrollObserver?.disconnect();
    clearTimeout(this.debounce);
  }

  // ─── Filter handlers ────────────────────────────────────────────
  onSearchInput(value: string): void {
    this.search.set(value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.resetAndLoad(), 300);
  }

  onDepartmentChange(item: any): void {
    const id = item && typeof item === 'object' ? item.value : item;
    this.departmentId.set(id ?? '');
    // Department change clears the category — categories are
    // scoped to a department, so the previous pick is likely
    // invalid against the new department's catalog.
    this.categoryId.set('');
    this.resetAndLoad();
  }
  onCategoryChange(item: any): void {
    const id = item && typeof item === 'object' ? item.value : item;
    this.categoryId.set(id ?? '');
    this.resetAndLoad();
  }
  onTypeChange(item: any): void {
    const id = item && typeof item === 'object' ? item.value : item;
    this.type.set(id ?? 'all');
    this.resetAndLoad();
  }

  private resetAndLoad(): void {
    this.page.set(1);
    this.rows.set([]);
    void this.loadPage(1);
  }

  // ─── Loading ────────────────────────────────────────────────────
  async loadPage(page: number): Promise<void> {
    // Hold the spinner visible for a minimum time. Without this,
    // a sub-100 ms API response paints the spinner for one or two
    // frames and the user perceives nothing — they want to know
    // "is more on the way?" so we keep the indicator on screen
    // long enough to read.
    const startedAt = Date.now();
    const MIN_VISIBLE_MS = 350;
    this.loading.set(true);
    try {
      const filter: any = {};
      if (this.departmentId()) filter.departments = [this.departmentId()];
      if (this.categoryId())   filter.categories  = [this.categoryId()];
      const params: any = {
        page,
        limit:      20,
        searchTerm: this.search().trim(),
        sortBy:     {},
        filter,
        // Pin already-listed ids at the top of page 1, server-
        // side. Keeps the user's existing picks visible without
        // hunting through pages.
        selectedProductId: this.data.selectedIds ?? [],
      };
      if (this.type() && this.type() !== 'all') params.types = [this.type()];

      const res = await this.products.getProductsListByType(params);
      const mapped: ProductRow[] = (res.list ?? []).map((p: any) => {
        const id = String(p?.productId ?? p?.id ?? '');
        const seedPrice = this.data.existingPrices?.[id];
        const row: ProductRow = {
          id,
          name:         p?.name ?? '',
          barcode:      p?.barcode,
          type:         p?.type,
          defaultPrice: p?.defaultPrice != null ? Number(p.defaultPrice) : undefined,
          price:        Number(seedPrice ?? p?.price ?? p?.defaultPrice ?? 0) || 0,
          picked:       this.selected().has(id),
        };
        this.rowCache.set(id, row);
        return row;
      });

      if (page === 1) this.rows.set(mapped);
      else            this.rows.update(prev => [...prev, ...mapped]);
      this.hasMore.set(page < (res.pageCount ?? 1));
      this.page.set(page);
    } finally {
      const elapsed = Date.now() - startedAt;
      const remaining = MIN_VISIBLE_MS - elapsed;
      if (remaining > 0) {
        await new Promise(r => setTimeout(r, remaining));
      }
      this.loading.set(false);
    }
  }

  loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    void this.loadPage(this.page() + 1);
  }

  // ─── Selection ─────────────────────────────────────────────────
  toggle(id: string): void {
    this.selected.update(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      return next;
    });
    // Mirror on the visible row so the checkbox state isn't
    // dependent on a separate signal lookup.
    this.rows.update(rows => rows.map(r => r.id === id ? { ...r, picked: !r.picked } : r));
  }

  toggleSelectAll(): void {
    const list = this.rows();
    const allOn = list.every(r => r.picked);
    if (allOn) {
      this.selected.update(prev => {
        const next = new Set(prev);
        for (const r of list) next.delete(r.id);
        return next;
      });
      this.rows.update(rows => rows.map(r => ({ ...r, picked: false })));
    } else {
      this.selected.update(prev => {
        const next = new Set(prev);
        for (const r of list) next.add(r.id);
        return next;
      });
      this.rows.update(rows => rows.map(r => ({ ...r, picked: true })));
    }
  }

  // ─── Apply / Cancel ────────────────────────────────────────────
  apply(): void {
    const ids = this.selected();
    const result: PriceLabelPickedProduct[] = [];
    for (const id of ids) {
      const row = this.rowCache.get(id);
      if (!row) continue;
      result.push({
        productId:    row.id,
        productName:  row.name,
        barcode:      row.barcode,
        type:         row.type,
        defaultPrice: row.defaultPrice,
        price:        row.price,
      });
    }
    this.modalRef.close({ selected: result });
  }

  cancel(): void { this.modalRef.dismiss(); }

  /** Per-product-type chip palette — wraps the shared util so the
   *  template can call it via `[ngStyle]`. */
  getTypeBadgeStyle(type: string | undefined): Record<string, string> {
    return getProductTypeBadgeStyle(type);
  }

  trackRow = (_: number, r: ProductRow) => r.id;
}
