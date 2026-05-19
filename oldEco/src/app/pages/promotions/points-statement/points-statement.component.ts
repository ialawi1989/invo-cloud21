import { Component, OnDestroy, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/services/authService/auth.service';
import { WalletServiceService } from '../wallet-service/wallet-service.service';

import { AppServices } from 'src/app/services/appServices';
import { CompanyServices } from 'src/app/services/companyServices/company.service';
import { CurrencyService } from 'src/app/services/currencyService/currency.service';
import { Company } from 'src/app/models/company.model';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CarouselModule } from 'ngx-owl-carousel-o';
import {
  PointsAction,
  CustomerWallet,
  PointsSettings,
  WalletSettings,
} from '../modal/promotion.modal';
import { translate } from '../modal/TranslatedString.modal';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  standalone: true,
  imports: [CarouselModule, CommonModule, TranslateModule],
  selector: 'app-points-statement',
  templateUrl: './points-statement.component.html',
  styleUrls: ['./points-statement.component.css'],
})
export class PointsStatementComponent implements OnInit, OnDestroy {
  // ── Fields declared BEFORE the constructor on purpose, so that with
  // useDefineForClassFields:true the field initializers run before any
  // constructor body, and parameter-properties are not shadowed by a
  // later-declared field. This matches the pattern used in order-list,
  // which is known to work in this app.

  translate = translate;
  isBrowser: boolean = false;

  // ── State ────────────────────────────────────────────────────────
  userWallet!: CustomerWallet;
  walletSettings!: WalletSettings;
  currencyValue = 0;
  allActions: PointsAction[] = [];
  userData: any = null;

  // Currency / company state — mirrors the account page so the same
  // formatting is used for the points-equivalent amount.
  companyData: Company = new Company();
  currentCurrency: any = { rate: 1, symbol: '', afterDecimal: 2 };

  // UX loading / error flags
  isLoading = true;
  loadError = false;

  // Set to false once we redirect away — prevents late async updates.
  private isComponentActive = true;

  // skeleton placeholder array (purely for *ngFor rendering)
  skeletonRows = Array.from({ length: 6 });

  private destroy$ = new Subject<void>();

