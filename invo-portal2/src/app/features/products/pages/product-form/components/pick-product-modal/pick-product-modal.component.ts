import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import { resolveLocalizedName } from '@shared/utils/localized-name';
import { PickerSelection } from '@shared/utils/picker-selection';

import { ProductsService } from '../../../../services/products.service';

export interface PickedProduct {
  id:        string;
  name:      string;
  barcode?:  string;
  sku?:      string;
  UOM?:      string;
  categoryName?: string;
  unitCost?: number;
  price?:    number;
  type?:     string;
  /** Thumbnail URL for the product-list row. Falls back to the placeholder SVG. */
  thumbnailUrl?: string;
  /** Raw category id + tags + translation blob — only populated for
   *  callers that need to write these fields back (e.g. Bulk Tags),
   *  since `updateBulkCategoryTagsTranslation` replaces all three
   *  columns wholesale and needs the untouched ones resent as-is. */
  categoryId?:  string | null;
  tags?:        string[];
  rawTranslation?: any;
}

export interface PickProductModalData {
  /** Optional product-type filter — e.g. ['inventory', 'serialized'] for raw
   *  ingredients in a recipe picker, or leave empty to show everything. */
  types?: string[];
  /** Ids already in the caller's list — pre-selected on open. The user can
   *  uncheck them to remove from the parent list, or leave them checked. */
  excludedIds?: string[];
  /** Allow multi-select? Default true. Kit/package pickers use multi;
   *  single-select pickers (e.g. parent-item) pass false. */
  multiple?: boolean;
  /** Modal title override. */
  title?: string;
}

export interface PickProductResult {
  /** Newly picked rows (not in `excludedIds` at open time). */
  added: PickedProduct[];
  /** Ids that were in `excludedIds` at open time and the user unchecked. */
  removed: string[];
}

/**
 * pick-product-modal
 * ──────────────────
 * Generic paginated product picker. Shared by kit-builder / recipe-builder /
 * package-builder / menu-selection to avoid duplicating three near-identical
 * modals. Configure via `MODAL_DATA` (types filter, excludedIds, multiple).
 *
 * Returns the selected rows as `PickedProduct[]` on close, `undefined` on
 * dismiss. Single-select variant still returns an array (0 or 1 item) for a
 * uniform caller shape.
 */
