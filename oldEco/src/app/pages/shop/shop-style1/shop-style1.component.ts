import { Component, HostListener, Inject, Input, OnInit, OnChanges, SimpleChanges, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AppServices } from 'src/app/services/appServices';
import { AlertService } from 'src/app/services/alertService/alert.service';
import { BranchStatusAlertComponent } from 'src/app/components/branch-status-alert/branch-status-alert.component';
import { PaginationComponent } from 'src/app/components/pagination-component/pagination-component.component';
import { PriceFilterComponent } from 'src/app/components/price-filter/price-filter.component';
import { ProductGridComponent } from 'src/app/components/product/product-grid/product-grid.component';
import { ProductListComponent } from 'src/app/components/product/product-list/product-list.component';
import { BannerSectionComponent } from 'src/app/components/sections/banner-section/banner-section.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Category, SubCategory } from 'src/app/models/category.model';
import { Invoice } from 'src/app/models/invoice-model';
import { PageData } from 'src/app/models/page-data/pageData';
import { CartService } from 'src/app/services/cartServices/cart.service';
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';
import { ShopService } from 'src/app/services/shopServices/shop.service';
import { Brand } from 'src/app/models/brand.model';

@Component({
  selector: 'app-shop-style1',
  imports: [
    ProductGridComponent,
    ProductListComponent,
    FormsModule,
    PaginationComponent,
    PriceFilterComponent,
    TranslateModule,
    BannerSectionComponent,
    BranchStatusAlertComponent,
    RouterLink,
  ],
  templateUrl: './shop-style1.component.html',
  styleUrl: './shop-style1.component.css',
})
export class ShopStyle1Component implements OnInit, OnChanges, OnDestroy {
  private logger = inject(LoggerService);
  private destroy$ = new Subject<void>();

  // ── Inputs from ShopComponent ──
  @Input() pageSection: PageData | any = new PageData();
  @Input() invoiceData: Invoice | null = null;
  @Input() categories: Category[] = [];
  @Input() brands: Brand[] = [];
  @Input() productTags: any[] = [];
  @Input() loadingCategories = true;
  @Input() loadingTags = true;
  @Input() loadingBrands = true;

  // ── Product list state ──
  productsLayout: string = 'grid';
  loading: boolean = true;
  products: any[] = [];
  filteredProducts: any[] = [];
  productTagsSelected: any[] = [];
  productBrandsSelected: string[] = [];
  limit: number = 12;
  sortMap: any = { sortValue: null, sortDirection: null };
  filter: any = {};
  totalProducts: number = 0;
  pageCount: number = 0;
  startIndex: number = 0;
  lastIndex: number = 0;
  clean: boolean = false;
  currentPage: number = 1;
  pageProduct: string = '';
  items: number[] = Array.from({ length: 12 }, (_, i) => i + 1);

  // ── Filter UI state ──
  selectedDepartment?: string;
  selectedCategory?: string;
  minPrice = 0;
  maxPrice = 1000;
  showFilterCategories = true;
  showFilterTags = true;
  showFilterBrands = true;
  expandedCategoryIds: Set<string> = new Set();
  isAllActive: boolean = true;
  departmentName?: string;
  subCategoryName?: string;

  isBrowser: boolean;

  constructor(
    private shopService: ShopService,
    protected cartService: CartService,
    public appService: AppServices,
    protected pageBuilderServices: PageBuilderService,
    private alertService: AlertService,
    @Inject(PLATFORM_ID) private platformId: any,
    protected router: Router,
    protected route: ActivatedRoute
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  // ── Lifecycle ──

  ngOnInit(): void {
    this.pageProduct = 'shop';
    this.applyPageSettings();
    this.subscribeToRouteParams();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When the parent reloads after a service change, invoiceData arrives with a
    // new branchId. Re-load products so the correct branch stock is shown.
    if (changes['invoiceData'] && !changes['invoiceData'].firstChange) {
      this.loadShopProducts(this.selectedDepartment, this.selectedCategory);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.hideMobileFilter();
  }

  // ── Initialisation ──

  private applyPageSettings(): void {
    if (!this.pageSection?.template?.settings) return;
    const settings = this.pageSection.template.settings;
    this.limit = parseInt(settings.page_limit ?? '12');
    this.productsLayout = settings.default_view ?? 'grid';
    this.applySortSetting(settings.sort_By);
  }

  private applySortSetting(sortBy?: string): void {
    if (!sortBy || sortBy === 'default') {
      this.sortMap = { sortValue: null, sortDirection: null };
    } else if (sortBy.includes('price') && sortBy.includes('asc')) {
      this.sortMap = { sortValue: 'defaultPrice', sortDirection: 'ASC' };
    } else if (sortBy.includes('price') && sortBy.includes('desc')) {
      this.sortMap = { sortValue: 'defaultPrice', sortDirection: 'DESC' };
    } else if (sortBy.includes('name') && sortBy.includes('asc')) {
      this.sortMap = { sortValue: 'name', sortDirection: 'ASC' };
    } else if (sortBy.includes('name') && sortBy.includes('desc')) {
      this.sortMap = { sortValue: 'name', sortDirection: 'DESC' };
    }
    this.setSelectedOption(this.sortMap);
  }

  private subscribeToRouteParams(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.selectedDepartment = params['departmentId'] ?? undefined;
      this.selectedCategory = params['categoryId'] ?? undefined;
      this.productTagsSelected = params['tags'] ? params['tags'].split(',') : [];
      this.productBrandsSelected = params['brands'] ? params['brands'].split(',') : [];
      this.filter = { max: params['max_price'], min: params['min_price'] };
      this.maxPrice = this.filter.max ?? this.maxPrice;
      this.minPrice = this.filter.min ?? this.minPrice;
      this.currentPage = params['page'] ?? 1;
      this.loadShopProducts(this.selectedDepartment, this.selectedCategory);
    });
  }

