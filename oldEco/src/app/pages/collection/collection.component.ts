import { Component, ElementRef, HostListener, Inject, OnInit, OnDestroy, PLATFORM_ID, ViewChild, inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { ActivatedRoute, Router, NavigationEnd, RouterLink } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CartService } from '../../services/cartServices/cart.service';
import { ProductListComponent } from "../../components/product/product-list/product-list.component";
import { PriceFilterComponent } from "../../components/price-filter/price-filter.component";
import { ProductGridComponent } from "../../components/product/product-grid/product-grid.component";
import { ThemeService } from '../../services/themeServices/theme.service';
import { Product } from '../../models/product.model';
import { PageBuilderService } from '../../services/pageBuilderServices/page-builder.service';
import { BannerSectionComponent } from "../../components/sections/banner-section/banner-section.component";
import { TranslateModule } from '@ngx-translate/core';
import { combineLatest } from 'rxjs';
import { ScrollPositionService } from 'src/app/services/scrollPositionService/scrollPositionService';
import { BranchStatusAlertComponent } from "../../components/branch-status-alert/branch-status-alert.component";
import { isPlatformBrowser } from '@angular/common';
import { Invoice } from 'src/app/models/invoice-model';
import { PageData } from '../../models/page-data/pageData';

@Component({
  selector: 'app-collection',
  imports: [
    ProductListComponent,
    PriceFilterComponent,
    ProductGridComponent,
    BannerSectionComponent,
    TranslateModule,
    BranchStatusAlertComponent,
    RouterLink
  ],
  templateUrl: './collection.component.html',
  styleUrl: './collection.component.css'
})
export class CollectionComponent implements OnInit, OnDestroy {
  private logger = inject(LoggerService);

  // ── Properties from BaseProductsLayoutComponent ──
  productsLayout: string = 'grid';
  isPcFilterShown = true;
  isMobileFilterShown = false;
  loading: boolean = true;
  products: any[] = [];
  productTags: any[] = [];
  productTagsSelected: string[] = [];
  limit: number = 12;
  sortMap: any = { sortValue: null, sortDirection: null };
  filter: any = {};

  totalProducts: number = 0;
  pageCount: number = 0;
  startIndex: number = 0;
  lastIndex: number = 0;

  clean: boolean = false;

  invoiceData: any;

  filteredProducts: any[] = [];
  pageProduct: string = '';

  isBrowser: boolean;
  currentPage: number = 1;
  pageSection: PageData | any = new PageData();

  items: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  menuStyle: string = 'grid';

  // ── CollectionComponent own properties ──
  minPrice = 0;
  maxPrice = 1000;
  slug: string = "";
  selectedDepartment?: string;
  selectedCategory?: string;
  productBrandsSelected: string[] = [];
  collectionProducts: Product[] = [];
  scroll: boolean = false;
  offsetTop: number = 0;
  observer!: IntersectionObserver;

  // ── FIX: destroy subject to prevent memory leaks ──
  private destroy$ = new Subject<void>();

  @ViewChild('scrollAnchor', { static: false }) scrollAnchor!: ElementRef;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    protected cartService: CartService,
    protected router: Router,
    protected route: ActivatedRoute,
    protected pageBuilderServices: PageBuilderService,
    private themeService: ThemeService,
    private scrollService: ScrollPositionService,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  // ── Lifecycle ──