@Component({
  selector: 'app-pf-pick-product-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalHeaderComponent],
  templateUrl: './pick-product-modal.component.html',
  styleUrl: './pick-product-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickProductModalComponent implements OnInit, AfterViewInit, OnDestroy {
  private products = inject(ProductsService);
  private translate = inject(TranslateService);
  private modalRef = inject<ModalRef<PickProductResult>>(MODAL_REF);
  data             = inject<PickProductModalData>(MODAL_DATA) ?? {};

  search   = signal<string>('');
  loading  = signal<boolean>(false);
  page     = signal<number>(1);
  total    = signal<number>(0);
  hasMore  = signal<boolean>(false);
  rows     = signal<PickedProduct[]>([]);
  reviewOpen = signal<boolean>(false);
  selectAllError = signal<string>('');

  /** Every row this session has ever fetched, by id — populated by both
   *  normal paging and a "select all matching" run. Lookups only; a
   *  select-all run never appends its (possibly thousands of) rows into
   *  `rows`, which stays whatever the user has actually scrolled through. */
  private productCache = new Map<string, PickedProduct>();

  readonly picker = new PickerSelection<PickedProduct>({
    idOf: (r) => r.id,
    fetchPage: (page, limit) => this.fetchProductPage(page, limit),
    onItemsFetched: (items) => this.cacheItems(items),
  });

  /** Snapshot of `excludedIds` at open — used to compute `removed` on confirm. */
  private initialSelected: Set<string> = new Set();
  private debounce?: ReturnType<typeof setTimeout>;

  /** Sentinel observed by IntersectionObserver to trigger next-page load. */
  readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private scrollObserver?: IntersectionObserver;

  multiple = computed(() => this.data.multiple !== false);
  visible  = computed<PickedProduct[]>(() => this.rows());
  selectedCount = computed(() => this.picker.selectedCount());
  selectingAll  = computed(() => this.picker.selectingAll());
  allLoadedPicked = computed(() => this.picker.allLoadedPicked(this.rows()));
  reviewRows = computed<PickedProduct[]>(() =>
    this.picker.pickedIds.map((id) => this.productCache.get(id)).filter((r): r is PickedProduct => !!r),
  );

  ngOnInit(): void {
    const ids = this.data.excludedIds ?? [];
    this.initialSelected = new Set(ids);
    this.picker.seed(ids);
    this.loadPage(1);
  }

  ngAfterViewInit(): void {
    const el = this.scrollSentinel()?.nativeElement;
    if (!el) return;
    this.scrollObserver = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) this.loadMore();
    }, { root: el.closest('.ppm-list') as Element | null, rootMargin: '120px' });
    this.scrollObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.scrollObserver?.disconnect();
    clearTimeout(this.debounce);
  }

  onSearchInput(value: string): void {
    this.search.set(value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      // A new filter invalidates any in-flight "select all matching" run —
      // it was fetching ids for the OLD search term.
      this.picker.reset();
      this.loadPage(1);
    }, 300);
  }

  /** Maps one raw backend row into a `PickedProduct`. Shared by the normal
   *  page loader and the chunked "select all matching" fetch below so both
   *  paths cache an identically-shaped row. */
  private mapRow(r: any): PickedProduct {
    return {
      id:       r.id ?? r._id,
      name:     resolveLocalizedName(r, this.translate.currentLang),
      barcode:  r.barcode,
      sku:      r.sku,
      UOM:      r.UOM,
      categoryName: r.categoryName ?? r.category?.name ?? undefined,
      unitCost: r.unitCost ?? 0,
      price:    r.defaultPrice ?? 0,
      type:     r.type,
      // `r.image` is the canonical thumbnail the products-list page renders;
      // keep the mediaUrl/thumbnailUrl fallbacks for older response shapes.
      thumbnailUrl: r.mediaUrl?.thumbnailUrl ?? r.mediaUrl?.defaultUrl ?? r.thumbnailUrl ?? r.image ?? undefined,
      categoryId: r.categoryId ?? null,
      tags:       Array.isArray(r.tags) ? r.tags : [],
      rawTranslation: r.translation ?? null,
    };
  }

  private async fetchProductPage(page: number, limit: number): Promise<{ list: PickedProduct[]; count: number }> {
    const res = await this.products.getProductList({
      page,
      limit,
      searchTerm: this.search().trim(),
      sortBy: { sortValue: 'name', sortDirection: 'asc' },
      filter: { types: this.data.types ?? [] },
      // Without an explicit columns set the backend returns a reduced row
      // shape (no image/price). Request only the fields this picker maps
      // (PickedProduct) so thumbnails + prices come back without over-fetching.
      // `translation` is included so the row name can be localized —
      // omitting it from an explicit columns list makes the backend drop
      // the field entirely (it's not part of the reduced default set).
      columns: ['name', 'translation', 'image', 'barcode', 'SKU', 'UOM', 'unitCost', 'defaultPrice', 'type', 'category', 'categoryId', 'tags'],
    });
    return { list: (res.list ?? []).map((r: any) => this.mapRow(r)), count: res.count ?? 0 };
  }

  private cacheItems(items: PickedProduct[]): void {
    items.forEach((item) => this.productCache.set(item.id, item));
  }

  async loadPage(page: number): Promise<void> {
    this.loading.set(true);
    try {
      const { list, count } = await this.fetchProductPage(page, 20);
      this.cacheItems(list);
      if (page === 1) this.rows.set(list);
      else this.rows.update((prev) => [...prev, ...list]);
      this.total.set(count);
      this.hasMore.set(this.rows().length < count);
      this.page.set(page);
    } finally {
      this.loading.set(false);
    }
  }

  loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    this.loadPage(this.page() + 1);
  }

  toggle(id: string): void {
    if (this.multiple()) {
      this.picker.toggleId(id);
      return;
    }
    // Single-select → replace any existing pick.
    this.picker.clearSelection();
    this.picker.toggleId(id);
    this.confirm();
  }

  isSelected(id: string): boolean {
    return this.picker.isPickedId(id);
  }

  toggleLoaded(): void {
    this.picker.toggleLoaded(this.rows());
  }

  async selectAllMatching(): Promise<void> {
    this.selectAllError.set('');
    await this.picker.selectAllMatching(this.total(), () =>
      this.selectAllError.set(this.translate.instant('COMMON.LOAD_FAILED')),
    );
  }

  cancelSelectAll(): void {
    this.picker.cancelSelectAll();
  }

  unpick(id: string): void {
    this.picker.unpick(id);
  }

  clearSelection(): void {
    this.picker.clearSelection();
  }

  confirm(): void {
    const pickedIds = this.picker.pickedIds;
    const added = pickedIds
      .filter((id) => !this.initialSelected.has(id))
      .map((id) => this.productCache.get(id))
      .filter((r): r is PickedProduct => !!r);
    const removed = [...this.initialSelected].filter((id) => !this.picker.isPickedId(id));
    this.modalRef.close({ added, removed });
  }

  cancel(): void {
    this.modalRef.dismiss();
  }
}
