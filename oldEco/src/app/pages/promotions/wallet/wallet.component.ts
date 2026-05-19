import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { WalletServiceService } from '../wallet-service/wallet-service.service';
import { AuthService } from 'src/app/services/authService/auth.service';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AppServices } from 'src/app/services/appServices';
import {
  Coupon,
  CouponStatues,
  CustomerWallet,
  PointsAction,
  WalletSettings,
} from '../modal/promotion.modal';
import { translate } from '../modal/TranslatedString.modal';
import { Shopper } from 'src/app/models/shopper.module';
import { TranslateModule } from '@ngx-translate/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { CustomerTierDetailsComponent } from '../customer-tier-details/customer-tier-details.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CompanyServices } from 'src/app/services/companyServices/company.service';
import { Company } from 'src/app/models/company.model';
import { CurrencyService } from 'src/app/services/currencyService/currency.service';

export type CouponFilter = 'available' | 'used';

@Component({
  selector: 'app-wallet',
  templateUrl: './wallet.component.html',
  imports: [CommonModule, TranslateModule, QRCodeComponent, CustomerTierDetailsComponent],
  styleUrls: ['./wallet.component.css'],
})
export class WalletComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  isBrowser: boolean = false;

  translate = translate;
  qrCodeData: any;
  userData!: Shopper;
  userWallet: CustomerWallet | undefined;
  currencyValue!: number;
  walletSettings!: WalletSettings;

  // Points statement
  allActions: PointsAction[] = [];
  skeletonRows = Array.from({ length: 5 });

  // Coupons
  coupons: Coupon[] = [];
  activeFilter: CouponFilter = 'available';

  // Company (for logo on the wallet card)
  company: Company = new Company();

  // Currency (symbol + formatting from CurrencyService)
  currencySymbol: string = '';
  afterDecimal: number = 3;

  // Loading / error
  isLoading = true;
  loadError = false;

  constructor(
    public walletServiceService: WalletServiceService,
    private authService: AuthService,
    private router: Router,
    public appService: AppServices,
    private companyService: CompanyServices,
    private currencyService: CurrencyService,
    @Inject(PLATFORM_ID) private platformId: any
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  // ── Coupon getters ───────────────────────────────────────────────
  get activeCouponsNumber(): number {
    return this.coupons.filter(c => c.status === CouponStatues.ACTIVE).length;
  }

  get usedCouponsNumber(): number {
    return this.coupons.filter(
      c => c.status === CouponStatues.USED ||
        c.status === CouponStatues.EXPIRED ||
        c.status === CouponStatues.CANCELED
    ).length;
  }

  get filteredCoupons(): Coupon[] | any[] {
    switch (this.activeFilter) {
      case 'used':
        return this.coupons.filter(
          c => c.status === CouponStatues.USED ||
            c.status === CouponStatues.EXPIRED ||
            c.status === CouponStatues.CANCELED
        );
      case 'available':
      default:
        return this.coupons.filter(c => c.status === CouponStatues.ACTIVE);
    }
  }

  setFilter(filter: CouponFilter) {
    this.activeFilter = filter;
  }

  isDiscountSet(set: any): boolean {
    return !!set && 'percentage' in set && 'minimumOrder' in set;
  }

  isProductSet(set: any): boolean {
    return !!set && 'products' in set;
  }

  // ── Lifecycle ────────────────────────────────────────────────────
  async ngOnInit() {
    if (!this.authService.isCustomerAuthenticated()) {
      this.router.navigate(['/']);
      return;
    }

    this.authService.userData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: any) => { this.userData = data; },
    });

    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => { this.company = data; },
    });

    this.currencyService.currentCurrency.pipe(takeUntil(this.destroy$)).subscribe({
      next: (c: any) => {
        this.currencySymbol = c?.symbol || '';
        this.afterDecimal = c?.afterDecimal ?? 3;
      },
    });

    await this.loadData();
  }

  private async loadData() {
    this.isLoading = true;
    this.loadError = false;
    try {
      const [walletSettings, userWallet, actions, coupons] = await Promise.all([
        this.walletServiceService.getWalletSettings(),
        this.walletServiceService.getCustomerWallet(),
        this.walletServiceService.getAllAction(),
        this.walletServiceService.getCustomerCoupons(false, true),
      ]);
      this.walletSettings = walletSettings;
      this.userWallet = userWallet as CustomerWallet;
      this.currencyValue = Number((this.userWallet?.currencyValue ?? 0).toFixed(this.afterDecimal));
      this.allActions = (actions ?? []).sort(
        (a, b) => new Date(b.actionDate).getTime() - new Date(a.actionDate).getTime()
      );
      this.coupons = coupons ?? [];

      if (this.userData && this.userWallet) {
        this.qrCodeData = JSON.stringify({
          id: this.userData.id,
          phoneNumber: this.userWallet.phoneNumber,
        });
      }
    } catch (err) {
      this.loadError = true;
      console.error('Failed to load wallet', err);
    } finally {
      this.isLoading = false;
    }
  }

  retry() { this.loadData(); }

  // ── Helpers ──────────────────────────────────────────────────────
  getRemainingTimeParts(targetDate: Date) {
    const today = new Date();
    const diffTime = new Date(targetDate).getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;
    return { diffDays, weeks, days };
  }

  formatSignedPoints(value: number): string {
    return value > 0 ? '+' + value : String(value);
  }

  getActionClass(actionName: string | undefined | null): string {
    if (!actionName) return '';
    return String(actionName).toUpperCase();
  }

  goBack() { window.history.back(); }

  navigateToPointsStatement() { this.router.navigate(['/wallet/points-statement']); }

  navigateToCustomerCoupons() { this.router.navigate(['/wallet/customer-coupons']); }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}