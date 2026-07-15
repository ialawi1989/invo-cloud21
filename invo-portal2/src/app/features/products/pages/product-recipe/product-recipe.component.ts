import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DropdownLoadFn } from '@shared/components/dropdown/search-dropdown.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';
import {
  QueryParamsService,
  ParamDef,
  StringCodec,
  IntCodec,
  intCodec,
} from '@shared/services/query-params.service';

import {
  ProductRecipeService,
  MenuItemProduct,
  MenuRecipeItem,
} from '../../services/product-recipe.service';
import { CategoryService } from '../../services/category.service';
import {
  PickProductModalComponent,
  PickProductModalData,
  PickProductResult,
  PickedProduct,
} from '../product-form/components/pick-product-modal/pick-product-modal.component';

interface CatItem { label: string; value: string; }

const PARAMS = {
  page: { key: 'page', codec: IntCodec } as ParamDef<number>,
  limit: { key: 'limit', codec: intCodec(15) } as ParamDef<number>,
  search: { key: 'q', codec: StringCodec } as ParamDef<string>,
  category: { key: 'category', codec: StringCodec } as ParamDef<string>,
};

/**
 * Product Recipe — a quick, in-place recipe editor for menu-item products.
 * Lists menu items (search + category filter + pagination); each row expands
 * to reveal its recipe lines with editable usage, per-line save / delete, and
 * an "add ingredient" picker. Ported from the legacy `product-recipe`.
 */
