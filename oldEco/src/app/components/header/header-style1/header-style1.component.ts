import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  QueryList,
  SimpleChanges,
  ViewChildren,
  ViewEncapsulation,
  Inject,
  PLATFORM_ID,
  HostListener,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Invoice } from '../../../models/invoice-model';
import { Product } from '../../../models/product.model';
import { Company } from '../../../models/company.model';
import { Currency } from 'src/app/models/currency.model';
import { AppServices } from '../../../services/appServices';

@Component({
  selector: 'app-header-style1',
  standalone: false,
  templateUrl: './header-style1.component.html',
  styleUrl: './header-style1.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class HeaderStyle1Component implements AfterViewInit, OnChanges {

  // ── Inputs ────────────────────────────────────────────────────────────────
  @Input() companyData: Company = new Company();
  @Input() invoiceData!: Invoice;
  @Input() userData: any = {};
  @Input() currencies: Currency[] | undefined = [];
  @Input() currentCurrency: any = {};
  @Input() selectedCurrencySymbol: string = '';
  @Input() searchQuery: string = '';
  @Input() filteredResults: Product[] = [];
  @Input() showSuggestions: boolean = false;
  @Input() isMobileSearchShown: boolean = false;
  @Input() languages: string[] = ['en', 'ar'];
  @Input() removingLineIds: Set<string> = new Set();
  // Computed booleans — evaluated once per change-detection cycle in the parent
  @Input() isHeaderOverlay: boolean = false;
  @Input() isHomeActive: boolean = false;
  @Input() showTopHeader: boolean = true;
  @Input() searchHistory: string[] = [];

  // ── Outputs ───────────────────────────────────────────────────────────────
  @Output() currencySelected = new EventEmitter<string>();
  @Output() languageSelected = new EventEmitter<string>();
  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() searchInputChange = new EventEmitter<void>();
  @Output() searchSubmit = new EventEmitter<void>();
  @Output() suggestionSelected = new EventEmitter<string>();
  @Output() mobileSearchOpen = new EventEmitter<void>();
  @Output() mobileSearchClose = new EventEmitter<void>();
  @Output() cartOpen = new EventEmitter<void>();
  @Output() cartClose = new EventEmitter<void>();
  @Output() cartRemove = new EventEmitter<string>();
  @Output() wishlistOpen = new EventEmitter<void>();
  @Output() wishlistClose = new EventEmitter<void>();
  @Output() wishlistRemove = new EventEmitter<string>();
  @Output() loginOpen = new EventEmitter<void>();
  @Output() accountNav = new EventEmitter<void>();
  @Output() logoutClick = new EventEmitter<void>();
  @Output() mobileMenuOpen = new EventEmitter<void>();
  @Output() pageNav = new EventEmitter<any>();
  @Output() homeNav = new EventEmitter<void>();
  @Output() historySelected = new EventEmitter<string>();
  @Output() historyRemoved = new EventEmitter<string>();
  @Output() historyClear = new EventEmitter<void>();

  // ── Local-only (layout / view concerns) ──────────────────────────────────
  @ViewChildren('menuItem') menuItems!: QueryList<ElementRef>;

  showCurrencyDropdown = false;
  showLangDropdown = false;

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeAllDropdowns();
  }

  toggleCurrencyDropdown(e: Event): void {
    e.stopPropagation();
    this.showCurrencyDropdown = !this.showCurrencyDropdown;
    this.showLangDropdown = false;
  }

  toggleLangDropdown(e: Event): void {
    e.stopPropagation();
    this.showLangDropdown = !this.showLangDropdown;
    this.showCurrencyDropdown = false;
  }

  selectCurrency(symbol: string): void {
    this.currencySelected.emit(symbol);
    this.showCurrencyDropdown = false;
  }

  selectLanguage(lang: string): void {
    this.languageSelected.emit(lang);
    this.showLangDropdown = false;
  }

  closeAllDropdowns(): void {
    this.showCurrencyDropdown = false;
    this.showLangDropdown = false;
  }

  isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    public appService: AppServices,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  private readonly HISTORY_KEY = 'search_history';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isMobileSearchShown']?.currentValue === true && this.isBrowser) {
      this.searchHistory = JSON.parse(localStorage.getItem(this.HISTORY_KEY) || '[]');
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.adjustDropdownMenus(), 150);
  }

  // ── View helpers ──────────────────────────────────────────────────────────

  isMobile(): boolean {
    return this.isBrowser && window.innerWidth < 920;
  }

  // ── Local history helpers (update view immediately + emit to parent) ──────

  onHistoryItemRemove(item: string): void {
    this.searchHistory = this.searchHistory.filter(h => h !== item);
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.searchHistory));
    this.historyRemoved.emit(item);
  }

  onHistoryClear(): void {
    this.searchHistory = [];
    localStorage.removeItem(this.HISTORY_KEY);
    this.historyClear.emit();
  }

  isLineBusy(id: string): boolean {
    return this.removingLineIds.has(id);
  }

  getConvertedPrice(total: number): string {
    const price = total / (this.currentCurrency.rate || 1) || 0;
    return price.toFixed(this.currentCurrency.afterDecimal);
  }

  getWishlist(): Product[] {
    if (!this.isBrowser) return [];
    return JSON.parse(localStorage.getItem('wishlist') || '[]');
  }

  // ── Active-route helpers (called per menu item in template ngFor) ─────────
  // The parent passes isHeaderOverlay/isHomeActive/showTopHeader as simple
  // @Input booleans (computed once). Per-item helpers stay here because they
  // are called inside @for loops and receive the item reference directly.
  isPageActive(item: any): boolean {
    // Delegate signal back to parent via a query-string-safe @Output is
    // impractical for per-item calls; keep this read-only URL check local.
    const path = window.location.pathname;
    const segments = path.split('/');
    const first = segments[1] ?? '';
    const last = segments[segments.length - 1] ?? '';
    if (item.type === 'collections')
      return item.abbr?.toLowerCase() === last;
    if (['plus', 'pages', 'appointments', 'reservations', 'orders', 'menu',
      'shop', 'table-reservation', 'services'].includes(item.type))
      return item.abbr?.toLowerCase() === first;
    return false;
  }

  isParentPageActive(item: any): boolean {
    return item.children?.some((c: any) => this.isPageActive(c)) ?? false;
  }

  isMegaParentPageActive(item: any): boolean {
    return item.megaColumns?.some((col: any) =>
      col.items?.some((sub: any) => this.isPageActive(sub))
    ) ?? false;
  }

  // ── Mega-menu positioning (DOM layout — must stay in the child) ───────────

  adjustDropdownMenus(): void {
    const container = document.querySelector('.container');
    const containerRect = container?.getBoundingClientRect();
    if (!containerRect) return;

    const containerLeft = containerRect.left;
    const containerWidth = containerRect.width;

    this.menuItems.forEach((itemRef) => {
      const li = itemRef.nativeElement.closest('li');
      if (!li || !li.classList.contains('submenu-container')) return;

      Array.from(li.children).forEach((child: any) => {
        if (child.classList.contains('megamenu')) {
          const menuWidth = child.getBoundingClientRect().width;
          child.setAttribute('style', '');
          const leftInsideContainer = (containerWidth - menuWidth) / 2;
          const liLeft = li.getBoundingClientRect().left;
          const relativeLeft = containerLeft + leftInsideContainer - liLeft;
          (child as HTMLElement).style.marginLeft = `${relativeLeft}px`;
        }
      });
    });
  }
}