import {
  Component,
  ElementRef,
  HostListener,
  Inject,
  Input,
  PLATFORM_ID,
  QueryList,
  ViewChild,
  ViewChildren,
  OnDestroy,
  OnInit,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  AfterViewChecked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { Subject } from 'rxjs';

import { AppServices } from 'src/app/services/appServices';
import { MenuService } from 'src/app/services/menuServices/menu.service';
import { PriceFilterComponent } from 'src/app/components/price-filter/price-filter.component';
import { ProductGridComponent } from 'src/app/components/product/product-grid/product-grid.component';
import { ProductListComponent } from 'src/app/components/product/product-list/product-list.component';
import { BannerSectionComponent } from 'src/app/components/sections/banner-section/banner-section.component';
import { MenuSectionProducts } from 'src/app/models/menu-sections-products';
import { MenuSection } from 'src/app/models/menu-section.model';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-menu-style1',
  standalone: true,
  imports: [
    TranslateModule,
    RouterLink,
    FormsModule,
    NgTemplateOutlet,
    BannerSectionComponent,
    ProductGridComponent,
    ProductListComponent,
    PriceFilterComponent,
    CommonModule,
  ],
  templateUrl: './menu-style1.component.html',
  styleUrl: './menu-style1.component.css',
})
export class MenuStyle1Component implements OnInit, OnChanges, AfterViewInit, AfterViewChecked, OnDestroy {

  // ── Inputs from parent MenuComponent ────────────────────────
  @Input() allSectionsProducts: MenuSectionProducts[] = [];
  @Input() sections: any[] = [];
  @Input() productTags: any[] = [];
  @Input() pageData: any;

  // ── ViewChildren / ViewChild ─────────────────────────────────
  @ViewChild('menuWidget', { static: false })      menuWidget!: ElementRef;
  @ViewChild('scrollContainer', { static: false }) scrollContainer!: ElementRef;
  @ViewChild('scrollAnchor', { static: false })    scrollAnchor!: ElementRef;
  @ViewChild('searchBox', { static: false })       searchBox!: ElementRef<HTMLInputElement>;
  @ViewChildren('sectionRef')     sectionRefs!: QueryList<ElementRef>;
  @ViewChildren('productSection') productSections!: QueryList<ElementRef>;

  // ── Platform ─────────────────────────────────────────────────
  isBrowser: boolean;

  // ── Layout ───────────────────────────────────────────────────
  loading: boolean = false;
  items: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // ── Section / product state ──────────────────────────────────
  selectedSection?: string;
  filteredProducts: any[] = [];
  private sectionRawProducts: any[] = [];

  // ── Sort ─────────────────────────────────────────────────────
  sortMap: any = { sortValue: null, sortDirection: null };

  // ── Filters ──────────────────────────────────────────────────
  productTagsSelected: string[] = [];
  filter: any = {};
  minPrice = 0;
  maxPrice = 1000;

  // ── Filter panel open/close ──────────────────────────────────
  showFilterCategories = true;
  showFilterTags = true;

  // ── Mobile UI state ──────────────────────────────────────────
  isMobileFilterDrawerOpen = false;
  isCategoriesSheetOpen = false;
  isMenuSticky = false;

  // ── Search ───────────────────────────────────────────────────
  showSearch = false;
  searchQueryMenu = '';

  // ── Scroll / sticky internals ────────────────────────────────
  private headerHeight = 80;
  private offsetTop = 0;
  private toggledMenu = false;
  private sectionObserver: IntersectionObserver | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    public appService: AppServices,
    private menuService: MenuService,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    if (this.sections?.length) {
      this.selectSection(this.sections[0]);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When the parent reloads data after a service change, sections arrives
    // as a new non-empty array. Re-select the first section so the product
    // list is never left blank.
    if (changes['sections']) {
      const sections: any[] = changes['sections'].currentValue;
      if (sections?.length) {
        this.selectSection(sections[0]);
      }
    }
  }