@Component({
  selector: 'app-product-recipe',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    PaginationComponent,
    SearchDropdownComponent,
    LoadingOverlayComponent,
    MycurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-recipe.component.html',
  styleUrl: './product-recipe.component.scss',
})
export class ProductRecipeComponent implements OnInit {
  private service = inject(ProductRecipeService);
  private categoryService = inject(CategoryService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private qp = inject(QueryParamsService);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  products = signal<MenuItemProduct[]>([]);
  count = signal<number>(0);

  page = signal<number>(1);
  limit = signal<number>(15);
  search = signal<string>('');
  categoryId = signal<string>('');
  category = signal<CatItem | null>(null);

  private i18nTick = signal(0);
  private searchDebounce = new Subject<void>();

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('PRODUCTS.PRODUCT_RECIPE.TITLE') },
    ];
  });

  categoryLoad: DropdownLoadFn<CatItem> = async ({ page, pageSize, search }) => {
    const res = await this.categoryService.getList({ page, limit: pageSize, searchTerm: search });
    return {
      items: res.list.map((c) => ({ label: c.name, value: c.id })),
      hasMore: page * pageSize < res.count,
    };
  };
  displayCat = (c: CatItem) => c?.label ?? '';
  compareCat = (a: CatItem, b: CatItem) => a?.value === b?.value;

  constructor() {
    withTranslations('products');
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.searchDebounce
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.syncUrl();
        void this.load();
      });
  }

  async ngOnInit(): Promise<void> {
    const initial = this.qp.read(PARAMS);
    this.page.set(initial.page);
    this.limit.set(initial.limit);
    this.search.set(initial.search);
    this.categoryId.set(initial.category);
    if (initial.category) {
      // Hydrate the category label from the id if possible (best-effort).
      const res = await this.categoryService.getList({ page: 1, limit: 50 });
      const match = res.list.find((c) => c.id === initial.category);
      if (match) this.category.set({ label: match.name, value: match.id });
    }
    await this.load();
  }

  private syncUrl(): void {
    this.qp.write(PARAMS, {
      page: this.page(),
      limit: this.limit(),
      search: this.search(),
      category: this.categoryId(),
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.service.getMenuItemList({
        page: this.page(),
        limit: this.limit(),
        searchTerm: this.search(),
        categoryId: this.categoryId() || undefined,
      });
      this.products.set(res.list);
      this.count.set(res.count);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Filters / paging ───────────────────────────────────────────────────────
  onSearch(value: string): void { this.search.set(value); this.searchDebounce.next(); }
  clearSearch(): void { this.search.set(''); this.page.set(1); this.syncUrl(); void this.load(); }

  onCategory(c: CatItem | CatItem[] | null): void {
    const picked = Array.isArray(c) ? c[0] : c;
    this.category.set(picked ?? null);
    this.categoryId.set(picked?.value ?? '');
    this.page.set(1);
    this.syncUrl();
    void this.load();
  }

  onPage(p: number): void { this.page.set(p); this.syncUrl(); void this.load(); }
  onPageSize(n: number): void { this.limit.set(n); this.page.set(1); this.syncUrl(); void this.load(); }

  // ── Row expansion ────────────────────────────────────────────────────────
  toggle(p: MenuItemProduct): void {
    this.products.update((list) => list.map((x) => (x.id === p.id ? { ...x, expanded: !x.expanded } : x)));
  }

  // ── Recipe-line editing ──────────────────────────────────────────────────
  private itemKey(item: MenuRecipeItem): string { return item.inventoryId ?? item.recipeId ?? ''; }

  isModified(item: MenuRecipeItem): boolean {
    return item.isNew || Number(item.usages) !== Number(item.originalUsages ?? 0);
  }

  lineCost(item: MenuRecipeItem): number { return (Number(item.usages) || 0) * (Number(item.unitCost) || 0); }

  productCost(p: MenuItemProduct): number {
    return p.recipes.reduce((sum, i) => sum + this.lineCost(i), 0);
  }

  setUsage(p: MenuItemProduct, item: MenuRecipeItem, value: string): void {
    const usages = Number(value);
    const key = this.itemKey(item);
    this.products.update((list) =>
      list.map((x) =>
        x.id !== p.id ? x : {
          ...x,
          recipes: x.recipes.map((r) => (this.itemKey(r) === key ? { ...r, usages: isNaN(usages) ? 0 : usages } : r)),
        },
      ),
    );
  }

  revert(p: MenuItemProduct, item: MenuRecipeItem): void {
    const key = this.itemKey(item);
    this.products.update((list) =>
      list.map((x) =>
        x.id !== p.id ? x : {
          ...x,
          recipes: x.recipes.map((r) => (this.itemKey(r) === key ? { ...r, usages: r.originalUsages ?? 0 } : r)),
        },
      ),
    );
  }

  async saveLine(p: MenuItemProduct, item: MenuRecipeItem): Promise<void> {
    if (Number(item.usages) <= 0) return;
    this.saving.set(true);
    try {
      const res = await this.service.saveRecipeItem(p.id, item);
      if (res.success) {
        const key = this.itemKey(item);
        this.products.update((list) =>
          list.map((x) =>
            x.id !== p.id ? x : {
              ...x,
              recipes: x.recipes.map((r) =>
                this.itemKey(r) === key ? { ...r, originalUsages: r.usages, isNew: false } : r,
              ),
            },
          ),
        );
        this.toast.success('COMMON.SAVED_OK');
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  async removeLine(p: MenuItemProduct, item: MenuRecipeItem): Promise<void> {
    const key = this.itemKey(item);
    // New (unsaved) rows just drop out locally.
    if (item.isNew) {
      this.dropLine(p.id, key);
      return;
    }
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title: this.translate.instant('COMMON.DELETE'),
          message: this.translate.instant('PRODUCTS.PRODUCT_RECIPE.CONFIRM_DELETE', { name: item.name }),
          confirm: this.translate.instant('COMMON.DELETE'),
          danger: true,
        },
      },
    );
    if (!(await ref.afterClosed())) return;
    this.saving.set(true);
    try {
      const res = await this.service.deleteRecipeItem(p.id, key);
      if (res.success) {
        this.dropLine(p.id, key);
        this.toast.success('COMMON.DELETED_OK');
      } else {
        this.toast.error('COMMON.DELETE_FAILED');
      }
    } finally {
      this.saving.set(false);
    }
  }

  private dropLine(productId: string, key: string): void {
    this.products.update((list) =>
      list.map((x) =>
        x.id !== productId ? x : { ...x, recipes: x.recipes.filter((r) => this.itemKey(r) !== key) },
      ),
    );
  }

  async addItems(p: MenuItemProduct): Promise<void> {
    const existing = p.recipes.map((r) => this.itemKey(r)).filter(Boolean);
    const ref = this.modal.open<PickProductModalComponent, PickProductModalData, PickProductResult>(
      PickProductModalComponent,
      {
        size: 'lg',
        data: {
          excludedIds: existing,
          multiple: true,
          title: this.translate.instant('PRODUCTS.PRODUCT_RECIPE.ADD_ITEM'),
        },
        closeOnBackdrop: false,
      },
    );
    const result = await ref.afterClosed();
    if (!result?.added?.length) return;
    const seen = new Set(existing.map(String));
    const fresh: MenuRecipeItem[] = result.added
      .filter((pr) => !seen.has(String(pr.id)))
      .map((pr) => this.toRecipeItem(pr));
    if (!fresh.length) return;
    this.products.update((list) =>
      list.map((x) => (x.id === p.id ? { ...x, recipes: [...x.recipes, ...fresh] } : x)),
    );
  }

  private toRecipeItem(pr: PickedProduct): MenuRecipeItem {
    const isRecipe = pr.type === 'Recipe';
    return {
      inventoryId: isRecipe ? undefined : String(pr.id),
      recipeId: isRecipe ? String(pr.id) : undefined,
      name: pr.name ?? '',
      UOM: pr.UOM ?? '',
      unitCost: Number(pr.unitCost) || 0,
      usages: 1,
      type: pr.type ?? '',
      originalUsages: 0,
      isNew: true,
    };
  }

  trackProduct = (_: number, p: MenuItemProduct) => p.id;
  trackItem = (_: number, r: MenuRecipeItem) => r.inventoryId ?? r.recipeId ?? r.name;
}
