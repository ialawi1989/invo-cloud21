import { Component, OnDestroy, OnInit, inject, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Company } from '../../models/company.model';
import { Invoice } from '../../models/invoice-model';
import { Product } from '../../models/product.model';
import { Currency } from 'src/app/models/currency.model';
import { Header } from '../../models/theme-settings.model';
import { AppServices } from '../../services/appServices';
import { AppState } from '../../store/app.state';
import { setCartState } from '../../store/app.actions';
import { CartService } from '../../services/cartServices/cart.service';
import { CompanyServices } from '../../services/companyServices/company.service';
import { SearchService } from '../../services/searchService/search.service';
import { CurrencyService } from '../../services/currencyService/currency.service';
import { LanguageService } from '../../services/langauge.service';
import { AuthService } from '../../services/authService/auth.service';
import { LoadingService } from '../../services/loadingService/loading.service';
import { PaymentService } from 'src/app/services/paymentServices/payments.service';
import { ThemeService } from 'src/app/services/themeServices/theme.service';
import { MenuService } from 'src/app/services/menuServices/menu.service';
import { ModalService } from 'src/app/services/modal.service';
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { LoginPopComponent } from '../auth/login-pop/login-pop.component';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { Location } from '@angular/common';
import { effect } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit, OnDestroy , OnDestroy{
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);

  companyData: Company = new Company();
  invoiceData!: Invoice;
  userData: any = {};
  currencies: Currency[] = [];
  currentCurrency: any = {};
  selectedCurrencySymbol: string = '';
  searchQuery: string = '';
  filteredResults: Product[] = [];
  showSuggestions: boolean = false;
  isMobileSearchShown: boolean = false;
  languages: string[] = ['en', 'ar'];
  searchResults: Product[] = [];
  isBrowser: boolean;
  searchHistory: string[] = [];

  // Per-line in-flight state for the cart remove button
  removingLineIds = new Set<string>();

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private companyService: CompanyServices,
    private cartService: CartService,
    private currencyService: CurrencyService,
    private searchService: SearchService,
    private languageService: LanguageService,
    private authService: AuthService,
    private paymentService: PaymentService,
    private themeService: ThemeService,
    private modalService: ModalService,
    private pageBuilderService: PageBuilderService,
    private store: Store<AppState>,
    private router: Router,
    private location: Location,
    public appService: AppServices,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    effect(() => {
      const show = this.searchService.showSearchInMobile();
      show ? this.showMobileSearch(true) : this.closeMobileSearch();
    });
  }

  ngOnInit(): void {
    this.currencyService.currentCurrency.pipe(takeUntil(this.destroy$)).subscribe(c => this.currentCurrency = c);

    if (this.isBrowser) {
      // REMOVE the saved currency block — handled in getCurrencies() now
      this.appService.lang = this.languageService.getLanguage();
      window.addEventListener('resize', this.handleWindowResize);
    }

    this.authService.userData$.pipe(takeUntil(this.destroy$)).subscribe({ next: d => this.userData = d });
    this.searchService.searchQuery$.pipe(takeUntil(this.destroy$)).subscribe(q => {
      if (q && q !== this.searchQuery) this.searchQuery = q;
    });

    this.getCompanyData();
    this.getCurrencies();
    this.getCartInvoiceData();

    let tempData = new Header();
    tempData.ParseJson(this.companyData.themeSettings.template.header);
    this.companyData.themeSettings.template.header = tempData;
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

  getCompanyData() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => {
        try {
          this.companyData = data;
          this.companyData.menuSettings.primaryMenu[0].template.groupedList = this.buildMenuTree();
        } catch { }
      }
    });
  }

  buildMenuTree(): any[] {
    const result: any[] = [];
    const stack: any[] = [];
    for (const item of this.companyData.menuSettings.primaryMenu[0]?.template?.list ?? []) {
      const depth = item.depth ?? 0;
      const node = { ...item };
      while (stack.length > depth) stack.pop();
      if (depth === 0) { result.push(node); stack[0] = node; }
      else {
        const parent = stack[depth - 1];
        if (!parent.children) parent.children = [];
        parent.children.push(node);
        stack[depth] = node;
      }
    }
    return result;
  }

  getCurrencies(): void {
    this.paymentService.getCurrenciesList().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Currency[]) => {
        this.currencies = (data ?? []).filter(c => c.isEnabled && c.symbol);

        const companyCurrency: any = {
          id: 'company-default',   // ← add this
          name: this.companyData.country,
          symbol: this.companyData.settings.currencySymbol,
          afterDecimal: this.companyData.settings.afterDecimal,
          rate: 1,
        };

        this.currencies.push(companyCurrency);

        // Only default to company currency if user has no saved preference
        if (this.isBrowser) {
          const saved = localStorage.getItem('selectedCurrency');
          if (saved) {
            const savedCurrency = JSON.parse(saved);
            // Make sure saved currency still exists in the list
            const exists = this.currencies.find(c => c.symbol === savedCurrency.symbol);
            const toApply = exists ? savedCurrency : companyCurrency;
            this.selectedCurrencySymbol = toApply.symbol;
            this.currentCurrency = toApply;
            this.currencyService.changeCurrency(toApply);
          } else {
            // No saved preference → default to company currency
            this.selectedCurrencySymbol = companyCurrency.symbol;
            this.currentCurrency = companyCurrency;
            this.currencyService.changeCurrency(companyCurrency);
          }
        }
      },
      error: (err: any) => this.logger.error(err?.message, { stack: err?.stack, context: 'HeaderComponent.getCurrencies' }),
    });
  }

  getCartInvoiceData() {
    this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: Invoice | null) => {
        if (invoiceData) {
          this.invoiceData = invoiceData;
          this.store.dispatch(setCartState({ cartState: invoiceData }));
        }
      }
    });
  }

  // ─── Cart ─────────────────────────────────────────────────────────────────

  isLineBusy(id: string): boolean { return this.removingLineIds.has(id); }

  removeItem(id: string) {
    if (this.removingLineIds.has(id)) return;
    this.removingLineIds.add(id);
    this.cartService.removeItemFromCart({ transactionId: id, sessionId: this.invoiceData.onlineData.sessionId }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: Invoice | null) => {
        if (invoiceData) this.invoiceData = invoiceData;
        this.removingLineIds.delete(id);
      },
      error: () => this.removingLineIds.delete(id),
    });
  }

  openCartDropdown() {
    if (!this.isBrowser) return;
    document.querySelector('.cart-dropdown')?.classList.add('opened');
    document.body.style.overflow = 'hidden';
  }

  closeCartDropdown() {
    if (!this.isBrowser) return;
    document.querySelector('.cart-dropdown')?.classList.remove('opened');
    document.body.style.overflow = 'auto';
  }

  // ─── Wishlist ─────────────────────────────────────────────────────────────

  getWishlist(): Product[] {
    if (!this.isBrowser) return [];
    return JSON.parse(localStorage.getItem('wishlist') || '[]');
  }

  removeItemFromWishlist(productId: string) {
    if (!this.isBrowser) return;
    const updated = this.getWishlist().filter((p: any) => p.id !== productId);
    localStorage.setItem('wishlist', JSON.stringify(updated));
  }

  openWishlistDropdown() {
    if (!this.isBrowser) return;
    document.querySelector('.wishlist-dropdown')?.classList.add('opened');
    document.body.style.overflow = 'hidden';
  }

  closeWishlistDropdown() {
    if (!this.isBrowser) return;
    document.querySelector('.wishlist-dropdown')?.classList.remove('opened');
    document.body.style.overflow = 'auto';
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  onSearchInput() {
    if (!this.searchQuery.trim()) {
      this.filteredResults = [];
      this.showSuggestions = this.isMobile();
      return;
    }
    this.filteredResults = this.searchResults.filter(p =>
      p.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
    this.showSuggestions = this.isMobile() || this.filteredResults.length > 0;
  }

  selectSuggestion(name: string) {
    this.searchQuery = name;
    this.showSuggestions = false;
    this.searchProducts();
  }

  searchProducts(): void {
    if (!this.searchQuery) {
      this.showMobileSearch(false);
      this.showSuggestions = false;
      return;
    }
    this.saveSearchHistory(this.searchQuery.trim());
    this.searchService.setSearchQuery(this.searchQuery);
    this.router.navigate(['/search'], { queryParams: { searchTerm: this.searchQuery } });
    this.searchQuery = '';
    this.showMobileSearch(false);
    this.showSuggestions = false;
    this.filteredResults = [];
  }

  // ─── Search History ───────────────────────────────────────────────────────

  private readonly HISTORY_KEY = 'search_history';
  private readonly MAX_HISTORY = 10;

  saveSearchHistory(query: string): void {
    if (!this.isBrowser || !query) return;
    const history: string[] = JSON.parse(localStorage.getItem(this.HISTORY_KEY) || '[]');
    const updated = [query, ...history.filter(h => h.toLowerCase() !== query.toLowerCase())].slice(0, this.MAX_HISTORY);
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(updated));
    this.searchHistory = updated;
  }

  getSearchHistory(): string[] {
    if (!this.isBrowser) return [];
    return JSON.parse(localStorage.getItem(this.HISTORY_KEY) || '[]');
  }

  removeFromHistory(query: string): void {
    if (!this.isBrowser) return;
    const updated = this.searchHistory.filter(h => h !== query);
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(updated));
    this.searchHistory = updated;
  }

  clearAllHistory(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(this.HISTORY_KEY);
    this.searchHistory = [];
  }

  onHistorySelected(query: string): void {
    this.searchQuery = query;
    this.searchProducts();
  }

  showMobileSearch(value: boolean) {
    this.isMobileSearchShown = value;
    this.searchQuery = '';
    this.showSuggestions = true;
    if (value) this.searchHistory = this.getSearchHistory();
  }

  closeMobileSearch() {
    setTimeout(() => {
      this.showSuggestions = false;
      this.isMobileSearchShown = false;
      this.filteredResults = [];
    }, 25);
  }

  toggleSearchState() { this.searchService.toggleMobileSearch(); }

  // ─── Currency / Language ──────────────────────────────────────────────────

  onCurrencySelected(symbol: string) {
    this.selectedCurrencySymbol = symbol;
    const currency = this.currencies.find(c => c.symbol === symbol);
    if (currency) {
      this.currentCurrency = currency;
      this.currencyService.changeCurrency(currency);
      if (this.isBrowser) localStorage.setItem('selectedCurrency', JSON.stringify(currency));
    }
  }

  onLanguageSelected(lang: string) {
    this.appService.lang = lang;
    this.languageService.setLanguage(lang);
  }

  getConvertedPrice(total: number): string {
    const price = total / (this.currentCurrency.rate || 1) || 0;
    return price.toFixed(this.currentCurrency.afterDecimal);
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  openLoginPop() {
    if (!this.isBrowser) return;
    try {
      const ref = this.modalService.openWithData(LoginPopComponent, {}, {
        centered: true,
        windowClass: 'modal-md modal-fullscreen-md-down',
        backdrop: 'static',
        keyboard: false,
      });
      ref.result.then(() => { }, () => { }).catch((e: any) =>
        this.logger.error(e?.message, { stack: e?.stack, context: 'HeaderComponent.openLoginPop' })
      );
    } catch (e: any) {
      this.logger.error(e?.message, { stack: e?.stack, context: 'HeaderComponent.openLoginPop' });
    }
  }

  goToAccount() { this.router.navigate(['/account']); }
  logout() { this.authService.confLogout(); }

  // ─── Mobile menu ──────────────────────────────────────────────────────────

  openMobileMenu() {
    if (!this.isBrowser) return;
    document.body.classList.add('mmenu-active');
    document.body.style.overflow = 'hidden';
  }

  openLoginDropdown() {
    if (!this.isBrowser) return;
    document.querySelector('.login-dropdown')?.classList.add('opened');
    document.body.style.overflow = 'hidden';
  }

  closeLoginDropdown() {
    if (!this.isBrowser) return;
    document.querySelector('.login-dropdown')?.classList.remove('opened');
    document.body.style.overflow = 'auto';
  }

  // ─── Route helpers ────────────────────────────────────────────────────────

  isMobile(): boolean {
    return this.isBrowser && window.innerWidth < 920;
  }

  isHomeActive(): boolean {
    const segments = this.location.path().split('/');
    return segments.length <= 1 || segments[1]?.toLowerCase() === 'home';
  }

  isPageActive(item: any): boolean {
    const path = this.location.path().split('?')[0];
    const segments = path.split('/');
    const first = segments[1] ?? '';
    const last = segments[segments.length - 1] ?? '';
    if (item.type === 'collections') return item.abbr?.toLowerCase() === last;
    if (['plus', 'pages', 'appointments', 'reservations', 'orders', 'menu', 'shop', 'table-reservation', 'services'].includes(item.type))
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

  isHeaderOverlay(): boolean {
    const url = this.router.url.split('?')[0];
    const isHome = url === '/' || url === '/home' || url === '';
    if (!isHome || !this.companyData.themeSettings.template?.header?.enabledOverlay) return false;
    return this.pageBuilderService.pageData()?.template?.sections?.[0]?.sectionType === 'Banner section';
  }

  isShowTopHeader(): boolean {
    const hidden = ['/order', '/product', '/appointments', '/checkout', '/cart', '/account',
      '/table-reservation', '/my-reservation', '/my-order', '/notification', '/wishlist'];
    return !(this.isMobile() && hidden.some(r => this.router.url.includes(r)));
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  private handleWindowResize = () => {
    if (this.isBrowser && this.isMobileSearchShown && !this.isMobile()) {
      this.closeMobileSearch();
      this.searchService.toggleMobileSearch();
    }
  };

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.isBrowser) window.removeEventListener('resize', this.handleWindowResize);
  }
}