  ngAfterViewInit(): void {
    if (this.menuWidget?.nativeElement) {
      this.offsetTop =
        this.menuWidget.nativeElement.getBoundingClientRect().top + window.scrollY;
    }

    this.productSections.changes.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.isMobile() && this.sections.length) {
        setTimeout(() => this.initSectionObserver(), 400);
      }
    });

    if (this.isMobile() && this.sections.length) {
      setTimeout(() => this.initSectionObserver(), 400);
    }
  }

  ngAfterViewChecked(): void {
    if (this.menuWidget?.nativeElement) {
      this.offsetTop =
        this.menuWidget.nativeElement.getBoundingClientRect().top + window.scrollY;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.sectionObserver?.disconnect();
    window.removeEventListener('scroll', this._mobileScrollFallback);
  }

  // ─────────────────────────────────────────────────────────────
  // Host listeners
  // ─────────────────────────────────────────────────────────────

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    if (!this.isMobile()) {
      this.updateSelectedSectionOnScroll();
    }

    if (this.isMobile() && this.menuWidget?.nativeElement) {
      const menuTop = this.menuWidget.nativeElement.getBoundingClientRect().top;
      this.isMenuSticky = menuTop <= 0;
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.hideMobileFilter();

    if (this.isMobile() && this.sections.length) {
      setTimeout(() => this.initSectionObserver(), 300);
    } else {
      this.sectionObserver?.disconnect();
      window.removeEventListener('scroll', this._mobileScrollFallback);
      this.isCategoriesSheetOpen = false;
      this.isMobileFilterDrawerOpen = false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Platform helpers
  // ─────────────────────────────────────────────────────────────

  isMobile(): boolean {
    if (this.isBrowser) return window.innerWidth < 920;
    return false;
  }

  // ─────────────────────────────────────────────────────────────
  // Internal: set active section + refresh filtered list
  // ─────────────────────────────────────────────────────────────

  private selectSection(section: any): void {
    this.selectedSection = section?.id;
    const sectionData = this.allSectionsProducts.find(
      (s) => s.menuSectionId === section?.id
    );
    this.sectionRawProducts = sectionData ? [...sectionData.products] : [];
    this.applyAllFilters();
  }

  // ─────────────────────────────────────────────────────────────
  // toggleMenu — triggered by category pills / sidebar list
  // ─────────────────────────────────────────────────────────────

  toggleMenu(section?: MenuSection): void {
    this.loading = true;
    this.toggledMenu = true;
    this.searchQueryMenu = '';

    this.selectSection(section);

    setTimeout(() => {
      this.loading = false;
      if (section && this.isMobile()) this.scrollActivePillIntoView(section.id);
      setTimeout(() => { this.toggledMenu = false; }, 800);
    }, 200);
  }

  // ─────────────────────────────────────────────────────────────
  // Scroll helpers
  // ─────────────────────────────────────────────────────────────

  scrollToSection(sectionId: string): void {
    this.selectedSection = sectionId;

    if (!this.isMobile()) return;

    const el = document.getElementById(`products_${sectionId}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - this.headerHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  private scrollActivePillIntoView(sectionId: string): void {
    if (!this.isBrowser) return;
    const pill = document.getElementById(`section_${sectionId}`);
    if (pill) {
      pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // IntersectionObserver — mobile section active-pill tracking
  // ─────────────────────────────────────────────────────────────

  private initSectionObserver(): void {
    if (!this.isBrowser || typeof IntersectionObserver === 'undefined') return;

    this.sectionObserver?.disconnect();
    window.removeEventListener('scroll', this._mobileScrollFallback);

    this.sectionObserver = new IntersectionObserver(
      (entries) => {
        if (this.toggledMenu) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id?.replace('products_', '');
            if (id && id !== this.selectedSection) {
              this.selectedSection = id;
              this.scrollActivePillIntoView(id);
            }
          }
        });
      },
      // Tighter bottom margin so short last sections still get detected
      { root: null, rootMargin: '-5% 0px -70% 0px', threshold: 0 }
    );

    this.sections.forEach((section) => {
      const el = document.getElementById(`products_${section.id}`);
      if (el) this.sectionObserver!.observe(el);
    });

    // Near-bottom fallback: activates the last section when the page
    // can't scroll far enough for the observer threshold to trigger
    window.addEventListener('scroll', this._mobileScrollFallback, { passive: true });
  }

  // Arrow fn keeps a stable reference for removeEventListener
  private _mobileScrollFallback = (): void => {
    if (!this.isMobile() || this.toggledMenu) return;

    const scrollY   = window.scrollY;
    const winHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    if (scrollY + winHeight >= docHeight - 50) {
      const last = this.sections[this.sections.length - 1];
      if (last && last.id !== this.selectedSection) {
        this.selectedSection = last.id;
        this.scrollActivePillIntoView(last.id);
      }
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Desktop scroll — highlight the active section in the sidebar
  // ─────────────────────────────────────────────────────────────

  private updateSelectedSectionOnScroll(): void {
    if (this.toggledMenu || !this.productSections?.length) return;

    const scrollY   = window.scrollY;
    const winHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    // Near-bottom fallback: force the last section active when the
    // page can't scroll far enough to pass the normal detection line
    if (scrollY + winHeight >= docHeight - 50) {
      const last = this.sections[this.sections.length - 1];
      if (last && last.id !== this.selectedSection) {
        this.selectedSection = last.id;
      }
      return;
    }

    // Normal scan
    const scrollTop = scrollY + this.headerHeight + 50;

    this.productSections.forEach((ref) => {
      const el     = ref.nativeElement as HTMLElement;
      const top    = el.getBoundingClientRect().top + scrollY;
      const bottom = top + el.offsetHeight;

      if (scrollTop >= top && scrollTop < bottom) {
        const id = el.id.replace('products_', '');
        if (id && id !== this.selectedSection) {
          this.selectedSection = id;
        }
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Sort
  // ─────────────────────────────────────────────────────────────

  onMenuSortChange(event: Event, _sectionId?: string): void {
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
    this.filter = (min === 0 && max === 0) ? null : { min, max };
    this.minPrice = min;
    this.maxPrice = max;
    this.applyAllFilters();
  }

  // ─────────────────────────────────────────────────────────────
  // Tag filter
  // ─────────────────────────────────────────────────────────────

  loadMenuProductsPerTags(tag: string, _sectionId?: string): void {
    const idx = this.productTagsSelected.indexOf(tag);
    if (idx > -1) {
      this.productTagsSelected.splice(idx, 1);
    } else {
      this.productTagsSelected.push(tag);
    }
    this.applyAllFilters();
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
  // Search
  // ─────────────────────────────────────────────────────────────

  toggleSearch(): void {
    this.showSearch = !this.showSearch;
    if (!this.showSearch) this.searchQueryMenu = '';
    setTimeout(() => {
      if (this.showSearch && this.searchBox?.nativeElement) {
        this.searchBox.nativeElement.focus();
      }
    }, 100);
  }

  onSearchButtonClick(): void {
    this.toggleSearch();
  }

  /** Used by mobile stacked view — hide products that don't match. */
  matchesSearch(product: any): boolean {
    const q = this.searchQueryMenu?.trim().toLowerCase();
    if (!q) return true;
    return (product.name?.toLowerCase() ?? '').includes(q);
  }

  /** Used by mobile stacked view — hide whole sections with no matches. */
  hasMatchingProducts(sectionProducts: MenuSectionProducts): boolean {
    const q = this.searchQueryMenu?.trim().toLowerCase();
    if (!q) return true;
    return sectionProducts.products?.some((p: any) =>
      (p.name?.toLowerCase() ?? '').includes(q)
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Layout toggle
  // ─────────────────────────────────────────────────────────────

  changeProductsLayout(value: string): void {
    this.pageData.template.settings.default_view = value;
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
  // Active filter badge count (shown on the "Filter" button)
  // ─────────────────────────────────────────────────────────────

  get activeFilterCount(): number {
    let count = 0;
    if (this.productTagsSelected?.length) count += this.productTagsSelected.length;
    if (this.filter?.min != null || this.filter?.max != null) count++;
    return count;
  }

  // ─────────────────────────────────────────────────────────────
  // Page-header background helper
  // ─────────────────────────────────────────────────────────────

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
}