  ngOnInit(): void {
    this.cartService.invoiceDataSub$
    .pipe(takeUntil(this.destroy$))
    .pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: Invoice | null) => {
        if (invoiceData) {
          this.invoiceData = invoiceData;
        }
      },
    });

    this.pageProduct = this.router.url.split('/')[1];
    this.getPage();
  }

  // ── FIX: unsubscribe all subscriptions on destroy ──
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    this.hideMobileFilter();
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.scroll = true;
  }

  ngAfterViewInit() {
    this.router.events
      .pipe(
        filter((e: any) => e instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        const savedY = this.scrollService.get(this.router.url);
        if (savedY != null) {
          const interval = setInterval(() => {
            const el = document.querySelector('.product-list');
            if (el) {
              window.scrollTo({ top: savedY });
              clearInterval(interval);
            }
          }, 50);
        }
      });
    this.delayedSetup();
  }

  ngAfterViewChecked() {
    if (this.observer && this.scrollAnchor?.nativeElement && !this.loading) {
      this.observer.observe(this.scrollAnchor.nativeElement);
    }
  }

  // ── Methods from BaseProductsLayoutComponent ──

  deepEqual(obj1: any, obj2: any) {
    return obj1.sortValue === obj2.sortValue && obj1.sortDirection === obj2.sortDirection;
  }

  setSelectedOption(value: any) {
    const select = document.getElementById("sortProducts");
    if (!select) {
      return;
    }
    const options = select!.querySelectorAll("option");

    options.forEach(option => {
      const selectedValue = option.value;
      const sortMapStr = selectedValue
        .replace(/(\w+):/g, '"$1":')
        .replace(/'([^']+)'/g, '"$1"');
      const currentOpt = JSON.parse(sortMapStr);
      if (this.deepEqual(currentOpt, value)) {
        option.selected = true;
      } else {
        option.selected = false;
      }
    });
  }

  async getPage() {
    let data = await this.pageBuilderServices.getPage(this.pageProduct);

    if (data == null) {
      data = new PageData();
    }

    if (data) {
      let templateData: any = data?.template?.settings || {};
      this.limit = parseInt(templateData.page_limit ?? '12');
      this.pageSection = data;

      if (this.isBrowser) {
        this.menuStyle = templateData.default_view ?? 'grid';
      }
      this.productsLayout = 'grid';

      if (templateData.sort_By == 'default') {
        this.setSelectedOption("{sortValue: null, sortDirection: null}");
        this.sortMap = JSON.parse('{"sortValue": null, "sortDirection": null}');
      } else if (templateData.sort_By?.includes('price') && templateData.sort_By?.includes('asc')) {
        this.setSelectedOption(JSON.parse('{"sortValue": "defaultPrice", "sortDirection": "ASC"}'));
        this.sortMap = JSON.parse('{"sortValue": "defaultPrice", "sortDirection": "ASC"}');
      } else if (templateData.sort_By?.includes('price') && templateData.sort_By?.includes('desc')) {
        this.setSelectedOption("{sortValue:  'defaultPrice', sortDirection: 'DESC'}");
        this.sortMap = JSON.parse('{"sortValue": "defaultPrice", "sortDirection": "DESC"}');
      } else if (templateData.sort_By?.includes('name') && templateData.sort_By?.includes('asc')) {
        this.setSelectedOption("{sortValue:  'name', sortDirection: 'ASC'}");
        this.sortMap = JSON.parse('{"sortValue": "name", "sortDirection": "ASC"}');
      } else if (templateData.sort_By?.includes('name') && templateData.sort_By?.includes('desc')) {
        this.setSelectedOption("{sortValue:  'name', sortDirection: 'DESC'}");
        this.sortMap = JSON.parse('{"sortValue": "name", "sortDirection": "DESC"}');
      }

      this.loadInitialData(this.invoiceData.branchId);
    }
  }

  protected handleResponse(data: any[]): void {
    this.products = data[0];
    this.totalProducts = data[1];
    this.pageCount = data[2];
    this.startIndex = data[3];
    this.lastIndex = data[4];

    this.loading = false;
    this.filteredProducts = this.products;
  }

  handleError(err: any) {
    this.logger.error(err?.message, { stack: err?.stack, context: 'CollectionComponent.loadCollectionProducts' });
    this.loading = false;
  }

  toggleSelectedItem(array: string[], item: string): void {
    const index = array.indexOf(item);
    if (index > -1) {
      array.splice(index, 1);
    } else {
      array.push(item);
    }
  }

  showMobileFilter() {
    if (this.isBrowser) {
      document.body.classList.add('sidebar-active');
    }
  }

  hideMobileFilter() {
    if (this.isBrowser) {
      document.body.classList.remove('sidebar-active');
    }
  }

  showHidePcFilter() {
    if (this.isBrowser) {
      const element1 = document.querySelector('.shop-sidebar');
      const element2 = document.querySelector('.product-wrapper');
      if (element1 && element2) {
        if (element1.classList.contains('closed')) {
          element1.classList.remove('closed');
          element2.classList.remove('cols-lg-5');
          element2.classList.add('cols-lg-4');
        } else {
          element1.classList.add('closed');
          element2.classList.remove('cols-lg-4');
          element2.classList.add('cols-lg-5');
        }
      }
    }
  }

  changeProductsLayout(value: string): void {
    this.productsLayout = value;
  }

  // ── CollectionComponent own methods ──

  loadInitialData(branchId: string): void {
    combineLatest([
      this.route.paramMap,
      this.route.queryParams
    ])
      // FIX: unsubscribe when component is destroyed to prevent memory leaks
      .pipe(takeUntil(this.destroy$))
      .subscribe(([params, queryParams]) => {
        this.slug = params.get('id') ?? '';
        this.loading = true;

        this.filter = {
          max: queryParams['max_price'],
          min: queryParams['min_price']
        };

        this.maxPrice = this.filter.max ?? this.maxPrice;
        this.minPrice = this.filter.min ?? this.minPrice;
        this.limit = queryParams['limit'] ?? this.limit;
        this.sortMap = queryParams['sort'] ?? this.sortMap;

        // FIX: load products here — this is the single source of truth.
        // Previously loadCollectionProducts() was also called directly inside
        // updateRouteUrl(), which caused a double API call every time a filter
        // changed (once directly, once again via this subscription after navigation).
        this.loadCollectionProducts();
      });
  }

  isMobile(): boolean {
    if (this.isBrowser) return window.innerWidth < 991;
    return false;
  }

  delayedSetup() {
    setTimeout(() => {
      try {
        this.setupObserver();
        if (this.scrollAnchor?.nativeElement) {
          this.observer?.observe(this.scrollAnchor.nativeElement);
        }
      } catch (error) {
      }
    }, 100);
  }

  setupObserver() {
    if (this.isBrowser && typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(
        (entries) => {
          if (this.currentPage <= this.pageCount && this.scroll) {
            this.loadCollectionProducts(this.currentPage);
          }
        },
        { rootMargin: '100px', threshold: 0.1 }
      );
    } else {
      console.warn('IntersectionObserver is not available in this environment.');
    }
  }

  private productCache: Map<string, any> = new Map();

  loadCollectionProducts(page: number = 1, searchTerm?: string): void {
    if (searchTerm == '') {
      this.currentPage = 1;
    }

    const cacheKey = `${this.slug || ''}-${page}-${searchTerm || ''}-${this.filter.min}-${this.filter.max}-${this.sortMap}-${this.limit}`;

    if (this.productCache.has(cacheKey)) {
      const cachedData = this.productCache.get(cacheKey);
      this.handleResponse(cachedData);
      return;
    }

    let branchId = this.invoiceData.branchId;
    this.themeService.getCollectionProductList({
      sessionId: this.invoiceData.onlineData.sessionId,
      slug: this.slug,
      branchId: branchId,
      page: page,
      limit: this.limit,
      sort: this.sortMap,
      filter: this.filter,
      searchTerm: searchTerm
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        if (data[0] && data[0].length > 0) {
          data[0].forEach((element: any) => {
            element.edited = true;
            if (element.type == "menuItem" || element.type == "service" || element.type == "menuSelection" || element.type == "tailoring") {
              element.quantity = null;
            } else {
              if (branchId || element.quantity === 'undefined') {
                element.quantity = 0;
                if (element.branches) {
                  element.quantity = element.branches[0]?.onHand || 0;
                }
              } else {
                if (element.branches) {
                  element.quantity = Math.max(...element.branches.map((branch: any) => branch.onHand)) || 0;
                }
              }
            }
            let tempPrice = 0;
            if (branchId) {
              if (element.branches) {
                tempPrice = element.price ? element.price : element.branches[0]?.price ? element.branches[0]?.price : element.defaultPrice || 0;
              } else {
                tempPrice = element.price ? element.price : element.defaultPrice;
              }
            } else {
              tempPrice = element.price ? element.price : element.defaultPrice;
            }
            element.price = tempPrice;
          });
        }

        if (this.scroll && this.currentPage != 1) {
          data[0] = [...this.products, ...data[0]];
        }

        this.scroll = false;
        this.currentPage++;
        this.loading = false;
        this.productCache.set(cacheKey, data);
        this.handleResponse(data);
      },
      error: this.handleError.bind(this),
    });
  }

  filterPrice(min: number, max: number): void {
    if (min < 0 || max < 0) return;
    this.minPrice = min;
    this.maxPrice = max;
    this.filter = min === 0 && max === 0 ? null : { min: this.minPrice, max: this.maxPrice };
    this.loading = true;
    setTimeout(() => {
      this.updateRouteUrl();
    }, 250);
  }

  // FIX: removed the direct loadCollectionProducts() call from here.
  // Previously this method called loadCollectionProducts() directly AND THEN
  // called router.navigate(), which triggered the combineLatest subscription
  // in loadInitialData() to also call loadCollectionProducts() — resulting in
  // two API calls on every filter change. Now only router.navigate() runs,
  // and the single subscription in loadInitialData() handles the data fetch.
  updateRouteUrl() {
    this.router.navigate(['collections/', this.slug], {
      queryParams: {
        max_price: this.filter?.max,
        min_price: this.filter?.min,
        limit: this.limit,
        sort: this.sortMap.sortValue ? this.sortMap.sortValue + "_" + this.sortMap.sortDirection : this.sortMap
      }
    });
  }

  onSort(event: any): void {
    this.sortMap = event.target.value;
    this.loading = true;
    setTimeout(() => {
      this.updateRouteUrl();
    }, 250);
  }

  onCount(event: any): void {
    this.limit = event.target.value;
    this.loading = true;
    this.currentPage = 1;
    setTimeout(() => {
      this.updateRouteUrl();
    }, 250);
  }

  cleanFilter() {
    this.productTagsSelected = [];
    this.sortMap = { sortValue: null, sortDirection: null };

    if (this.isBrowser) {
      const element = document.getElementById('default') as HTMLOptionElement;
      element.selected = true;
    }
    this.minPrice = 25;
    this.maxPrice = 1000;
    this.filter = { min: this.minPrice, max: this.maxPrice };
    this.clean = true;
    this.currentPage = 1;
    this.loading = true;
    setTimeout(() => {
      this.updateRouteUrl();
    }, 250);
  }

  toggleFilterVisibility(filterType: 'pc' | 'mobile', action: 'show' | 'hide') {
    if (this.isBrowser) {
      const body = document.body;
      const sidebar = document.querySelector('.shop-sidebar');
      const productWrapper = document.querySelector('.product-wrapper');

      if (filterType === 'pc') {
        sidebar?.classList.toggle('closed', action === 'hide');
        sidebar?.classList.toggle('cols-md-4', action === 'hide');
        productWrapper?.classList.toggle('cols-md-4', action === 'hide');
      } else if (filterType === 'mobile') {
        body.classList.toggle('sidebar-active', action === 'show');
      }
    }
  }

  getHeaderBackground(subheader_settings: any) {
    if (subheader_settings) {
      if (subheader_settings.style == 'Color' && subheader_settings.defaultColor) {
        return subheader_settings.defaultColor || "gray";
      }
      else if (subheader_settings.style == 'Pattern' && subheader_settings.defaultPattern) {
        return `url(assets/images/page-builder/patterns/ ${subheader_settings.defaultPattern} .png)`;
      }
      else if (subheader_settings.style == 'Image' && subheader_settings.defaultImage && subheader_settings.defaultImage.defaultUrl) {
        return `url( ${subheader_settings.defaultImage.defaultUrl})`;
      }
      return "gray";
    } else {
      return "gray";
    }
  }
}