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
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
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
import { ModalService } from '@shared/modal/modal.service';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import {
  LogsDrawerComponent,
  LogsDrawerData,
} from '@shared/components/logs-drawer/logs-drawer.component';
import { ApiService } from '@core/http/api.service';
import {
  PickListModalComponent,
  PickListModalData,
  PickListModalResult,
  PickedListItem,
} from '@shared/components/pick-list-modal/pick-list-modal.component';
import { categoryLoader } from '@shared/components/pick-list-modal/pick-list.loaders';
import { PrepRecipePanelComponent } from '../../components/prep-recipe-panel/prep-recipe-panel.component';

const PARAMS = {
  page: { key: 'page', codec: IntCodec } as ParamDef<number>,
  limit: { key: 'limit', codec: intCodec(15) } as ParamDef<number>,
  search: { key: 'q', codec: StringCodec } as ParamDef<string>,
  category: { key: 'category', codec: StringCodec } as ParamDef<string>,
  /** Selected tags, joined with `|` (a tag can contain a comma, which the URL codec would split). */
  tags: { key: 'tags', codec: StringCodec } as ParamDef<string>,
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
    LoadingOverlayComponent,
    MycurrencyPipe,
    PrepRecipePanelComponent,
    DropdownMenuBtnComponent,
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
  private qp = inject(QueryParamsService);
  private modal = inject(ModalService);
  private api = inject(ApiService);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  products = signal<MenuItemProduct[]>([]);
  count = signal<number>(0);

  page = signal<number>(1);
  limit = signal<number>(15);
  search = signal<string>('');
  categoryId = signal<string>('');
  category = signal<PickedListItem | null>(null);
  /** Tags the menu items must carry (any of them). */
  tags = signal<string[]>([]);

  private i18nTick = signal(0);
  private searchDebounce = new Subject<void>();

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('PRODUCTS.PRODUCT_RECIPE.TITLE') },
    ];
  });

  /** Header "⋯" menu. */
  readonly moreMenuItems: DropdownMenuBtnItem[] = [
    { label: 'COMMON.LOGS.SHOW', click: () => this.openLogs() },
  ];

  /** Activity log for menu-item recipes — the legacy entity key is 'MenuRecipe'. */
  openLogs(): void {
    this.modal.open<LogsDrawerComponent, LogsDrawerData, void>(LogsDrawerComponent, {
      drawer: true,
      drawerWidth: '480px',
      drawerResizable: true,
      data: {
        sourceTable: 'MenuRecipe',
        title: this.translate.instant('PRODUCTS.PRODUCT_RECIPE.TITLE'),
      },
    });
  }

  /** Category filter — single-select picker (acts as a filter, applies on click). */
  async openCategoryPicker(): Promise<void> {
    const result = await this.openPicker({
      load: categoryLoader(this.api, this.translate),
      multiple: false,
      selectedIds: this.categoryId() ? [this.categoryId()] : [],
      title: this.translate.instant('PRODUCTS.PRODUCT_RECIPE.PICK_CATEGORY'),
      clearLabel: 'PRODUCTS.PRODUCT_RECIPE.ALL_CATEGORIES',
    });
    if (!result) return;
    this.applyCategory(result.selected[0] ?? null);
  }

  clearCategory(): void { this.applyCategory(null); }

  /** Tag filter - multi-select picker over the company's product tags. */
  async openTagPicker(): Promise<void> {
    const result = await this.openPicker({
      load: ({ page, limit, searchTerm }) => this.loadTags(page, limit, searchTerm),
      multiple: true,
      selectedIds: this.tags(),
      title: this.translate.instant('PRODUCTS.PRODUCT_RECIPE.PICK_TAGS'),
    });
    if (!result) return;
    this.tags.set(result.selected.map((s) => s.id));
    this.refilter();
  }

  clearTags(): void { this.tags.set([]); this.refilter(); }

  private async loadTags(page: number, limit: number, searchTerm: string) {
    const res = await this.api.request<any>(this.api.post('product/getProductTags', { page, limit, searchTerm }));
    const raw: any[] = res?.data?.list ?? res?.data ?? [];
    const list = raw.map((t) => String(t?.tag ?? t?.name ?? t)).filter(Boolean).map((tag) => ({ id: tag, name: tag }));
    // The endpoint's `count` is a per-tag usage count, so "more pages" is a full page.
    return { list, count: list.length >= limit ? page * limit + 1 : (page - 1) * limit + list.length };
  }

  private openPicker(data: PickListModalData): Promise<PickListModalResult | undefined> {
    // Dismissed (Cancel / backdrop) resolves undefined and leaves the filter
    // alone; an empty `selected` is an explicit "no filter" and does apply.
    return this.modal.open<PickListModalComponent, PickListModalData, PickListModalResult>(
      PickListModalComponent,
      { size: 'md', data },
    ).afterClosed();
  }

  private applyCategory(picked: PickedListItem | null): void {
    this.category.set(picked);
    this.categoryId.set(picked?.id ?? '');
    this.refilter();
  }

  private refilter(): void {
    this.page.set(1);
    this.syncUrl();
    void this.load();
  }

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
    this.tags.set(initial.tags ? initial.tags.split('|').filter(Boolean) : []);
    if (initial.category) {
      // Hydrate the category label from the id if possible (best-effort).
      const res = await this.categoryService.getList({ page: 1, limit: 50 });
      const match = res.list.find((c) => c.id === initial.category);
      if (match) this.category.set({ id: match.id, name: match.name });
    }
    await this.load();
  }

  private syncUrl(): void {
    this.qp.write(PARAMS, {
      page: this.page(),
      limit: this.limit(),
      search: this.search(),
      category: this.categoryId(),
      tags: this.tags().join('|'),
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const base = { searchTerm: this.search(), categoryId: this.categoryId() || undefined };
      if (!this.tags().length) {
        const res = await this.service.getMenuItemList({ page: this.page(), limit: this.limit(), ...base });
        this.products.set(res.list);
        this.count.set(res.count);
        return;
      }
      // The menu-item list can't filter by tag, so ask the product list which menu items carry the tags, take every
      // menu item for the search / category, keep the matching ones and page the result here.
      const [tagged, all] = await Promise.all([this.taggedMenuItemIds(), this.service.getMenuItemList({ page: 1, limit: 1000, ...base })]);
      const matching = all.list.filter((p) => tagged.has(p.id));
      const start = (this.page() - 1) * this.limit();
      this.products.set(matching.slice(start, start + this.limit()));
      this.count.set(matching.length);
    } finally {
      this.loading.set(false);
    }
  }

  /** Ids of the menu items that have at least one of the selected tags (`product/getProductList`, type + tags filter). */
  private async taggedMenuItemIds(): Promise<Set<string>> {
    const res = await this.api.request<any>(this.api.post('product/getProductList', {
      page: 1, limit: 1000, searchTerm: this.search(), sortBy: {},
      filter: { type: ['menuItem'], tags: this.tags(), categories: this.categoryId() ? [this.categoryId()] : [] },
    }));
    return new Set<string>((res?.data?.list ?? []).map((p: any) => String(p.id)));
  }

  // ── Filters / paging ───────────────────────────────────────────────────────
  onSearch(value: string): void { this.search.set(value); this.searchDebounce.next(); }
  clearSearch(): void { this.search.set(''); this.page.set(1); this.syncUrl(); void this.load(); }

  onPage(p: number): void { this.page.set(p); this.syncUrl(); void this.load(); }
  onPageSize(n: number): void { this.limit.set(n); this.page.set(1); this.syncUrl(); void this.load(); }

  // ── Row expansion ────────────────────────────────────────────────────────
  toggle(p: MenuItemProduct): void {
    this.products.update((list) => list.map((x) => (x.id === p.id ? { ...x, expanded: !x.expanded } : x)));
  }

  // ── Recipe lines ─────────────────────────────────────────────────────────
  // Editing lives in <app-prep-recipe-panel>; the page only mirrors the
  // panel's lines back into its row so the collapsed summary (tag list, item
  // count, cost) stays in step.

  lineCost(item: MenuRecipeItem): number { return (Number(item.usages) || 0) * (Number(item.unitCost) || 0); }

  productCost(p: MenuItemProduct): number {
    return p.recipes.reduce((sum, i) => sum + this.lineCost(i), 0);
  }

  onLinesChange(p: MenuItemProduct, lines: MenuRecipeItem[]): void {
    this.products.update((list) =>
      list.map((x) => (x.id === p.id ? { ...x, recipes: lines } : x)),
    );
  }

  trackProduct = (_: number, p: MenuItemProduct) => p.id;
  trackItem = (_: number, r: MenuRecipeItem) => r.inventoryId ?? r.recipeId ?? r.name;
}
