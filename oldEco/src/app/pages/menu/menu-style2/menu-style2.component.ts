import {
  Component,
  Inject,
  Input,
  PLATFORM_ID,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { MenuSectionProducts } from 'src/app/models/menu-sections-products';
import { BannerSectionComponent } from 'src/app/components/sections/banner-section/banner-section.component';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PriceFilterComponent } from 'src/app/components/price-filter/price-filter.component';
import { ProductGridComponent } from 'src/app/components/product/product-grid/product-grid.component';
import { ProductListComponent } from 'src/app/components/product/product-list/product-list.component';
import { ThemeService } from 'src/app/services/themeServices/theme.service';
import { AppServices } from 'src/app/services/appServices';
import { MenuService } from 'src/app/services/menuServices/menu.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-menu-style2',
  imports: [
    TranslateModule,
    RouterLink,
    FormsModule,
    NgTemplateOutlet,
    BannerSectionComponent,
    ProductGridComponent,
    ProductListComponent,
    PriceFilterComponent,
  ],
  templateUrl: './menu-style2.component.html',
  styleUrl: './menu-style2.component.css',
})
export class MenuStyle2Component implements OnInit, OnChanges, OnDestroy {

  // ── Inputs from parent MenuComponent ────────────────────────
  @Input() allSectionsProducts: MenuSectionProducts[] = [];
  @Input() sections: any[] = [];
  @Input() productTags: any[] = [];
  @Input() pageData: any;

  // ── ViewChild ────────────────────────────────────────────────
  @ViewChild('scrollAnchor', { static: false }) scrollAnchor!: ElementRef;

  // ── Platform ─────────────────────────────────────────────────
  isBrowser: boolean = false;

  // ── Destroy signal ───────────────────────────────────────────
  private destroy$ = new Subject<void>();

  // ── Section / product state ──────────────────────────────────
  selectedSection: any = null;
  pageSection: any = null;          // the full MenuSectionProducts object
  filteredProducts: any[] = [];
  totalProducts = 0;
  private sectionRawProducts: any[] = [];

  // ── Layout ───────────────────────────────────────────────────
  productsLayout: string = 'grid';
  loading = false;
  items: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // ── Sort ─────────────────────────────────────────────────────
  sortMap: any = { sortValue: null, sortDirection: null };

  // ── Filters ──────────────────────────────────────────────────
  productTagsSelected: string[] = [];
  filter: any = {};
  minPrice = 0;
  maxPrice = 1000;

  // ── Pagination ───────────────────────────────────────────────
  currentPage = 1;

  // ── Filter panel open/close ──────────────────────────────────
  showFilterTags = true;

  // ── Mobile UI state ──────────────────────────────────────────
  isMobileFilterDrawerOpen = false;

  // ── Section search ───────────────────────────────────────────
  sectionSearchQuery = '';

  get filteredSections(): any[] {
    const q = this.sectionSearchQuery.trim().toLowerCase();
    if (!q) return this.sections;
    return this.sections.filter((s) =>
      this.displayName(s).toLowerCase().includes(q)
    );
  }

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    public appService: AppServices,
    public themeService: ThemeService,
    private menuService: MenuService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.subscribeToRouteParams();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sections'] || changes['allSectionsProducts']) {
      const sections: any[] = changes['sections']?.currentValue ?? this.sections;

      // ── Service changed: parent cleared sections to [] first ──────
      // Reset to the category grid so we don't show the previous
      // service's selected section or stale products.
      if (!sections?.length) {
        this.selectedSection    = null;
        this.pageSection        = null;
        this.filteredProducts   = [];
        this.sectionRawProducts = [];
        this.totalProducts      = 0;
        this.sectionSearchQuery = '';
        this.resetFilters();
        return;
      }