  // ── Product loading ──

  loadShopProducts(departmentId?: string, categoryId?: string, page: number = 1, searchTerm?: string): void {
    this.loading = true;
    const branchId = this.invoiceData?.branchId;

    this.shopService.getCategoriesProducts({
      branchId,
      limit: this.limit,
      categoryId: categoryId || '',
      departmentId: departmentId || '',
      tags: this.productTagsSelected,
      brands: this.productBrandsSelected,
      sort: this.sortMap,
      priceFilter: this.filter,
      page: this.currentPage,
      searchTerm,
      sessionId: this.invoiceData?.onlineData?.sessionId,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: any) => this.handleProductResponse(data, branchId),
      error: (err: any) => this.handleError(err),
    });

    this.selectedCategory = categoryId;
    this.selectedDepartment = departmentId;
  }

  private handleProductResponse(data: any[], branchId?: string): void {
    if (!data?.length) return;

    this.pageCount = data[2];
    const products: any[] = data[0] ?? [];

    products.forEach((element) => {
      element.edited = true;
      const isStockable = !['menuItem', 'service', 'menuSelection', 'tailoring'].includes(element.type);

      if (isStockable) {
        element.quantity = branchId || element.quantity === 'undefined'
          ? (element.branches?.[0]?.onHand ?? 0)
          : (element.branches ? Math.max(...element.branches.map((b: any) => b.onHand)) : 0);
      } else {
        element.quantity = null;
      }

      element.price = branchId
        ? (element.price || element.branches?.[0]?.price || element.defaultPrice || 0)
        : (element.price || element.defaultPrice || 0);
    });

    this.products = products;
    this.filteredProducts = products;
    this.totalProducts = data[1];
    this.startIndex = data[3];
    this.lastIndex = data[4];
    this.loading = false;
  }

  private handleError(err: any): void {
    this.logger.error(err?.message, { stack: err?.stack, context: 'ShopStyle1Component' });
    this.loading = false;
  }

  // ── Routing helpers ──

  private updateRouteQueries(departmentId?: string, categoryId?: string, brands?: string[], page?: number): void {
    const tags = this.productTagsSelected.length ? this.productTagsSelected.join(',') : null;
    const allBrands = brands?.length ? brands.join(',') : null;
    const sort = this.sortMap.sortValue && this.sortMap.sortDirection
      ? `${this.sortMap.sortValue}_${this.sortMap.sortDirection}`
      : null;

    this.router.navigate(['/shop'], {
      queryParams: {
        departmentId,
        categoryId,
        tags,
        max_price: this.filter?.max ?? null,
        min_price: this.filter?.min ?? null,
        brands: allBrands,
        page: page ?? this.currentPage,
      },
    });
  }

  // ── Sort / count / layout ──

  setSelectedOption(value: any): void {
    const select = document.getElementById('sortProducts');
    if (!select) return;
    select.querySelectorAll('option').forEach((option) => {
      try {
        const parsed = JSON.parse(option.value.replace(/(\w+):/g, '"$1":').replace(/'([^']+)'/g, '"$1"'));
        option.selected = parsed.sortValue === value.sortValue && parsed.sortDirection === value.sortDirection;
      } catch {
        option.selected = false;
      }
    });
  }

  onSortChange(event: any, departmentId?: string, categoryId?: string): void {
    const raw = event.target.value.replace(/(\w+):/g, '"$1":').replace(/'([^']+)'/g, '"$1"');
    this.sortMap = JSON.parse(raw);
    this.currentPage = 1;
    this.loading = true;
    this.loadShopProducts(departmentId, categoryId);
  }

  onCountChange(event: any, departmentId?: string, categoryId?: string, brands?: string[]): void {
    this.limit = parseInt(event.target.value);
    this.loading = true;
    setTimeout(() => this.updateRouteQueries(departmentId, categoryId, brands), 250);
  }

  changeProductsLayout(value: string, departmentId?: string, categoryId?: string, brands?: string[]): void {
    this.productsLayout = value;
    this.updateRouteQueries(departmentId, categoryId, brands);
  }

  // ── Filters ──

  loadProductsPerTags(tag: string, departmentId?: string, categoryId?: string, brands?: string[]): void {
    this.loading = true;
    setTimeout(() => {
      this.toggleSelectedItem(this.productTagsSelected, tag);
      this.updateRouteQueries(departmentId, categoryId, brands);
      setTimeout(() => { this.loading = false; }, 250);
    }, 250);
  }

  loadProductsPerBrands(id: string): void {
    this.loading = true;
    setTimeout(() => {
      this.toggleSelectedItem(this.productBrandsSelected, id);
      this.updateRouteQueries(this.selectedDepartment, this.selectedCategory, this.productBrandsSelected, 1);
    }, 250);
  }

  filterByPrice(min: number, max: number, departmentId?: string, categoryId?: string, brands?: string[]): void {
    if (min < 0 || max < 0) return;
    this.filter = min === 0 && max === 0 ? null : { min, max };
    this.loading = true;
    setTimeout(() => {
      this.updateRouteQueries(departmentId, categoryId, brands);
      this.loading = false;
    }, 250);
  }

  cleanFilters(): void {
    this.productTagsSelected = [];
    this.sortMap = { sortValue: null, sortDirection: null };
    this.filter = null;
    this.clean = true;
    this.currentPage = 1;
    if (this.isBrowser) {
      const el = document.getElementById('default') as HTMLOptionElement;
      if (el) el.selected = true;
    }
    this.updateRouteQueries();
  }

  onPageChange(page: number, departmentId?: string, categoryId?: string): void {
    this.clean = false;
    this.loading = true;
    this.loadShopProducts(departmentId, categoryId, page);
    window.scrollTo({ top: 0 });
  }

  // ── Category navigation ──

  toggleCategory(category?: Category): void {
    this.loading = true;
    setTimeout(() => {
      if (!category) {
        this.expandedCategoryIds.clear();
        this.isAllActive = true;
        this.selectedDepartment = undefined;
        this.selectedCategory = undefined;
        this.departmentName = undefined;
        this.subCategoryName = undefined;
        this.updateRouteQueries(undefined, undefined, this.productBrandsSelected, 1);
        this.loading = false;
        return;
      }

      if (this.isCategoryExpanded(category)) {
        this.expandedCategoryIds.delete(category.id);
        this.selectedDepartment = undefined;
        this.selectedCategory = undefined;
        this.departmentName = undefined;
        this.subCategoryName = undefined;
      } else {
        this.expandedCategoryIds.clear();
        this.expandedCategoryIds.add(category.id);
        this.selectedDepartment = category.id;
        this.departmentName = category.name;
        this.selectedCategory = undefined;
        this.subCategoryName = undefined;
      }

      this.isAllActive = false;
      this.categories.forEach((cat) => (cat.isOpen = cat.id === category.id ? !cat.isOpen : false));
      this.updateRouteQueries(this.selectedDepartment, this.selectedCategory, this.productBrandsSelected, 1);
    });
  }

  toggleSubCategories(department?: Category, category?: SubCategory, isDepartment?: boolean): void {
    if (department) { this.selectedDepartment = department.id; this.departmentName = department.name; }
    if (category) { this.selectedCategory = category.id; this.subCategoryName = category.name; }
    if (isDepartment) { this.selectedCategory = undefined; this.subCategoryName = undefined; }

    this.loading = true;
    setTimeout(() => {
      this.updateRouteQueries(this.selectedDepartment, this.selectedCategory, this.productBrandsSelected, 1);
    }, 250);
  }

  isCategoryExpanded(category: Category): boolean {
    return this.expandedCategoryIds.has(category.id);
  }

  // ── Mobile filter ──

  showMobileFilter(): void {
    if (this.isBrowser) document.body.classList.add('sidebar-active');
  }

  hideMobileFilter(): void {
    if (this.isBrowser) document.body.classList.remove('sidebar-active');
  }

  // ── Active filter badge count (shown on the mobile "Filter" button) ──

  get activeFilterCount(): number {
    let count = 0;
    if (this.productTagsSelected?.length) count += this.productTagsSelected.length;
    if (this.productBrandsSelected?.length) count += this.productBrandsSelected.length;
    if (this.filter?.min != null || this.filter?.max != null) count++;
    return count;
  }

  isMobile(): boolean {
    return this.isBrowser ? window.innerWidth < 991 : false;
  }

  // ── Utilities ──

  private toggleSelectedItem(array: string[], item: string): void {
    const index = array.indexOf(item);
    if (index > -1) array.splice(index, 1);
    else array.push(item);
  }

  getHeaderBackground(subheader_settings: any): string {
    if (!subheader_settings) return 'gray';
    if (subheader_settings.style === 'Color' && subheader_settings.defaultColor) return subheader_settings.defaultColor;
    if (subheader_settings.style === 'Pattern' && subheader_settings.defaultPattern)
      return `url(assets/images/page-builder/patterns/${subheader_settings.defaultPattern}.png)`;
    if (subheader_settings.style === 'Image' && subheader_settings.defaultImage?.defaultUrl)
      return `url(${subheader_settings.defaultImage.defaultUrl})`;
    return 'gray';
  }
}