  constructor(
    public walletServiceService: WalletServiceService,
    private authService: AuthService,
    public appService: AppServices,
    private router: Router,
    private companyService: CompanyServices,
    private currencyService: CurrencyService,
    @Inject(PLATFORM_ID) private platformId: any
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  async ngOnInit() {
    // Permission gate: if there's no auth token, redirect to home before
    // we render anything or hit any API.
    if (!this.checkUserAuthentication()) {
      return;
    }

    // Hydrate currency from the previously selected one (if any) before the
    // first render to avoid flashing the wrong currency.
    this.hydrateCurrencyFromStorage();

    // Subscribe to company data so we always have the latest base currency
    // info (symbol / decimals) from the backend.
    this.subscribeToCompanyData();

    // Subscribe to the global CurrencyService so any change the user makes
    // in the header (or anywhere else) instantly updates the equivalent
    // amount on this page. Guarded defensively: if for any reason the
    // service or observable isn't available, we fall back to whatever we
    // already hydrated from localStorage / company defaults.
    if (this.currencyService && this.currencyService.currentCurrency) {
      this.currencyService.currentCurrency
        .pipe(takeUntil(this.destroy$))
        .subscribe((currency: any) => {
          if (!this.isComponentActive || !currency) return;
          this.currentCurrency = currency;
        });
    }

    this.authService.userData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: any) => {
        if (!this.isComponentActive) return;
        this.userData = data;
        if (data) {
          // load wallet data only when user is available
          this.loadData();
        } else {
          // user logged out / session expired while on this page → redirect
          this.checkUserAuthentication();
        }
      },
    });
  }

  /**
   * Read the most recently selected currency from localStorage so the
   * equivalent amount renders in the right currency on first paint.
   * Skipped during SSR.
   */
  private hydrateCurrencyFromStorage(): void {
    if (!this.isBrowser) return;
    try {
      const saved = localStorage.getItem('selectedCurrency');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          this.currentCurrency = {
            rate: parsed.rate ?? 1,
            symbol: parsed.symbol ?? '',
            afterDecimal: parsed.afterDecimal ?? 2,
          };
        }
      }
    } catch {
      // ignore malformed localStorage payloads
    }
  }

  private subscribeToCompanyData(): void {
    if (!this.companyService?.companyData$) return;
    this.companyService.companyData$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: Company) => {
          if (!this.isComponentActive || !data) return;
          this.companyData = data;
          // NOTE: We deliberately don't set `currentCurrency` here — the
          // CurrencyService is the source of truth for what the user has
          // selected. The CurrencyService re-emits whenever company data
          // refreshes, so the base values flow through automatically.
        },
      });
  }

  /**
   * Returns true if the user is authenticated and the component should keep
   * rendering. Returns false (and navigates home) otherwise.
   */
  private checkUserAuthentication(): boolean {
    if (!this.isComponentActive) return false;
    if (!this.appService.auth_token) {
      this.isComponentActive = false;
      this.isLoading = false;
      this.destroy$.next();
      this.router.navigate(['/']);
      return false;
    }
    return true;
  }

  private async loadData() {
    if (!this.isComponentActive) return;
    this.isLoading = true;
    this.loadError = false;
    try {
      const [walletSettings, userWallet, actions] = await Promise.all([
        this.walletServiceService.getWalletSettings(),
        this.walletServiceService.getCustomerWallet<CustomerWallet>(),
        this.walletServiceService.getAllAction(),
      ]);

      if (!this.isComponentActive) return;

      this.walletSettings = walletSettings;
      this.userWallet = userWallet as CustomerWallet;
      this.allActions = (actions ?? []).sort(
        (a, b) =>
          new Date(b.actionDate).getTime() - new Date(a.actionDate).getTime()
      );
      this.currencyValue = this.userWallet?.currencyValue ?? 0;
    } catch (err) {
      if (!this.isComponentActive) return;
      this.loadError = true;
      // eslint-disable-next-line no-console
      console.error('Failed to load points statement', err);
    } finally {
      if (this.isComponentActive) {
        this.isLoading = false;
      }
    }
  }

  retry() {
    if (!this.checkUserAuthentication()) return;
    if (this.userData) {
      this.loadData();
    }
  }

  goBack() {
    window.history.back();
  }

  /**
   * Converts a base-currency amount to the user's currently selected
   * currency and formats it with the configured decimal precision.
   * Matches the account page's getConvertedPrice() so all amounts in
   * the app are formatted consistently.
   */
  getConvertedPrice(price: number): string {
    const rate = this.currentCurrency?.rate || 1;
    const converted = (price / rate) || 0;
    const decimals =
      this.currentCurrency?.afterDecimal ??
      this.companyData?.settings?.['afterDecimal'] ??
      2;
    return converted.toFixed(Number(decimals) || 2);
  }

  /** Used by the template to colour transaction badges by action type. */
  getActionClass(actionName: string | undefined | null): string {
    if (!actionName) return '';
    return String(actionName).toUpperCase();
  }

  /** Convenience used in template for +/- sign formatting. */
  formatSignedPoints(value: number): string {
    if (value > 0) return '+' + value;
    return String(value);
  }

  getRemainingTimeLabel(targetDate: Date): string {
    const today = new Date();
    const diffTime = new Date(targetDate).getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return 'expired';
    }

    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;

    if (weeks === 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    }

    if (days === 0) {
      return `${weeks} week${weeks > 1 ? 's' : ''}`;
    }

    return `${weeks} week${weeks > 1 ? 's' : ''} and ${days} day${
      days > 1 ? 's' : ''
    }`;
  }

  getRemainingTimeParts(targetDate: Date) {
    const today = new Date();
    const diffTime = new Date(targetDate).getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;

    return { diffDays, weeks, days };
  }

  ngOnDestroy(): void {
    this.isComponentActive = false;
    this.destroy$.next();
    this.destroy$.complete();
  }
}