      // ── New sections arrived (after service reload or slow async) ─
      const sectionId = this.route.snapshot.queryParams['sectionId'];
      if (sectionId && !this.selectedSection) {
        // Restore section from URL (e.g. page refresh with sectionId in URL)
        const section = sections.find((s) => s.id === sectionId);
        if (section) {
          this.selectedSection = section;
          this.loadSectionProducts(section);
        }
      } else if (this.selectedSection) {
        // Still viewing the same section — refresh products with new data
        const stillExists = sections.find((s) => s.id === this.selectedSection.id);
        if (stillExists) {
          this.loadSectionProducts(this.selectedSection);
        } else {
          // Section no longer exists in new data — go back to grid
          this.backToSections();
        }
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────────────────────────────────────────────────────────
  // Route params subscription (mirrors shop-style2 pattern)
  // ─────────────────────────────────────────────────────────────

  private subscribeToRouteParams(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const sectionId = params['sectionId'] ?? null;

      this.productTagsSelected = params['tags'] ? params['tags'].split(',') : [];
      this.filter = { max: params['max_price'], min: params['min_price'] };
      this.maxPrice   = this.filter.max ?? this.maxPrice;
      this.minPrice   = this.filter.min ?? this.minPrice;
      this.currentPage = params['page'] ?? 1;

      if (sectionId && this.sections.length) {
        const section = this.sections.find((s) => s.id === sectionId);
        if (section) {
          this.selectedSection = section;
          this.loadSectionProducts(section);
          return;
        }
      }

      if (!sectionId) {
        this.selectedSection    = null;
        this.filteredProducts   = [];
        this.sectionRawProducts = [];
        this.totalProducts      = 0;
        this.loading            = false;
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Route query helper (mirrors shop-style2 updateRouteQueries)
  // ─────────────────────────────────────────────────────────────

  private updateRouteQueries(sectionId?: string, tags?: string[], page?: number): void {
    const allTags = tags?.length ? tags.join(',') : null;

    this.router.navigate(['/menu'], {
      queryParamsHandling:'merge',
      queryParams: {
        sectionId: sectionId ?? null,
        tags:      allTags,
        max_price: this.filter?.max ?? null,
        min_price: this.filter?.min ?? null,
        page:      page ?? this.currentPage,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Section grid → product listing
  // ─────────────────────────────────────────────────────────────

  /** Called when the user taps a section card on the landing grid. */
  showProducts(section: any): void {
    this.scrollToTop();
    this.resetFilters();
    this.updateRouteQueries(section.id, [], 1);
    // selectedSection + product load are driven by subscribeToRouteParams,
    // but we set it eagerly so the template switches immediately.
    this.selectedSection = section;
    this.loadSectionProducts(section);
  }

  /** Called when the user presses any "Back to Menu" button. */
  backToSections(): void {
    this.selectedSection     = null;
    this.filteredProducts    = [];
    this.sectionRawProducts  = [];
    this.totalProducts       = 0;
    this.loading             = false;
    this.productTagsSelected = [];
    this.filter              = {};
    this.minPrice            = 0;
    this.maxPrice            = 1000;
    this.currentPage         = 1;
    this.sortMap             = { sortValue: null, sortDirection: null };
    this.scrollToTop();
    // Clear sectionId and all filter params from the URL
    this.router.navigate(['/menu'], {
      queryParams: {
        sectionId: null,
        tags: null,
        max_price: null,
        min_price: null,
        page: null,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Internal: load + cache products for the chosen section
  // ─────────────────────────────────────────────────────────────

  private loadSectionProducts(section: any): void {
    this.loading = true;

    const sectionData = this.allSectionsProducts.find(
      (s) => s.menuSectionId === section?.id
    );
    this.sectionRawProducts = sectionData ? [...sectionData.products] : [];
    this.totalProducts = this.sectionRawProducts.length;

    this.applyAllFilters();

    // Short artificial delay so skeleton loaders flash consistently
    setTimeout(() => { this.loading = false; }, 200);
  }

  // ─────────────────────────────────────────────────────────────
  // Central filter + sort engine
  // ─────────────────────────────────────────────────────────────

  private applyAllFilters(): void {
    let result = [...this.sectionRawProducts];

    // Tag filter
    if (this.productTagsSelected.length > 0) {
      result = result.filter((p) =>
        p.tags?.some((t: string) => this.productTagsSelected.includes(t))
      );
    }

    // Price filter
    if (this.filter?.min != null && this.filter?.max != null) {
      result = result.filter((p) => {
        const tax = p.productTaxes?.taxPercentage;
        let price = p.defaultPrice ?? 0;
        if (tax) price = price * (tax / 100) + price;
        return price >= this.filter.min && price <= this.filter.max;
      });
    }

    // Sort
    const { sortValue, sortDirection } = this.sortMap;
    if (sortValue) {
      const dir = sortDirection === 'ASC' ? 1 : -1;
      result.sort((a: any, b: any) => {
        const vA = a[sortValue] ?? a['branches']?.[0]?.price ?? 0;
        const vB = b[sortValue] ?? b['branches']?.[0]?.price ?? 0;
        if (typeof vA === 'string') return vA.localeCompare(vB) * dir;
        return (vA - vB) * dir;
      });
    }

    this.filteredProducts = result;
  }

  // ─────────────────────────────────────────────────────────────
  // Sort
  // ─────────────────────────────────────────────────────────────

  onMenuSortChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const json = value
      .replace(/(\w+):/g, '"$1":')
      .replace(/'([^']+)'/g, '"$1"');
    try {
      this.sortMap = JSON.parse(json);
    } catch {
      this.sortMap = { sortValue: null, sortDirection: null };
    }
    this.loading = true;
    this.applyAllFilters();
    setTimeout(() => { this.loading = false; }, 200);
  }

  // ─────────────────────────────────────────────────────────────
  // Price filter
  // ─────────────────────────────────────────────────────────────

  filterMenuByPrice(min: number, max: number): void {
    if (min < 0 || max < 0) return;
    this.filter  = (min === 0 && max === 0) ? null : { min, max };
    this.minPrice = min;
    this.maxPrice = max;
    this.applyAllFilters();
    this.updateRouteQueries(this.selectedSection?.id, this.productTagsSelected, this.currentPage);
  }

  // ─────────────────────────────────────────────────────────────
  // Tag filter
  // ─────────────────────────────────────────────────────────────

  loadProductsPerTags(reset: boolean, tag: string, _sectionId?: string): void {
    if (reset) {
      const idx = this.productTagsSelected.indexOf(tag);
      if (idx > -1) this.productTagsSelected.splice(idx, 1);
      else this.productTagsSelected.push(tag);
    } else {
      this.productTagsSelected = [tag];
    }
    this.applyAllFilters();
    this.updateRouteQueries(this.selectedSection?.id, this.productTagsSelected, this.currentPage);
  }

  // ─────────────────────────────────────────────────────────────
  // Clear all filters
  // ─────────────────────────────────────────────────────────────

  cleanMenuFilters(): void {
    this.resetFilters();
    this.applyAllFilters();
    this.updateRouteQueries(this.selectedSection?.id, [], 1);
  }

  private resetFilters(): void {
    this.productTagsSelected = [];
    this.filter              = {};
    this.minPrice            = 0;
    this.maxPrice            = 1000;
    this.sortMap             = { sortValue: null, sortDirection: null };
  }

  // ─────────────────────────────────────────────────────────────
  // Active filter badge count
  // ─────────────────────────────────────────────────────────────

get activeFilterCount(): number {
  let count = 0;
  if (this.productTagsSelected?.length) count += this.productTagsSelected.length;
  if (this.filter?.min != null || this.filter?.max != null) count++;
  return count;
}

  // ─────────────────────────────────────────────────────────────
  // Layout toggle
  // ─────────────────────────────────────────────────────────────

  changeMenuProductsLayout(value: string): void {
    this.productsLayout = value;
  }

  // ─────────────────────────────────────────────────────────────
  // Filter drawer helpers
  // ─────────────────────────────────────────────────────────────

  showMobileFilter(): void {
    this.isMobileFilterDrawerOpen = true;
  }

  hideMobileFilter(): void {
    this.isMobileFilterDrawerOpen = false;
  }

  // ─────────────────────────────────────────────────────────────
  // Image helpers
  // ─────────────────────────────────────────────────────────────

  onImageError(event: any, section: any): void {
    event.target.src = 'assets/images/default-blank-image.png';
    section.backgroundColor = '#8c8c8d';
    section.isColorLoaded = true;
  }

  onImageLoad(event: any, section: any): void {
    if (!section.isColorLoaded) {
      this.extractSectionColor(section);
    }
  }

  async extractSectionColor(section: any): Promise<void> {
    try {
      if (!section?.defaultUrl || section.defaultUrl.includes('default-blank-image.png')) {
        section.backgroundColor = '#8c8c8d';
        section.isColorLoaded = true;
        return;
      }
      const dominantColor = await this.themeService.extractDominantColor(section.defaultUrl);
      section.backgroundColor = dominantColor;
      section.isColorLoaded = true;
    } catch {
      section.backgroundColor = '#8c8c8d';
      section.isColorLoaded = true;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Display helpers
  // ─────────────────────────────────────────────────────────────

  displayName(section: any): string {
    const ar   = section?.translation?.name?.ar;
    const name = this.appService?.lang === 'ar' ? (ar || section?.name) : section?.name;
    return name ?? 'category';
  }

  getHeaderBackground(subheader_settings: any): string {
    if (!subheader_settings) return 'gray';

    if (subheader_settings.style === 'Color' && subheader_settings.defaultColor) {
      return subheader_settings.defaultColor;
    }
    if (subheader_settings.style === 'Pattern' && subheader_settings.defaultPattern) {
      return `url(assets/images/page-builder/patterns/${subheader_settings.defaultPattern}.png)`;
    }
    if (subheader_settings.style === 'Image' && subheader_settings.defaultImage?.defaultUrl) {
      return `url(${subheader_settings.defaultImage.defaultUrl})`;
    }
    return 'gray';
  }

  scrollToTop(): void {
    if (this.isBrowser) {
      window.scrollTo({ top: 0 });
    }
  }
}