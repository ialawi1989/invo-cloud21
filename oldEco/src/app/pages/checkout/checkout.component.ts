//ecommerce checkout page ts - WITH ALPHABETICAL SORTING FOR ALL LISTS

import {
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../services/cartServices/cart.service';
import { Router } from '@angular/router';
import { Invoice } from '../../models/invoice-model';
import { PaymentService } from '../../services/paymentServices/payments.service';
import { BranchService } from '../../services/branchServices/branch.service';
import { FormsModule } from '@angular/forms';
import { LoadingService } from '../../services/loadingService/loading.service';
import { CompanyServices } from '../../services/companyServices/company.service';
import { Company } from '../../models/company.model';
import { CurrencyService } from '../../services/currencyService/currency.service';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AlertService } from '../../services/alertService/alert.service';
import { AppServices } from '../../services/appServices';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/authService/auth.service';
import { Shopper } from '../../models/shopper.module';
import { PageBuilderService } from '../../services/pageBuilderServices/page-builder.service';
import { PageData } from '../../models/page-data/pageData';
import { Branch } from '../../models/branch.model';
import { HttpClient } from '@angular/common/http';
import { NavigationTrackerService } from 'src/app/services/track-product-nav.service';
import { Location } from '@angular/common';
import { ShippingService } from 'src/app/services/shipping.service';
import { ShippingOptions } from 'src/app/models/shipping-options.model';
import { LoginPopComponent } from 'src/app/components/auth/login-pop/login-pop.component';
import { ModalService } from 'src/app/services/modal.service';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { PhoneVerificationComponent } from 'src/app/components/auth/phone-verification/phone-verification.component';
import { PickupSelectorPopComponent } from 'src/app/components/pickup-selector-pop/pickup-selector-pop.component';
import { RedeemComponent } from 'src/app/pages/promotions/redeem/redeem.component';
import {
  CouponProduct,
  CustomerWallet,
  WalletSettings,
} from '../promotions/modal/promotion.modal';
import { WalletServiceService } from '../promotions/wallet-service/wallet-service.service';
import { DeliverySelectorPopComponent } from 'src/app/components/delivery-selector-pop/delivery-selector-pop.component';
import { ShippingSelectorPopComponent } from 'src/app/components/shipping-selector-pop/shipping-selector-pop.component';
import { ServiceSelectorPopComponent } from 'src/app/components/service-selector-pop/service-selector-pop.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { translate } from '../promotions/modal/TranslatedString.modal';
import { LanguageService } from 'src/app/services/langauge.service';
import { DeliveryAddress } from 'src/app/models/company-delivery-address.model';
import { MapComponent } from "src/app/components/delivery-selector-pop/map/map.component";

@Component({
  selector: 'app-checkout',
  imports: [
    RouterLink,
    FormsModule,
    TranslateModule,
    CommonModule,
    RedeemComponent,
    NgSelectModule,
    MapComponent
  ],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css',
})
export class CheckoutComponent implements OnInit, OnDestroy, OnDestroy {
  private logger = inject(LoggerService);
  private destroy$ = new Subject<void>();
  walletSettings!: WalletSettings;
  countries: any[] = [];
  shippingCountries: any[] = [];
  invoiceData!: Invoice | any;
  userData: Shopper | any = new Shopper();
  discountedByCoupon: boolean = false;
  showContinue: boolean = true;
  showCheckout: boolean = false;
  dates: any = [];
  times: any = [];

  shippingOptions: ShippingOptions[] = [];
  shippingSetting: any[] = [];
  isInit: boolean = false;
  branchId: string = '';
  branchName: string = '';
  serviceName: any = '';
  serviceId: string = '';
  addressKey: string = '';
  tableId: string = '';
  tableName: string = '';
  address: any = {};
  payments: any = [];
  selectedPayment: string = '';
  selectedShipping?: ShippingOptions | any;
  services: any = [];
  shippingBranchId: string = '';
  branches: any = [];
  isQuickOrder: boolean = false;
  customer: any = {
    name: '',
    phone: '',
    phoneCode: '',
    phoneNumber: '',
    email: '',
  };
  allCountries: any = [];
  userAddress: any = null;
  date: any = '';
  time: any = '';
  governorateAddresses: any = [];
  addressType: any = null;
  cityAddresses: any = [];
  blocks: any = [];
  cities: any = [];
  blockAddresses: any = [];
  branchCoveredAddresses: any = [];
  isLoadedBranchCoveredAddresses = false;
  filteredDates: any = [];
  filteredTimes: any = [];
  glocation: any = {};
  companyData: Company | any = new Company();
  pageData: PageData | any = new PageData();

  enableScheduleOrder: boolean = false;
  disableDelivery: boolean = false;
  disablePickup: boolean = false;
  disablePayLater: boolean = false;
  disablePayLaterFor: any = [];
  disableImmediateORder: boolean = false;

  showMap = false;

  scheduleOrderOption: string = 'now';
  branchStatus: any = null;
  addresses: any = [];
  addressFormat: any;
  payment: any = {};
  isBenefitPayOpened: boolean = false;
  note: string = '';
  detectedCustomerData = false;
  detectedScheduleOrder = true;
  lng: number = 0;
  lat: number = 0;

  currentCurrency: any = {};
  isBrowser: boolean;
  addressSelection: any;
  isOrderSent = false;
  selectedAddressValue: any = null;
  addressTitleDuplicate: boolean = false;
  isPhoneValidated = false;
  canGoBack: boolean = false;
  loading: boolean = false;
  isPickUpMaxDistance: boolean = false;

  // FIX: prevents double-submit of /cart/checkOut. Place Order buttons only
  // toggle a CSS class (not the [disabled] attribute), so a fast double-click
  // would fire two requests. The first succeeds and deletes the Redis cart;
  // the second hits getRedisCart()==null and throws "Cart is not created"
  // even though the order already went through.
  isPlacingOrder: boolean = false;

  errorChangeService: boolean = false;

  // Promotion/Wallet properties
  totalAmount: number = 200;
  finalAmount: number = this.totalAmount;
  couponId: string = '';
  promoCoupon: number = 0;
  pointsDiscount: number = 0;
  usedPoints: number = 0;
  selectedOption: string = '';
  userWallet!: CustomerWallet;
  couponProducts?: CouponProduct;
  translate = translate;
  isOutOfService = false;
  percentage: number = 0;

  constructor(
    private http: HttpClient,
    private cartService: CartService,
    private paymentService: PaymentService,
    private branchService: BranchService,
    private loadingService: LoadingService,
    private router: Router,
    private companyService: CompanyServices,
    private alertService: AlertService,
    private currencyService: CurrencyService,
    public appServices: AppServices,
    private authService: AuthService,
    private el: ElementRef,
    public appService: AppServices,
    private pageBuilderServices: PageBuilderService,
    @Inject(PLATFORM_ID) private platformId: any,
    private navTracker: NavigationTrackerService,
    private location: Location,
    private modalService: ModalService,
    private shippingService: ShippingService,
    public walletServiceService: WalletServiceService,
    private translate2: TranslateService,
    public languageService: LanguageService,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
    this.allCountries = [...this.appService.allCountries];
  }

  authKey = this.appService.auth_token;

  async ngOnInit() {
    this.walletSettings = await this.walletServiceService.getWalletSettings();
    let sessionId = localStorage.getItem('sessionId');

    if (this.authKey) {
      try {
        this.userWallet = await this.walletServiceService.getCustomerWallet();
      } catch (error: any) {
        this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.fetchCustomerWallet' });
      }
    }
    this.countries = this.appService.allCountries;

    this.loadingService.showLoadingSpinner();
    await this.getPageData();
    if (this.pageData.template?.settings) {
      this.enableScheduleOrder = this.pageData.template?.settings?.enable_schedule_order || false;
      this.disableDelivery = this.pageData.template?.settings?.disable_delivery || false;
      this.disablePickup = this.pageData.template?.settings?.disable_pickup || false;
      this.disablePayLater = this.pageData.template?.settings?.disable_pay_later || false;
      this.disablePayLaterFor = this.pageData.template?.settings?.disable_pay_later_for || false;
      this.disableImmediateORder = this.pageData.template?.settings?.disable_immediate_order || false;
    } else {
      this.enableScheduleOrder =
        this.appService.disableScheduleOrder != null
          ? !this.appService.disableScheduleOrder
          : false;
      this.disableDelivery = this.appService.disableDelivery || false;
      this.disablePickup = this.appService.disablePickup || false;
      this.disablePayLater = this.appService.disablePayLater || false;
    }

    window.scrollTo({ top: 0 });
    this.currencyService.currentCurrency.pipe(takeUntil(this.destroy$)).subscribe((currency) => {
      this.currentCurrency = currency;
    });
    if (this.isBrowser) {
      const savedCurrency = localStorage.getItem('selectedCurrency');
      if (savedCurrency) {
        const currency = JSON.parse(savedCurrency);
        this.currentCurrency = currency;
      }
    }

    this.getCartInvoiceData();

    if (this.enableScheduleOrder && this.disableImmediateORder && this.serviceName != 'Shipping' && this.serviceName != 'DineIn') {
      this.scheduleOrderOption = 'later';
      this.detectedScheduleOrder = false;
    }

    this.getCompanyData();
    this.addressFormat = this.companyData.settings.addressFormat;
    this.customer.phoneCode = '+' + this.companyData.settings.countryCode;
    this.isPickUpMaxDistance = this.companyData.pickUpMaxDistance > 0;

    this.loadDates();
    this.loadTimes();
    this.loadServices();

    this.getPayments();
    if (this.serviceName == 'Delivery') {
      await this.getCompanyDeliveryAddresses();
    }

    await this.getBranches();

    if (this.serviceName == 'PickUp') {
      if (this.isPickUpMaxDistance) {
        const hasLocation = await this.checkLocationAvailability();

        if (!hasLocation) {
          let hideLocationNotification = localStorage.getItem('hideLocationNotification');
          if (hideLocationNotification != 'true') {
            this.presentAlertLocation({
              title: 'Location Required',
              text: 'Please enable location access to find nearby pickup locations',
              position: 'center',
            });
          }
        } else {
          await this.getNearestBranch();
        }
      }

    } else if (this.serviceName == 'Delivery') {
      await this.getBranchCoveredAddresses1();
      if (this.addressType == 'Governorate') {
        this.address.governorate = this.addressKey;
        this.getCities();
      } else if (this.addressType == 'City') {
        this.address.city = this.addressKey;
        this.getBlocks();
        if (
          this.branchCoveredAddresses &&
          this.branchCoveredAddresses?.list &&
          this.branchCoveredAddresses?.list.length
        ) {
          for (const cAddress of this.branchCoveredAddresses?.list) {
            if (cAddress.City === this.address.city) {
              this.address.governorate = cAddress.Governorate;
              break;
            }
          }
        }
      } else if (this.addressType == 'Block') {
        this.address.block = this.addressKey;
        if (
          this.branchCoveredAddresses &&
          this.branchCoveredAddresses?.list &&
          this.branchCoveredAddresses?.list.length
        ) {
          for (const cAddress of this.branchCoveredAddresses?.list) {
            if (cAddress.Block === this.address.block) {
              this.address.city = cAddress.City;
              this.address.governorate = cAddress.Governorate;
              break;
            }
          }
        }
      }

    } else if (this.serviceName == 'Shipping') {
      // ── FIX: Load shipping settings first so shippingCountries is populated,
      //         then reuse the addressKey already stored in the cart (previously
      //         selected country) — never open the pop on page load.
      this.isInit = true;
      await this.getShippingSetting();

      if (this.addressKey) {
        // Country was already selected in a previous session — restore it silently
        this.address.country = this.addressKey;
      } else if (this.shippingCountries.length) {
        // Fallback: default to first available country and persist to cart
        this.address.country = this.shippingCountries[0].code;
        this.addressKey = this.address.country;
        await this.updateCart();
      }

      // Fetch shipping methods for the restored/defaulted country
      await this.getShippingOptions();
    }

    // ── await getUserData so userData is populated
    await this.getUserData();

    if (sessionId) {
      await this.getCart(sessionId);
    }

    // ── Restore saved user address LAST — after getCart and getUserData have
    //    both fully settled. This prevents the BehaviorSubject re-emission from
    //    getUserData (and setCartInvoiceData from getCart) from overwriting the
    //    restored address via loadAddressData / getCartInvoiceData callbacks.
    if (this.serviceName === 'Delivery') {
      this.restoreSavedUserAddress();
    }

    this.getBranchStatus();
    this.getFilteredDates();
    this.loadingService.hideLoadingSpinner();
  }

  /**
   * Restores a previously selected user address on page entry.
   * Runs LAST in ngOnInit (after getCart + getUserData) so no async
   * callback can overwrite the result.
   *
   * Logic (per the hint):
   *  1. Is there a saved address in localStorage?          → if not, nothing to do
   *  2. Is it a valid address (title + all required fields)?  → if not, clear it
   *  3. Valid → apply it using the live userData.addresses reference so the
   *     address card highlights correctly (reference equality in the template)
   */
  private restoreSavedUserAddress(): void {
    const saved = localStorage.getItem('selectedUserAddress');
    if (!saved) return;

    let savedAddress: any;
    try {
      savedAddress = JSON.parse(saved);
    } catch {
      localStorage.removeItem('selectedUserAddress');
      return;
    }

    if (!savedAddress || !savedAddress.title) {
      localStorage.removeItem('selectedUserAddress');
      return;
    }

    // Determine addressKey from the saved address fields
    let addressKey = '';
    if (savedAddress.governorate) {
      addressKey = savedAddress.governorate;
    } else if (savedAddress.city) {
      addressKey = savedAddress.city;
    } else if (savedAddress.block) {
      addressKey = savedAddress.block;
    }

    if (!addressKey) {
      localStorage.removeItem('selectedUserAddress');
      return;
    }

    // Validate fully against addressFormat. If the saved address is stale or
    // incomplete, clear it so the user is prompted to pick a new one instead
    // of seeing a silently-disabled Place Order button.
    if (!this.isValidAddress(savedAddress, this.addressFormat)) {
      localStorage.removeItem('selectedUserAddress');
      this.appService.selectedUserAddress = null;
      this.selectedAddressValue = null;
      this.address = {};
      return;
    }

    // Try to find the matching address object from the live userData.addresses
    // array so the template's reference-equality check (selectedAddressValue == a)
    // highlights the correct card.
    const liveMatch = this.userData?.addresses?.find(
      (a: any) => a.title === savedAddress.title
    );
    const resolvedAddress = liveMatch || savedAddress;

    // Apply the validated address
    this.address = { ...resolvedAddress };
    this.selectedAddressValue = resolvedAddress;
    this.addressKey = addressKey;
    this.appService.selectedUserAddress = resolvedAddress;
    localStorage.setItem('selectedUserAddress', JSON.stringify(resolvedAddress));

    // Sync cart silently
    this.cartService.changeService({
      sessionId: this.invoiceData.onlineData.sessionId,
      addressKey: addressKey,
      branchId: this.branchId || null,
      serviceName: this.serviceName || null,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: any) => {
        if (data) {
          this.invoiceData = data;
          this.branchId = data.branchId || this.branchId;
          if (this.addressType === 'Governorate') {
            this.getCities();
          } else if (this.addressType === 'City' || this.addressType === 'Block') {
            this.getBlocks();
          }
          this.getBranchStatus();
          this.getFilteredDates();
        }
      },
      error: () => {
        console.warn('Cart sync failed during address restore');
      }
    });
  }

  getCart(sessionId: string) {
    return new Promise((resolve) => {
      this.cartService.getCart(sessionId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (invoiceData: Invoice | null) => {
          if (invoiceData) {
            if (this.isBrowser) {
              this.cartService.setCartInvoiceData(invoiceData);
              // FIX (perf): branch status is no longer fetched inside
              // cartService.getCart — refresh it here at the checkout
              // page entry point, where freshness actually matters.
              this.cartService.checkBranchStatus(invoiceData.branchId, (invoiceData as any).serviceName);
              const auth = localStorage.getItem('auth');
              const notificationSupported = typeof Notification !== 'undefined';
              const permission = notificationSupported ? Notification.permission : 'unsupported';

              if (permission !== 'granted' || !auth) {
              }
            }
            this.discountedByCoupon = invoiceData.lines?.some(line => line.discountedByCoupon);
            resolve(true);
          } else {
            // FIX: previously `resolve(true)` ran synchronously on the line
            // below the createCartSession() call, so the outer Promise
            // resolved before the new sessionId was created. ngOnInit then
            // continued and a fast Place Order click could fire with an
            this.createCartSession().then((data) => {
              resolve(data);
            }).catch(() => {
              resolve(false);
            });
          }
        },
        error: (error) => {
          this.createCartSession().then((data) => {
            resolve(data);
          }).catch(() => {
            resolve(false);
          });
        },
      });
    });
  }

  async createCartSession() {
    return new Promise(async (resolve, reject) => {
      this.cartService.createCart({}).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: Invoice | any) => {
          if (this.isBrowser) {
            localStorage.setItem('sessionId', data.onlineData.sessionId);
          }
          resolve(true);
        },
        error: (err: any) => {
          this.logger.error(err?.message, { stack: err?.stack, context: 'CheckoutComponent.createCartSession' });
          reject(err);
        },
      });
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.isPlacingOrder) {
      event.preventDefault();
    }
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(event: Event) {
    const paymentElement = this.el.nativeElement.querySelector('#end-payments');

    if (paymentElement) {
      const rect = paymentElement.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      this.showCheckout = rect.top <= windowHeight && rect.bottom >= 0;
      this.showContinue = !(rect.top <= windowHeight && rect.bottom >= 0);
    }
  }

  goToPayment() {
    this.showContinue = false;
    this.showCheckout = true;
    this.el.nativeElement
      .querySelector('#scroll-to-summary-payment-methods')
      .scrollIntoView({ behavior: 'smooth' });
  }

  // ── FIX: converted from subscribe-only to a Promise so ngOnInit can await it,
  //         ensuring this.branchId and this.serviceName are set before getBranches()
  getCartInvoiceData(): void {
    this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: Invoice | null) => {
        if (invoiceData) {
          this.isOutOfService = false;
          this.invoiceData = { ...invoiceData };
          this.serviceName = this.invoiceData.serviceName;
          this.serviceId = this.invoiceData.serviceId;
          this.tableId = this.invoiceData.tableId;
          this.branchName = this.invoiceData.branchName;
          this.tableName = this.invoiceData.tableName;
          this.branchId = this.invoiceData.branchId;
          this.addressKey = this.invoiceData.addressKey;
          this.couponId = this.invoiceData.couponId;
          this.promoCoupon = this.invoiceData.promoCoupon;
          if (this.serviceName !== 'DineIn') {
            if (this.disableDelivery && (this.serviceName === 'Delivery' || this.serviceName === 'Shipping')) {
              this.serviceName = null;
              this.addressKey = '';
            }
            if (this.disablePickup && this.serviceName === 'PickUp') {
              this.serviceName = null;
            }
            if (this.appService.shippingType.toLowerCase() !== this.serviceName?.toLowerCase() && this.serviceName === 'Shipping') {
              this.serviceName = null;
            }
          }
        }
      },
      error: (error: any) => this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.fetchCartInvoice' }),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getConvertedPrice(totalPrice: number) {
    var price = totalPrice / (this.currentCurrency.rate || 0) || 0;
    return price.toFixed(this.currentCurrency.afterDecimal);
  }

  /**
   * Returns the translated display label for a covered address.
   * Prefers the translation matching `address.type` (e.g. "Governorate"),
   * falls back to addressKey when no translation is available.
   */
  getTranslatedLabel(address: DeliveryAddress, lang?: 'ar' | 'en'): string {
    const currentLang = (lang ?? this.languageService.$t.currentLang) as 'ar' | 'en';
    if (address.translation && address.type && address.translation[address.type]) {
      return address.translation[address.type][currentLang] || address.addressKey;
    }
    return address.addressKey;
  }

  // Per-line in-flight state for the checkout side panel so out-of-stock
  // line removals get the same fade-out animation as the cart page instead
  // of appearing to hang.
  removingLineIds = new Set<string>();

  isLineBusy(id: string): boolean {
    return this.removingLineIds.has(id);
  }

  removeItem(id: string) {
    if (this.removingLineIds.has(id)) return;
    this.removingLineIds.add(id);
    let sessionId = this.invoiceData.onlineData.sessionId;
    this.cartService.removeItemFromCart({ transactionId: id, sessionId }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: Invoice | null) => {
        if (invoiceData) {
          this.invoiceData = invoiceData;
        }
        this.removingLineIds.delete(id);
      },
      error: () => {
        this.removingLineIds.delete(id);
      },
    });
  }

  getCompanyData() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => {
        this.companyData = data;
      },
    });
  }

  async getPageData() {
    let data = await this.pageBuilderServices.getPage('checkout');

    if (data) {
      this.pageData = data;
    }
  }

  getUserData(): Promise<void> {
    return new Promise((resolve) => {
      this.authService.userData$.pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: any) => {
          if (data && data.id) {
            this.userData = {};
            this.detectedCustomerData = false;
            this.isPhoneValidated = false;
            this.userData = data;
            this.selectedAddressValue = this.appService.selectedUserAddress || null;
            this.loadUserSavedData();
            resolve();
          } else {
            // No user logged in — resolve so init does not hang
            this.loadUserSavedData();
            resolve();
          }
        },
        error: () => resolve(),
      });
    });
  }

  /**
   * Load user data with proper priority:
   * 1. Logged-in user data takes precedence
   * 2. localStorage used only as fallback for non-authenticated users
   * 3. Address data follows address-type-specific logic
   */
  loadUserSavedData() {
    const isUserLoggedIn = !!this.userData?.id;

    if (isUserLoggedIn) {
      this.loadLoggedInUserData();
    } else {
      this.loadCachedUserData();
    }

    this.loadAddressData();
    this.validateLoadedData();
  }

  private loadLoggedInUserData() {
    if (!this.userData?.id) return;

    this.customer.name = this.userData.name || '';
    this.customer.phoneCode = this.userData.phoneCode || '+' + this.companyData.settings.countryCode;
    this.customer.phoneNumber = this.userData.phoneNumber || '';
    this.customer.phone = this.userData.phone || '';
    this.customer.email = this.userData.email || '';

    if (!this.customer.phone && this.userData.phoneCode && this.userData.phoneNumber) {
      this.customer.phone = this.userData.phoneCode + this.userData.phoneNumber;
    }

    this.isPhoneValidated = this.userData.isPhoneValidated || false;

    if (
      this.customer.name &&
      (this.customer.phone || (this.customer.phoneCode && this.customer.phoneNumber)) &&
      this.isPhoneValidated
    ) {
      this.detectedCustomerData = true;
    } else {
      this.detectedCustomerData = false;
    }
  }

  private loadCachedUserData() {
    const checkoutCustomer = localStorage.getItem('checkoutCustomer');

    if (!checkoutCustomer) {
      return;
    }

    try {
      const checkoutCustomerData = JSON.parse(checkoutCustomer);

      if (checkoutCustomerData.name) {
        this.customer.name = checkoutCustomerData.name;
      }
      if (checkoutCustomerData.phoneCode) {
        this.customer.phoneCode = checkoutCustomerData.phoneCode;
      }
      if (checkoutCustomerData.phoneNumber) {
        this.customer.phoneNumber = checkoutCustomerData.phoneNumber;
      }
      if (checkoutCustomerData.isPhoneValidated) {
        this.isPhoneValidated = checkoutCustomerData.isPhoneValidated;
      }
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.parseCachedCustomerData' });
    }
  }

  private loadAddressData() {
    // Note: saved user address (selectedUserAddress) is handled by
    // restoreSavedUserAddress() in ngOnInit — skip it here to avoid conflicts.
    // If a valid user address is already selected, don't let generic
    // checkoutAddress (which has no `title`) overwrite it.
    if (this.selectedAddressValue) {
      return;
    }

    // Generic address restore (non-logged-in or no saved user address)
    const checkoutAddress = localStorage.getItem('checkoutAddress');
    if (!checkoutAddress) return;

    try {
      const checkoutAddressData = JSON.parse(checkoutAddress);
      if (!checkoutAddressData || Object.keys(checkoutAddressData).length === 0) return;

      if (
        this.appService.shippingType.toLowerCase() === this.serviceName?.toLowerCase() &&
        this.serviceName === 'Shipping'
      ) {
        this.address.city = checkoutAddressData.city || '';
        this.address.addressLine1 = checkoutAddressData.addressLine1 || '';
        this.address.addressLine2 = checkoutAddressData.addressLine2 || '';
        this.address.state = checkoutAddressData.state || '';
        this.address.region = checkoutAddressData.region || '';
        this.address.zipCode = checkoutAddressData.zipCode || '';
      } else {
        const isValidAddressForType = this.isValidAddressKeyMatch(checkoutAddressData);
        if (isValidAddressForType) {
          this.address = { ...checkoutAddressData };
        }
      }
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.parseCachedAddressData' });
    }
  }

  private isValidAddressKeyMatch(checkoutAddressData: any): boolean {
    if (this.addressType === 'Governorate') {
      return checkoutAddressData.governorate === this.addressKey;
    } else if (this.addressType === 'City') {
      return checkoutAddressData.city === this.addressKey;
    } else if (this.addressType === 'Block') {
      return checkoutAddressData.block === this.addressKey;
    }
    return false;
  }

  private validateLoadedData() {
    if (this.serviceName === 'Shipping' && this.address.country) {
      this.customer.phoneCode = this.getPhoneCodeFromCountry(this.address.country);
    }

    if (this.userData?.id && this.customer.phoneCode && this.customer.phoneNumber) {
      this.checkPhoneValidate();
    }
  }

  loadDates() {
    var dates = [];
    var today = new Date();
    for (var i = 0; i < 62; i++) {
      var date = new Date(today);
      date.setDate(today.getDate() + i);
      var year = date.getFullYear();
      var month = String(date.getMonth() + 1).padStart(2, '0');
      var day = String(date.getDate()).padStart(2, '0');
      var formattedDate = `${year}-${month}-${day}`;
      dates.push(formattedDate);
    }
    this.dates = dates;
  }

  loadTimes() {
    var times = [];
    for (var i = 0; i < 24; i++) {
      for (var j = 0; j <= 30; j += 30) {
        var hour = String(i).padStart(2, '0');
        var minute = String(j).padStart(2, '0');
        var time = `${hour}:${minute}`;
        times.push(time);
      }
    }
    this.times = times;
  }

  getPayments() {
    this.payments.push({
      id: "cash",
      name: "Cash",
      image: "/assets/images/payments/cash.png"
    });
    this.selectedPayment = "Cash";
    this.paymentService.getPaymentsMethods().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        if (data) {
          data.forEach((element: any) => {
            if (element.icon == 'Debit Card') {
              element.image = '/assets/images/payments/debit-card.svg';
            } else if (element.icon == 'Credit Card') {
              element.image = '/assets/images/payments/credit-card.svg';
            } else {
              if (element.name.toLowerCase() == "afs") {
                element.image = "/assets/images/payments/afs.png"
              } else if (element.name.toLowerCase() == "benefitpay") {
                element.image = "/assets/images/payments/benefitpay.png"
              } else if (element.name.toLowerCase() == "thawanipayment") {
                element.image = "/assets/images/payments/thawanipayment.png"
              } else if (element.name.toLowerCase() == "tappayment") {
                element.image = "/assets/images/payments/tappayment.png"
              } else if (element.name.toLowerCase() == "benefit") {
                element.image = "/assets/images/payments/benefit.png"
              } else if (element.name.toLowerCase() == "gatee") {
                element.image = "/assets/images/payments/gatee.png"
              } else if (element.name.toLowerCase() == "credimax ecr") {
                element.image = "/assets/images/payments/credimax.png"
              } else if (element.name.toLowerCase() == "aps ecr") {
                element.image = "/assets/images/payments/aps.png"
              }
            }
            this.payments.push(element);
          });
        }
      },
    });
  }

  async getBranches() {
    return new Promise((response) => {
      this.branchService.getBranchList().pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => {
          if (data) {
            // Filter only online available branches
            this.branches = data.filter(
              (branch: Branch) => branch.onlineAvailability
            );
            // ── SORT: Alphabetically by branch name
            this.branches = this.branches.sort((a: Branch, b: Branch) =>
              (a.name || '').localeCompare(b.name || '')
            );
          }
          response(true);
        },
        error: (error: any) => {
          this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.fetchBranches' });
          response(false);
        },
      });
    });
  }

  presentAlertLocation(param: any) {
    if (param.position === 'center') {
      this.alertService.showAlert({ title: param.title, subtitle: param.text });
    } else {
      this.alertService.showAlert({
        title: param.title,
        subtitle: param.text || '',
      });
    }
  }

  getCompanyDeliveryAddresses(): Promise<boolean> {
    return new Promise((resolve) => {
      this.companyService.getCompanyDeliveryAddresses().pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => {
          if (data) {
            this.addresses = [];
            if (data.deliveryAreaType == "zones") {
              this.addressType = 'zones';
              this.branches = data.branches || [];
              this.addresses = data.addresses || [];
            } else {
              if (Array.isArray(data.addresses)) {
                if (data.addresses?.length) {
                  data.addresses?.forEach((element: any) => {
                    if (element.type == "Governorate") {
                      this.governorateAddresses.push(element);
                    } else if (element.type == 'City') {
                      this.cityAddresses.push(element);
                    } else if (element.type == 'Block') {
                      this.blockAddresses.push(element);
                    }
                    this.addressType = element.type || null;
                    this.addresses.push(element);
                  });
                }
                // ── SORT: Alphabetically by translated label
                const lang = this.languageService.$t.currentLang as 'ar' | 'en';
                this.governorateAddresses = this.governorateAddresses.sort((a: any, b: any) =>
                  (this.getTranslatedLabel(a, lang) || a.addressKey || '').localeCompare(this.getTranslatedLabel(b, lang) || b.addressKey || '')
                );
                this.cityAddresses = this.cityAddresses.sort((a: any, b: any) =>
                  (this.getTranslatedLabel(a, lang) || a.addressKey || '').localeCompare(this.getTranslatedLabel(b, lang) || b.addressKey || '')
                );
                this.blockAddresses = this.blockAddresses.sort((a: any, b: any) =>
                  (this.getTranslatedLabel(a, lang) || a.addressKey || '').localeCompare(this.getTranslatedLabel(b, lang) || b.addressKey || '')
                );
              }
            }
          }
          resolve(true);
        },
        error: () => resolve(false),
      });
    });
  }

  getBranchCoveredAddresses1() {
    return new Promise((response) => {
      if (this.branchId) {
        this.branchService.getBranchCoveredAddresses(this.branchId).pipe(takeUntil(this.destroy$)).subscribe({
          next: (data) => {
            if (data) {
              this.branchCoveredAddresses = data;
              this.isLoadedBranchCoveredAddresses = true;
              response(true);
            } else {
              response(false);
            }
          },
        });
      } else {
        response(false);
      }
    });
  }

  loadServices() {
    if (this.serviceName == 'DineIn') {
      this.services.push('DineIn');
    } else {
      if (!this.disableDelivery) {
        if (this.appService.shippingType == 'shipping') {
          this.services.push('Shipping');
        } else {
          this.services.push('Delivery');
        }
      }
      if (!this.disablePickup) {
        this.services.push('PickUp');
      }
    }
  }

  getGLocation = () => {
    return new Promise(async (resolve, reject) => {
      try {
        // FIX: see appServices.getGLocation — cap at 3s so a hanging
        // ipinfo.io request can't stall the checkout page.
        const response = await fetch('https://ipinfo.io/json', {
          signal: AbortSignal.timeout(3000),
        });
        const data = await response.json();
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  };

  isNotEmpty(text: string): boolean | any {
    try {
      return text && text.trim() !== '';
    } catch (error) {
      console.warn('Error checking if text is empty:', error);
      return false;
    }
  }

  async selectService(service: any) {
    if (
      service == 'Delivery' &&
      !this.isLoadedBranchCoveredAddresses
    ) {
      await this.getBranchCoveredAddresses1();
    }
    if (this.enableScheduleOrder && this.disableImmediateORder && service != 'Shipping' && service != 'DineIn') {
      this.scheduleOrderOption = "later";
      this.detectedScheduleOrder = false;
    } else {
      this.scheduleOrderOption = "now";
    }
    this.selectScheduleOrderOption();
    this.getFilteredDates();
    this.getBranchStatus();
    if (service == 'Delivery') {
      setTimeout(() => {
        this.showDeliverySelectorPop();
      }, 300);
      localStorage.setItem('checkout', 'yes');
    } else if (service == 'PickUp') {
      this.selectedShipping = null;
      setTimeout(() => {
        this.showPickupSelectorPop();
      }, 300);
    } else if (service == 'Shipping') {
      if (!this.shippingCountries?.length) {
        await this.getShippingSetting();
      }
      this.branchId = this.shippingBranchId;
      this.address.country = this.shippingCountries[0].code;
      this.addressKey = this.address.country;
      this.showShippingSelectorPop();
    } else {
      await this.updateCart();
    }
  }

  selectBranch(branch?: any) {
    if (branch) {
      this.branchId = branch.id;
    }

    this.getBranchStatus();
    this.updateCart().then(async (data) => {
      if (data) {
        this.date = '';
        this.time = '';
        this.getFilteredDates();
        this.filteredTimes = [];
      } else {
        this.alertService.showAlert({
          title: 'Failed to load data at this moment, please try again later.',
        });
      }
    });
  }

  async getNearestBranch() {
    try {
      console.time('get Position');
      const current_center = await this.getPosition();
      if (!current_center) return 0;
      console.timeEnd('get Position');

      console.time('get distance');
      const updatedBranches: any = this.branches.map((branch: any) => {
        if (branch.location?.lat && branch.location?.lng) {
          const distance = this.getDistanceFromLatLonInKm(
            branch.location.lat,
            branch.location.lng,
            current_center[0],
            current_center[1]
          );
          return {
            ...branch,
            distanceFromLocation: distance,
            isCovered: distance <= this.companyData.pickUpMaxDistance,
          };
        }
        return branch;
      });
      console.timeEnd('get distance');

      this.branches = updatedBranches;

      // After distances calculated, set isOutOfService based on selected branch
      if (this.branchId) {
        const selectedBranch = this.branches.find((b: any) => b.id === this.branchId);
        this.isOutOfService = selectedBranch ? !selectedBranch.isCovered : false;
      } else {
        this.isOutOfService = false;
      }

      return updatedBranches.filter((f: any) => f.isCovered === true).length;
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.location' });
      return 0;
    }
  }

  async checkLocationAvailability(): Promise<boolean> {
    try {
      if (!navigator.geolocation) {
        return false;
      }

      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state === 'denied') {
          return false;
        }
        if (permission.state === 'granted') {
        }
      }

      try {
        const position = await this.getPositionWithTimeout(15000);
        return position !== null && position !== undefined;
      } catch (error: any) {
        this.handleLocationError(error);
        return false;
      }

    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.locationAvailability' });
      return false;
    }
  }

  private getPositionWithTimeout(timeout: number = 15000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject({ code: 3, message: 'Location request timed out' });
      }, timeout);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          resolve([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        {
          enableHighAccuracy: false,
          timeout: timeout - 1000,
          maximumAge: 300000,
        }
      );
    });
  }

  private handleLocationError(error: any) {
    if (error.code === 1 || error.err === 'denied') {
    } else if (error.code === 2) {
    } else if (error.code === 3) {
    } else {
    }
  }

  isValidName(name: any) {
    if (!name) {
      return false;
    }
    name = name.trim();
    const regex = /^[\p{L}\s]+$/u;
    if (!regex.test(name)) {
      return false;
    }
    return true;
  }

  isValidPhoneNumber(phoneNumber: any) {
    const phone = phoneNumber?.toString() ?? '';
    return phone.length >= 8 && !/\s/.test(phone);
  }

  isValidEmail(email: any) {
    if (!email || !email.trim()) {
      return true; // optional field — empty is valid
    }
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email.trim());
  }

  updateCart() {
    return new Promise((response) => {
      this.errorChangeService = false;
      this.cartService
        .changeService({
          sessionId: this.invoiceData.onlineData.sessionId,
          addressKey: this.addressKey || null,
          branchId: this.branchId || null,
          serviceName: this.serviceName || null,
        })
        .pipe(takeUntil(this.destroy$)).subscribe({
          next: (data) => {
            if (data) {

              if (this.enableScheduleOrder && this.disableImmediateORder && this.serviceName != 'Shipping' && this.serviceName != 'DineIn') {
                this.scheduleOrderOption = "later";
                this.detectedScheduleOrder = false;
              } else {
                this.scheduleOrderOption = "now";
              }
              this.selectScheduleOrderOption();

              this.invoiceData = data;

              this.serviceName = data.serviceName;
              this.serviceId = data.serviceId;
              this.branchId = data.branchId;
              this.branchName = data.branchName;
              this.addressKey = data.addressKey;

              if (this.branchId && this.branches) {
                if (
                  this.isBranchHaveWorkingTimes(this.branchId, this.branches)
                ) {
                  this.getFilteredDates();
                } else {
                  this.branchStatus = 'close';
                }
                this.getBranchStatus();
                response(data);
              } else {
                response(data);
              }
            } else {
              this.errorChangeService = true;
              response(false);
            }
          },
        });
    });
  }

  isBranchHaveWorkingTimes(branchId: string, branchesData: any) {
    const targetBranch = branchesData.find(
      (branch: any) => branch.id === branchId
    );
    if (targetBranch) {
      if (this.serviceName == 'PickUp' && targetBranch.workingSchedule) {
        return true;
      } else if (
        this.serviceName == 'Delivery' &&
        (targetBranch.deliveryTimes || targetBranch.workingSchedule)
      ) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  getPhoneCodeFromCountry(country: any) {
    let foundData = this.countries?.find((item) => item.code === country);
    return foundData ? foundData.dial_code : '+973';
  }

  /**
   * Ensures branchCoveredAddresses is populated.
   * If branchId is still missing (e.g. map not confirmed yet) it calls updateCart
   * first which returns the assigned branchId, then fetches covered addresses.
   */
  private async ensureCoveredAddressesLoaded(): Promise<boolean> {
    if (this.isLoadedBranchCoveredAddresses && this.branchCoveredAddresses?.list?.length) {
      return true;
    }
    if (!this.branchId) {
      await this.updateCart();
    }
    if (this.branchId) {
      this.isLoadedBranchCoveredAddresses = false;
      await this.getBranchCoveredAddresses1();
      return this.isLoadedBranchCoveredAddresses;
    }
    return false;
  }

  selectGovernorate() {
    return new Promise(async (response) => {
      if (this.addressType == 'Governorate') {
        this.addressKey = this.address.governorate;
      }
      this.address.city = undefined;
      this.address.block = undefined;
      this.cities = [];
      this.blocks = [];

      await this.ensureCoveredAddressesLoaded();

      this.updateCart().then((data) => {
        if (data) {
          this.getCities();
          response(true);
        } else {
          this.alertService.showAlert({
            title: 'Failed to load data at this moment, please try again later.',
          });
        }
      });
    });
  }

  getCities() {
    this.cities = [];
    if (this.address.governorate) {
      if (
        this.branchCoveredAddresses &&
        this.branchCoveredAddresses?.list &&
        this.branchCoveredAddresses?.list.length
      ) {
        this.branchCoveredAddresses?.list.forEach((listItem: any) => {
          if (listItem.Governorate == this.address.governorate) {
            this.cities.push(listItem.City);
          }
        });
      }
    }
    this.cities = this.cities.filter((value: any, index: any, self: any) => {
      return self.indexOf(value) === index;
    });
    // ── SORT: Alphabetically by city name
    this.cities = this.cities.sort((a: string, b: string) =>
      (a || '').localeCompare(b || '')
    );
  }

  selectCity() {
    return new Promise(async (response) => {
      if (this.addressType == 'City') {
        this.addressKey = this.address.city;
      }
      this.address.block = undefined;
      this.blocks = [];

      await this.ensureCoveredAddressesLoaded();

      this.updateCart().then((data) => {
        if (data) {
          if (this.branchCoveredAddresses?.list) {
            for (const cAddress of this.branchCoveredAddresses.list) {
              if (cAddress.City === this.address.city) {
                this.address.governorate = cAddress.Governorate;
                break;
              }
            }
          }
          this.getBlocks();
          response(true);
        } else {
          this.alertService.showAlert({
            title: 'Failed to load data at this moment, please try again later.',
          });
          response(false);
        }
      });
    });
  }

  onCityChange() {
    this.selectCity();
  }

  getBlocks() {
    this.blocks = [];
    if (this.address.city) {
      if (
        this.branchCoveredAddresses &&
        this.branchCoveredAddresses?.list &&
        this.branchCoveredAddresses?.list.length
      ) {
        this.branchCoveredAddresses?.list.forEach((listItem: any) => {
          if (listItem.City == this.address.city) {
            this.blocks.push(listItem.Block);
          }
        });
      }
    }
    // ── SORT: Alphabetically by block name
    this.blocks = this.blocks.sort((a: string, b: string) =>
      (a || '').localeCompare(b || '')
    );
  }

  selectBlock() {
    return new Promise(async (response) => {
      if (this.addressType == 'Block') {
        this.addressKey = this.address.block;
      }

      await this.ensureCoveredAddressesLoaded();

      this.updateCart().then((data) => {
        if (data) {
          if (this.branchCoveredAddresses?.list) {
            for (const cAddress of this.branchCoveredAddresses.list) {
              if (cAddress.Block === this.address.block) {
                this.address.city = cAddress.City;
                this.address.governorate = cAddress.Governorate;
                break;
              }
            }
          }
          response(true);
        } else {
          this.alertService.showAlert({
            title: 'Failed to load data at this moment, please try again later.',
          });
          response(false);
        }
      });
    });
  }

  filterDatesByWorkingTimes(dates: any, branchId: any, branchesData: any) {
    const skipDays =
      this.pageData.template?.settings?.start_day_for_schedule_order || 0;
    dates = dates.slice(skipDays);

    const branch = branchesData.find((branch: any) => branch.id === branchId);
    if (this.serviceName == 'PickUp') {
      if (!branch || !branch.workingSchedule) {
        return [];
      }
    } else if (this.serviceName == 'Delivery') {
      if (!branch || !branch.deliveryTimes) {
        return [];
      }
    }
    const filteredDates = dates.filter((date: any) => {
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
      });
      let workingHours = null;
      if (this.serviceName == 'PickUp') {
        workingHours = branch.workingSchedule[dayOfWeek];
      } else if (this.serviceName == 'Delivery') {
        workingHours = branch.deliveryTimes[dayOfWeek];
      }
      return workingHours && workingHours.length > 0;
    });
    let i = 0;
    filteredDates.forEach((date: any) => {
      if (
        !(
          this.filterTimesByWorkingTimesAndDate(
            this.times,
            date,
            this.branchId,
            this.branches
          ).length > 0
        )
      ) {
        filteredDates.splice(i, 1);
        i--;
      }
      i++;
    });
    return filteredDates;
  }

  filterTimesByWorkingTimesAndDate(
    times: string[],
    selectedDate: Date,
    branchId: string,
    branchesData: {
      id: string;
      workingSchedule?: Record<string, { from: string; to: string }[]>;
      deliveryTimes?: Record<string, { from: string; to: string }[]>;
    }[]
  ): string[] {
    let branch: any = branchesData.find((branch) => branch.id === branchId);

    if (this.serviceName === 'PickUp') {
      if (!branch || !branch.workingSchedule) {
        return [];
      }
    } else if (this.serviceName === 'Delivery') {
      if (!branch || !branch.deliveryTimes) {
        return [];
      }
    }

    const dayOfWeek = new Date(selectedDate).toLocaleDateString('en-US', {
      weekday: 'long',
    });
    let workingHours: { from: string; to: string }[] | undefined = undefined;

    if (this.serviceName === 'PickUp') {
      workingHours = branch.workingSchedule[dayOfWeek];
    } else if (this.serviceName === 'Delivery') {
      workingHours = branch.deliveryTimes[dayOfWeek];
    }

    if (!workingHours) {
      return [];
    }

    const currentTime = new Date();
    const filteredTimes = times.filter((time) => {
      const [hours, minutes] = time.split(':');
      const timeValue = new Date(selectedDate);
      timeValue.setHours(Number(hours));
      timeValue.setMinutes(Number(minutes));

      return (
        timeValue >= currentTime &&
        workingHours.some(({ from, to }) => {
          const [fromHours, fromMinutes] = from.split(':');
          const [toHours, toMinutes] = to.split(':');
          const fromTime = new Date(selectedDate);
          const toTime = new Date(selectedDate);
          fromTime.setHours(Number(fromHours));
          fromTime.setMinutes(Number(fromMinutes));
          toTime.setHours(Number(toHours));
          toTime.setMinutes(Number(toMinutes));

          return timeValue >= fromTime && timeValue <= toTime;
        })
      );
    });
    return filteredTimes;
  }

  selectScheduleOrderOption() {
    this.time = '';
    this.date = '';
    this.filteredTimes = [];
    this.getBranchStatus();
  }

  selectDate() {
    this.time = '';
    this.getBranchStatus();
    this.filteredTimes = [];
    if (this.date) {
      this.filteredTimes = this.filterTimesByWorkingTimesAndDate(
        this.times,
        this.date,
        this.branchId,
        this.branches
      );
      if (this.filteredTimes.length > 0) {
        this.branchStatus = 'open';
      } else {
        this.branchStatus = 'close';
      }
    }
  }

  getDayDescription(dateString: any) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const inputDate = new Date(dateString);
    if (
      inputDate.getFullYear() === today.getFullYear() &&
      inputDate.getMonth() === today.getMonth() &&
      inputDate.getDate() === today.getDate()
    ) {
      return 'Today';
    } else if (
      inputDate.getFullYear() === tomorrow.getFullYear() &&
      inputDate.getMonth() === tomorrow.getMonth() &&
      inputDate.getDate() === tomorrow.getDate()
    ) {
      return 'Tomorrow';
    } else {
      return dateString;
    }
  }

  selectTime() {
    if (this.date && this.time) {
      this.detectedScheduleOrder = true;
      this.branchStatus = 'open';
    }
  }

  convertToAmPm(time: any) {
    var hour = parseInt(time.substr(0, 2));
    var minute = time.substr(3, 2);
    var period = hour < 12 ? 'AM' : 'PM';
    if (hour === 0) {
      hour = 12;
    } else if (hour > 12) {
      hour -= 12;
    }
    return hour + ':' + minute + ' ' + period;
  }

  isDisableCheckoutButton() {
    // FIX: visually disable the button while a checkOut request is in flight
    // so the user cannot trigger a duplicate request mid-submission.
    if (this.isPlacingOrder) {
      return true;
    }
    if (!this.isValidName(this.customer.name) && this.serviceName != 'DineIn') {
      return true;
    } else if (
      this.selectedOption == 'points' &&
      !(this.usedPoints > 0 && this.pointsDiscount != 0)
    ) {
      return true;
    } else if (
      !this.isValidPhoneNumber(this.customer.phoneNumber) &&
      !this.isValidPhoneNumber(this.customer.phone) &&
      this.serviceName != 'DineIn'
    ) {
      return true;
    } else if (
      this.serviceName == 'Delivery' &&
      !this.isValidAddress(this.address, this.addressFormat)
    ) {
      return true;
    } else if (
      this.serviceName == 'Shipping' &&
      (!this.isValidShippingAddress() || !this.selectedShipping)
    ) {
      return true;
    } else if (!this.serviceName) {
      return true;
    } else if (!this.branchId && this.serviceName == 'PickUp') {
      return true;
    } else if (!this.selectedPayment) {
      return true;
    } else if (
      this.serviceName == 'Delivery' &&
      this.invoiceData?.minimumOrder > this.invoiceData?.subTotal
    ) {
      return true;
    } else if (
      this.branchStatus != 'open' &&
      this.branchStatus != null &&
      this.serviceName != 'DineIn' &&
      this.serviceName != 'Shipping'
    ) {
      return true;
    } else if (
      !this.isTimeBetweenFilteredTimes() &&
      this.serviceName != 'DineIn' &&
      this.serviceName != 'Shipping'
    ) {
      return true;
    } else if (
      this.scheduleOrderOption == 'later' &&
      (!this.time || !this.date) &&
      this.serviceName != 'DineIn' &&
      this.serviceName != 'Shipping'
    ) {
      return true;
    }
    else if (this.getCountOutStockProducts() > 0) {
      return true;
    }
    else if (this.isOutOfService) {
      return true;
    }
    else {
      return false;
    }
  }

  isValidAddress(addressData: any, addressFormat: any): boolean {
    if (!addressData) {
      console.warn('Address data is null or undefined');
      return false;
    }

    if (Object.keys(addressData).length === 0) {
      console.warn('Address data is empty');
      return false;
    }

    if (this.userData?.id) {
      if (!this.isNotEmpty(addressData?.title)) {
        console.warn('Saved address missing title field');
        return false;
      }
    }

    if (!addressFormat || !Array.isArray(addressFormat)) {
      console.warn('Address format is not defined properly');
      return true;
    }

    for (const field of addressFormat) {
      if (field.isRequired) {
        const fieldValue = addressData[field.key];
        if (!fieldValue) {
          console.warn(`Required field '${field.key}' is missing`, {
            field: field,
            value: fieldValue,
          });
          return false;
        }
        if (typeof fieldValue === 'string' && !this.isNotEmpty(fieldValue)) {
          console.warn(`Required field '${field.key}' is empty or whitespace`, {
            field: field,
            value: fieldValue,
          });
          return false;
        }
      }
    }
    return true;
  }

  isValidShippingAddress() {
    if (!this.isNotEmpty(this.address.country)) {
      return false;
    }
    if (!this.isNotEmpty(this.address.city)) {
      return false;
    }
    if (!this.isNotEmpty(this.address.addressLine1)) {
      return false;
    }
    return true;
  }

  isTimeBetweenFilteredTimes() {
    if (this.scheduleOrderOption == 'later') {
      if (this.filteredTimes.length) {
        return this.filteredTimes.includes(this.time);
      } else {
        return true;
      }
    } else {
      return true;
    }
  }

  getCountOutStockProducts() {
    let counter = 0;
    if (this.invoiceData?.lines) {
      this.invoiceData?.lines.forEach((line: any) => {
        if (line.outOfStock) {
          counter++;
        }
      });
    }
    return counter;
  }

  clearCheckoutCache() {
    try {
      localStorage.removeItem('checkoutCustomer');
      localStorage.removeItem('checkoutAddress');
      localStorage.removeItem('selectedUserAddress');
      localStorage.removeItem('orderPlaced');
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.clearCheckoutCache' });
    }
  }

  async placeOrder() {
    // Guard against any double-call — set the flag immediately on entry so
    // rapid taps, the mobile sticky button (which has no [disabled] binding),
    // and the modal callback path (validatePhone → placeOrder) are all blocked.
    // The flag is cleared on every early-return validation failure below so
    // the user can correct their input and try again.
    if (this.isPlacingOrder) {
      return;
    }
    this.isPlacingOrder = true;

    if (this.userData?.id) {
    }

    const locationData = localStorage.getItem('deliveryLocation');

    if (locationData) {
      try {
        const locationObject = JSON.parse(locationData);
        this.lng = locationObject.lng;
        this.lat = locationObject.lat;
      } catch (error: any) {
        this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.parseLocalStorageJSON' });
      }
    }

    if (!this.customer.phone && this.customer.phoneCode && this.customer.phoneNumber) {
      this.customer.phone = this.customer.phoneCode + this.customer.phoneNumber;
    } else if (
      this.customer.phone &&
      this.customer.phoneCode &&
      this.customer.phoneNumber &&
      this.customer.phone != (this.customer.phoneCode + this.customer.phoneNumber)
    ) {
      this.customer.phone = this.customer.phoneCode + this.customer.phoneNumber;
    }

    this.customer.isPhoneValidated = this.isPhoneValidated;
    let customer = { ...this.customer };
    let address = { ...this.address };

    if (!this.userData?.id) {
      localStorage.setItem('checkoutCustomer', JSON.stringify(this.customer));
      localStorage.setItem('checkoutAddress', JSON.stringify(this.address));
    }

    localStorage.setItem('orderPlaced', 'true');

    if (!this.serviceName) {
      const element = document.getElementById('scroll-to-service-options');
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
      this.isPlacingOrder = false;
      return;
    }
    if (!this.branchId && this.serviceName == 'PickUp') {
      this.alertService.showAlert({ title: 'Please select the branch' });
      const element = document.getElementById('scroll-to-select-branch');
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
      this.isPlacingOrder = false;
      return;
    }

    if (!this.isValidName(customer.name) && this.serviceName != 'DineIn') {
      this.alertService.showAlert({ title: 'Please enter a valid name' });
      const element = document.getElementById('scroll-to-customer-details-name');
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
      this.isPlacingOrder = false;
      return;
    }
    if (
      !this.isValidPhoneNumber(customer.phone) &&
      this.serviceName != 'DineIn'
    ) {
      this.alertService.showAlert({
        title: 'Please enter a valid phone number',
      });
      const element = document.getElementById('scroll-to-customer-details-phone');
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
      this.isPlacingOrder = false;
      return;
    }
    if (this.authKey) {
      this.walletSettings = await this.walletServiceService.getWalletSettings();
      if (
        this.selectedOption == 'points' &&
        !this.walletSettings.pointsSettings!.enabled
      ) {
        this.alertService.showAlert({
          title: this.translate2.instant('PROMOTIONS.USING_POINTS_IS_NOT_AVAILABLE'),
        });
        this.isPlacingOrder = false;
        return;
      }
    }

    if (
      this.serviceName == 'Delivery' &&
      !this.isValidAddress(address, this.addressFormat)
    ) {
      this.alertService.showAlert({
        title: 'Please enter a valid delivery address details',
      });
      const element = document.getElementById('scroll-to-delivery-address');
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
      this.isPlacingOrder = false;
      return;
    }

    // ── For logged-in users entering a new address, block duplicate titles.
    if (
      this.serviceName == 'Delivery' &&
      this.userData?.id &&
      !this.selectedAddressValue &&
      address?.title?.trim()
    ) {
      const newTitleLower = address.title.trim().toLowerCase();
      const isDuplicate = (this.userData?.addresses || []).some(
        (a: any) => a.title?.trim().toLowerCase() === newTitleLower
      );
      this.addressTitleDuplicate = isDuplicate;
      if (isDuplicate) {
        const element = document.getElementById('scroll-to-delivery-address');
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        }
        this.isPlacingOrder = false;
        return;
      }
    }

    if (
      this.serviceName == 'Shipping' &&
      !this.isValidShippingAddress()
    ) {
      this.alertService.showAlert({
        title: 'Please enter all shipping address',
      });
      const element = document.getElementById('scroll-to-shipping-address');
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
      this.isPlacingOrder = false;
      return;
    } else if (this.serviceName == 'Shipping' && !this.selectedShipping) {
      this.alertService.showAlert({
        title: 'Please enter all shipping details',
      });
      const element = document.getElementById('scroll-to-shipping-details');
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
      this.isPlacingOrder = false;
      return;
    }
    if (!this.selectedPayment) {
      this.alertService.showAlert({
        title: 'Please select the payment method',
      });
      const element = document.getElementById('scroll-to-summary-payment-methods');
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
      this.isPlacingOrder = false;
      return;
    }
    if (
      this.serviceName == 'Delivery' &&
      this.invoiceData?.minimumOrder > this.invoiceData?.subTotal
    ) {
      this.alertService.showAlert({
        title:
          'Minimum order is: ' +
          this.companyData.settings['currencySymbol'] +
          ' ' +
          this.invoiceData?.minimumOrder,
      });
      const element = document.getElementById('scroll-to-summary-totals');
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
      this.isPlacingOrder = false;
      return;
    }
    if (this.scheduleOrderOption == "later") {
      if (!this.time || !this.date) {
        this.alertService.showAlert({ title: 'Please select date and time' });
        const element = document.getElementById('scroll-to-schedule-order');
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        }
        this.isPlacingOrder = false;
        return;
      }
      if (!this.isTimeBetweenFilteredTimes()) {
        this.alertService.showAlert({
          title: 'Please check schedule order time',
        });
        const element = document.getElementById('scroll-to-schedule-order');
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        }
        this.isPlacingOrder = false;
        return;
      }
    } else {
      this.time = '';
      this.date = '';
    }

    if (
      this.branchStatus != 'open' &&
      this.branchStatus != null &&
      this.serviceName != 'DineIn' &&
      this.serviceName != 'Shipping'
    ) {
      if (this.branchStatus == 'close') {
        this.alertService.showAlert({
          title: 'Branch is close',
          subtitle: this.enableScheduleOrder
            ? 'Please select other date or time to place your order.'
            : '',
        });
      } else if (this.branchStatus == 'busy') {
        this.alertService.showAlert({
          title: 'Branch is busy',
          subtitle: this.enableScheduleOrder
            ? 'Please select other date or time to place your order.'
            : '',
        });
      }
      const element = document.getElementById('scroll-to-schedule-order');
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
      this.isPlacingOrder = false;
      return;
    }
    if (this.getCountOutStockProducts() > 0) {
      this.alertService.showAlert({
        title:
          'There are ' +
          this.getCountOutStockProducts() +
          " product's out of stock",
      });
      const element = document.getElementById('scroll-to-summary-products');
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
      this.isPlacingOrder = false;
      return;
    }

    this.payments.forEach((paymnt: any) => {
      if (paymnt.name == this.selectedPayment) {
        this.payment = paymnt;
      }
    });
    if (this.payment.name == null) {
      this.selectedPayment = 'Cash';
      this.payment.name = 'Cash';
      this.isPlacingOrder = false;
      return;
    }

    if (!this.appService.disableOtp) {
      if (!this.isPhoneValidated && this.serviceName != 'DineIn') {
        // Release the lock before opening the modal — the modal callback will
        // call placeOrder() again after successful OTP verification and the
        // lock at the top of this function will guard that re-entry correctly.
        this.isPlacingOrder = false;
        this.validatePhone();
        return;
      }
    }

    // All validation passed — proceed with the HTTP call.
    let sessionId = this.invoiceData?.onlineData?.sessionId || (typeof localStorage !== 'undefined' ? localStorage.getItem('sessionId') : null);
    if (!sessionId) {
      this.loadingService.hideLoadingSpinner();
      this.alertService.showAlert({ title: 'Your cart session expired. Please reopen your cart and try again.' });
      this.isPlacingOrder = false;
      return;
    }
    customer.address = address;
    this.loadingService.showLoadingSpinner();
    this.paymentService
      .checkoutCart({
        // FIX: couponId is initialised to '' (line 165) and only filled when
        // the user applies a coupon. The backend column is UUID, so sending
        // an empty string trips Postgres "invalid input syntax for type
        // uuid: \"\"". Send null when no coupon is selected.
        couponId: this.couponId || null,
        pointsAmount: this.pointsDiscount,
        promoCoupon: this.promoCoupon,
        pointsCount: this.usedPoints,
        sessionId: sessionId,
        userSessionId: this.userData.sessionId,
        branchId: this.branchId,
        serviceId: this.serviceId || this.serviceName,
        serviceName: this.serviceName,
        phone: customer.phone,
        payment: {
          name: this.payment.name,
        },
        customer: customer,
        note: this.note,
        carNumber: this.customer.carNumber,
        date: this.date,
        time: this.time,
        scheduleTime: this.createScheduleTime(this.date, this.time),
        addressKey: this.addressKey,
        tableId: this.tableId,
        tableName: this.tableName,
        auth: this.authKey,
        long: this.lng,
        lat: this.lat,
        shippingOption: this.selectedShipping,
      })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: async (response: any) => {
          if (response.success) {
            let data = response.data;

            if (this.userData?.id) {
              this.clearCheckoutCache();
              this.reloadUserData();
            }

            localStorage.setItem('lastPage', window.location.pathname);

            if (this.payment.name == 'afs') {
              // Re-enable before handing off — if the gateway returns the user
              // to this page (failure / cancel) the button must be clickable.
              this.isPlacingOrder = false;
              this.paymentService.AfsPayment(data);
            } else if (this.payment.name == 'CrediMax') {
              // Same reasoning as afs above.
              this.isPlacingOrder = false;
              this.paymentService.CrediMaxPayment(data);
            } else if (this.payment.name == 'BenefitPay') {
              this.isBenefitPayOpened = true;
              this.loadingService.hideLoadingSpinner();

              InApp.open(
                data,
                (success: any) => {
                  this.isBenefitPayOpened = false;
                  this.isPlacingOrder = false;
                  this.paymentService
                    .checkBenefitPayStatus2(data.referenceNumber, sessionId)
                    .then((isSuccess: boolean) => {
                      this.router.navigate([isSuccess ? 'order/complete' : 'order/error']);
                    })
                    .catch(() => {
                      this.router.navigate(['order/error']);
                    });
                },
                (error: any) => {
                  if (this.isBenefitPayOpened) {
                    this.isBenefitPayOpened = false;
                    this.isPlacingOrder = false;
                    this.paymentService
                      .checkBenefitPayStatus2(data.referenceNumber, sessionId)
                      .then((isSuccess: boolean) => {
                        this.router.navigate([isSuccess ? 'order/complete' : 'order/error']);
                      })
                      .catch(() => {
                        this.router.navigate(['order/error']);
                      });
                  }
                },
                (cancel: any) => {
                  if (this.isBenefitPayOpened) {
                    this.isBenefitPayOpened = false;
                    this.isPlacingOrder = false;
                    this.paymentService
                      .checkBenefitPayStatus2(data.referenceNumber, sessionId)
                      .then((isSuccess: boolean) => {
                        if (isSuccess) {
                          this.router.navigate(['order/complete']);
                        }
                        // Payment not confirmed on cancel — user stays on page
                        // and can retry; flag already reset above.
                      })
                      .catch(() => {
                        // Stay on page silently — flag already reset above.
                      });
                  }
                }
              );
            } else {
              this.loadingService.hideLoadingSpinner();
              if (data.url || data.data?.url) {
                // Reset before navigating away — protects against popup
                // blockers or gateway errors that keep the user on this page.
                this.isPlacingOrder = false;
                window.open(data.url || data.data?.url, '_self');
              } else {
                this.isPlacingOrder = false;
                this.router.navigate(['order/complete']);
              }
            }
          } else {
            // Server returned success: false — show the error and let the user retry.
            this.isPlacingOrder = false;
            this.loadingService.hideLoadingSpinner();
            if (response.msg) {
              this.alertService.showAlert({ title: response.msg });
            }
            await this.promoApplyingRefresh();
          }
        },
        error: (err: any) => {
          this.isPlacingOrder = false;
          localStorage.setItem('orderPlaced', 'false');
          this.loadingService.hideLoadingSpinner();
        },
      });
  }

  async reloadUserData() {
    await this.authService.getLoggedInUser();
  }

  createScheduleTime(date: any, time: any) {
    if (date && time) {
      const [year, month, day] = date.split('-');
      const [hours, minutes] = time.split(':');
      const scheduleDate = new Date(
        Date.UTC(year, month - 1, day, hours - 3, minutes)
      );
      const scheduleTime = scheduleDate.toISOString();
      return scheduleTime;
    } else {
      return null;
    }
  }

  openLoginPop() {
    if (!this.isBrowser) return;

    try {
      if (!this.modalService) {
        this.logger.error('Modal service not available', { context: 'CheckoutComponent.openLoginPop' });
        return;
      }

      const modalRef = this.modalService.openWithData(LoginPopComponent, {}, {
        centered: true,
        windowClass: "modal-md modal-fullscreen-md-down",
        backdrop: 'static',
        keyboard: false
      });

      this.handleModalResult2(modalRef);
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.openLoginPop' });
    }
  }

  private handleModalResult2(modalRef: NgbModalRef): void {
    modalRef.result
      .then(
        (data: any) => {
          if (data && data.success) {
            // Handle success
          }
        },
        (reason: any) => {
          // Handle dismissal
        }
      )
      .catch((error: any) => {
        this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.handleModalResult2' });
      });
  }

  getFilteredDates() {
    this.filteredDates = this.filterDatesByWorkingTimes(
      this.dates,
      this.branchId,
      this.branches
    ).slice(0, 7);
  }

  getBranchStatus() {
    this.branchStatus = this.appServices.getBranchStatusValue();
  }

  checkBranchStatus(branchId: any) {
    return new Promise((response) => {
      if (branchId) {
        if (this.branches.length) {
          let i = 0;
          this.branches.forEach((branch: any) => {
            if (branch.id == branchId) {
              response(branch.currentStatus);
            }
            if (i >= this.branches.length) {
              response(null);
            } else {
              i++;
            }
          });
        } else {
          response(null);
        }
      } else {
        response(null);
      }
    });
  }

  editService() {
    if (!this.isBrowser) return;

    try {
      if (!this.modalService) {
        this.logger.error('Modal service not available', { context: 'CheckoutComponent.editService' });
        return;
      }

      const modalRef = this.modalService.openWithData(
        ServiceSelectorPopComponent,
        { page: 'checkout' },
        {
          centered: true,
          windowClass: 'modal-md modal-fullscreen-md-down',
          backdrop: 'static',
          keyboard: false,
        }
      );

      modalRef.result
        .then(
          async (data: any) => {
            if (!data || !data.success) return;

            // Always refresh base cart/invoiceData state first
            this.getCartInvoiceData();

            // ── Shipping sub-modal result ────────────────────────────────────
            if (data.countryCode) {
              this.address.country = data.countryCode;
              this.addressKey = data.countryCode;
              this.customer.phoneCode = this.getPhoneCodeFromCountry(data.countryCode);
              this.selectedShipping = null;
              await this.getShippingOptions();
              this.getBranchStatus();
              this.getFilteredDates();
              return;
            }

            // ── Delivery sub-modal result ────────────────────────────────────
            if (data.selectedAddress) {
              localStorage.setItem('selectedUserAddress', JSON.stringify(data.selectedAddress));
              this.appService.selectedUserAddress = data.selectedAddress;
              this.selectedAddressValue = data.selectedAddress;
              await this.getCompanyDeliveryAddresses();
              await this.selectUserAddress(data.selectedAddress);
              this.getBranchStatus();
              this.getFilteredDates();
              return;
            }

            // ── Pickup sub-modal result ──────────────────────────────────────
            // (pickup selector closes with { success: true } and updates cart internally)
            this.getBranchStatus();
            this.getFilteredDates();
            if (this.scheduleOrderOption === 'later') {
              this.editScheduleOrder();
            }
          },
          (reason: any) => {
          }
        )
        .catch((error: any) => {
          this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.editService.modalResult' });
        });
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.editService' });
    }
  }

  getBranchData(branchId: string): Branch | any {
    for (const branch of this.branches) {
      if (branch.id === branchId) {
        return branch;
      }
    }
    return null;
  }

  openDirection(longitude: string, latitude: string) {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    window.open(url, '_blank');
  }

  editBranch() {
    this.showPickupSelectorPop();
  }

  selectPickupBranch() {
    this.showPickupSelectorPop();
  }

  editCustomer() {
    this.detectedCustomerData = false;
  }

  editScheduleOrder() {
    this.detectedScheduleOrder = false;
    this.date = '';
    this.time = '';
  }

  async selectUserAddress(addr: any) {
    try {
      if (!addr || Object.keys(addr).length === 0) {
        this.alertService.showAlert({
          title: 'Invalid Selection',
          subtitle: 'Please select a valid address.',
        });
        return;
      }

      this.address = {};
      this.selectedAddressValue = addr;
      this.address = { ...this.selectedAddressValue };

      await this.ensureCoveredAddressesLoaded();

      if (!this.isValidAddress(this.address, this.addressFormat)) {
        this.alertService.showAlert({
          title: 'Incomplete Address',
          subtitle: 'The selected address is missing required fields. Please enter a new address with all required information.',
        });
        this.newAddress();
        return;
      }

      if (this.addressType == 'Governorate') {
        if (!this.address.governorate) {
          this.alertService.showAlert({
            title: 'Missing Governorate',
            subtitle: 'Governorate is required. Please select a valid address or enter a new one.',
          });
          this.newAddress();
          return;
        }
        this.addressKey = this.address.governorate;

        await this.updateCart().then((data) => {
          if (data) {
            this.getCities();
          } else {
            this.alertService.showAlert({
              title: 'Failed to Load Data',
              subtitle: 'Unable to load cities. Please try again.',
            });
            this.newAddress();
          }
        });
      } else if (this.addressType == 'City') {
        if (!this.address.city) {
          this.alertService.showAlert({
            title: 'Missing City',
            subtitle: 'City is required. Please select a valid address or enter a new one.',
          });
          this.newAddress();
          return;
        }

        this.addressKey = this.address.city;

        await this.updateCart().then((data) => {
          if (data) {
            if (this.branchCoveredAddresses && this.branchCoveredAddresses?.list) {
              for (const cAddress of this.branchCoveredAddresses?.list) {
                if (cAddress.City === this.address.city) {
                  this.address.governorate = cAddress.Governorate;
                  break;
                }
              }
            }
            this.getBlocks();
          } else {
            this.alertService.showAlert({
              title: 'Failed to Load Data',
              subtitle: 'Unable to load blocks. Please try again.',
            });
            this.newAddress();
          }
        });
      } else if (this.addressType == 'Block') {
        if (!this.address.block) {
          this.alertService.showAlert({
            title: 'Missing Block',
            subtitle: 'Block is required. Please select a valid address or enter a new one.',
          });
          this.newAddress();
          return;
        }

        this.addressKey = this.address.block;

        await this.updateCart().then((data) => {
          if (data) {
            if (this.branchCoveredAddresses && this.branchCoveredAddresses?.list) {
              for (const cAddress of this.branchCoveredAddresses?.list) {
                if (cAddress.Block === this.address.block) {
                  this.address.city = cAddress.City;
                  this.address.governorate = cAddress.Governorate;
                  break;
                }
              }
            }
          } else {
            this.alertService.showAlert({
              title: 'Failed to Load Data',
              subtitle: 'Unable to complete address selection. Please try again.',
            });
            this.newAddress();
          }
        });
      } else {
        this.address = { ...addr };
        return;
      }

      if (
        !this.addressKey ||
        !this.isValidAddress(this.address, this.addressFormat)
      ) {
        this.alertService.showAlert({
          title: 'Address Validation Failed',
          subtitle: 'The address is missing required information. Please enter a new address.',
        });
        this.address = {};
        this.addressKey = '';
        this.selectedAddressValue = null;
        return;
      }

    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.selectUserAddress' });
      this.alertService.showAlert({
        title: 'Unexpected Error',
        subtitle: 'An error occurred while processing your address. Please try again.',
      });
      this.newAddress();
    }
  }

  validatePhone() {
    if (!this.isBrowser) return;
    try {
      if (!this.modalService) {
        this.logger.error('Modal service not available', { context: 'CheckoutComponent.validatePhone' });
        return;
      }
      const modalRef = this.modalService.openWithData(
        PhoneVerificationComponent,
        {
          phoneCode: this.customer.phoneCode,
          phoneNumber: this.customer.phoneNumber,
        },
        {
          centered: true,
          windowClass: 'modal-sm',
          backdrop: 'static',
          keyboard: false,
        }
      );

      this.handleModalResult(modalRef);
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.validatePhone' });
    }
  }

  private handleModalResult(modalRef: NgbModalRef): void {
    modalRef.result
      .then(
        (data: any) => {
          if (data) {
            if (data.validation) {
              this.isPhoneValidated = true;
              this.placeOrder();
            } else {
              this.isPhoneValidated = false;
            }
          }
        },
        (reason: any) => {
          // Handle dismissal
        }
      )
      .catch((error: any) => {
        this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.handleModalResult' });
      });
  }

  newAddress() {
    this.selectedAddressValue = null;
    this.address = {};
    this.addressKey = '';
    this.cities = [];
    this.blocks = [];
    this.addressTitleDuplicate = false;
    // ── FIX: clear persisted user address when user explicitly enters a new one
    localStorage.removeItem('selectedUserAddress');
    this.appService.selectedUserAddress = null;
  }

  onAddressTitleChange() {
    const val = this.address?.title?.trim().toLowerCase();
    this.addressTitleDuplicate = !!val && (this.userData?.addresses || []).some(
      (a: any) => a.title?.trim().toLowerCase() === val
    );
  }

  checkPhoneValidate() {
    if (this.userData) {
      if (
        this.customer.phoneCode + this.customer.phoneNumber !=
        this.userData.phone
      ) {
        this.isPhoneValidated = false;
      } else {
        this.isPhoneValidated = true;
      }
    } else {
      this.isPhoneValidated = false;
    }
  }

  goBackToPreviousProductsPage(): void {
    const lastUrl = this.navTracker.getLastValidUrl();
    this.router.navigateByUrl(lastUrl);
  }

  goBack() {
    if (this.canGoBack) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }

  goToAccountAddresses() {
    this.router.navigate(['/account'], { queryParams: { tab: 'address' } });
  }

  async onMapClosed() {
    this.showMap = false;
    if (this.serviceName === 'Delivery' && this.branchId) {
      this.isLoadedBranchCoveredAddresses = false;
      await this.getBranchCoveredAddresses1();
      if (this.addressType === 'Governorate' && this.address.governorate) {
        this.getCities();
      } else if (this.addressType === 'City' && this.address.city) {
        this.getBlocks();
      }
    }
  }

  selectCountry() {
    this.addressKey = this.address.country;
    this.userAddress = '';
    this.date = '';
    this.time = '';
    this.customer.phoneCode = this.getPhoneCodeFromCountry(this.address.country);
    this.selectedShipping = null;
    this.loadingService.showLoadingSpinner();
    this.loading = true;
    this.updateCart().then((data) => {
      if (data) {
        this.getShippingOptions();
      } else {
        this.alertService.showAlert({
          title: 'Failed to load data at this moment, please try again later.',
        });
      }
    });
  }

  getShippingOptions() {
    this.shippingService.getShippingOptions(this.invoiceData.onlineData.sessionId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: ShippingOptions[] | null) => {
        this.shippingOptions = response ?? [];
        if (
          (this.isInit || !this.selectedShipping) &&
          this.shippingOptions.length > 0
        ) {
          this.setShippOption(this.shippingOptions[0]);
        }
        this.isInit = false;
        this.loadingService.hideLoadingSpinner();
        this.loading = false;
      },
      error: (error) => {
        this.loadingService.hideLoadingSpinner();
        this.loading = false;
      },
    });
  }

  getShippingSetting() {
    return new Promise((response) => {
      this.shippingService.getShippingSettings().pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: any[]) => {
          if (data) {
            this.shippingSetting = data;
            const zoneCountryCodes = this.shippingSetting.map(
              (z) => z.CountryCode
            );
            this.shippingCountries = this.allCountries.filter((country: any) =>
              zoneCountryCodes.includes(country.code)
            );
            // ── SORT: Alphabetically by country name
            this.shippingCountries = this.shippingCountries.sort((a: any, b: any) =>
              (a.name || '').localeCompare(b.name || '')
            );
            response(true);
          }
          response(false);
        },
      });
    });
  }

  async setShippOption(option: ShippingOptions) {
    this.selectedShipping = option;
    this.shippingService.setShipping(this.invoiceData.onlineData.sessionId, option.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: async (response: any) => {
        this.updateCart().then((data) => {
          if (data) {
            this.getShippingOptions();
          } else {
            this.alertService.showAlert({
              title: 'Failed to load data at this moment, please try again later.',
            });
          }
        });
      },
    });
  }

  changeSelectedShipping() {
    this.selectedShipping = null;
  }

  getHeaderBackground(subheader_settings: any) {
    if (subheader_settings) {
      if (
        subheader_settings.style == 'Color' &&
        subheader_settings.defaultColor
      ) {
        return subheader_settings.defaultColor || 'gray';
      } else if (
        subheader_settings.style == 'Pattern' &&
        subheader_settings.defaultPattern
      ) {
        return `url(assets/images/page-builder/patterns/ ${subheader_settings.defaultPattern} .png)`;
      } else if (
        subheader_settings.style == 'Image' &&
        subheader_settings.defaultImage &&
        subheader_settings.defaultImage.defaultUrl
      ) {
        return `url( ${subheader_settings.defaultImage.defaultUrl})`;
      }
      return 'gray';
    } else {
      return 'gray';
    }
  }

  getDistanceFromLatLonInKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
      Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  getPosition(): Promise<number[]> {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve([position.coords.latitude, position.coords.longitude]);
          },
          (error) => {
            reject(error);
          },
          {
            enableHighAccuracy: false,
            timeout: 14000,
            maximumAge: 300000,
          }
        );
      } else {
        reject(new Error('Geolocation is not supported by this browser.'));
      }
    });
  }

  async updateDiscount(discounts: {
    promoCoupon: number;
    pointsDiscount: number;
    usedPoints: number;
    selectedOption: string;
    couponId?: string;
  }) {

    this.promoCoupon = discounts.promoCoupon;
    this.pointsDiscount = discounts.pointsDiscount;
    this.usedPoints = discounts.usedPoints;
    this.finalAmount =
      this.totalAmount - (this.promoCoupon + this.pointsDiscount);
    this.selectedOption = discounts.selectedOption;
    this.couponId = discounts.couponId || '';
    await this.promoApplyingRefresh();
  }
  async updateDiscount2(discounts: {
    selectedOption: string;
    couponId?: string;
  }) {
    this.promoCoupon = 0;
    this.couponId = '';
    await this.promoApplyingRefresh();
  }
  async promoApplyingRefresh() {
    await this.getCartInvoiceData();
    await this.getPageData();
    let sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      await this.getCart(sessionId);
    }

  }


  showPickupSelectorPop() {
    if (!this.isBrowser) return;

    try {
      if (!this.modalService) {
        this.logger.error('Modal service not available', { context: 'CheckoutComponent.showPickupSelectorPop' });
        return;
      }

      const modalRef = this.modalService.openWithData(PickupSelectorPopComponent, {
        context: 'checkout',
        currentBranchId: this.branchId,
        page: "checkout",
      }, {
        centered: true,
        windowClass: "modal-md modal-fullscreen-md-down",
        backdrop: 'static',
        keyboard: false
      });

      this.handlePickupModalResult(modalRef);
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.showPickupSelectorPop' });
    }
  }

  private handlePickupModalResult(modalRef: NgbModalRef): void {
    modalRef.result
      .then(
        async (data: any) => {
          if (data && data.success) {
            this.getCartInvoiceData();
            this.getBranchStatus();
            this.getFilteredDates();
            if (this.scheduleOrderOption == 'later') {
              this.editScheduleOrder();
            }
            await this.promoApplyingRefresh();

          }
        },
        (reason: any) => {
        }
      )
      .catch((error: any) => {
        this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.handlePickupModalResult' });
      });
  }

  showDeliverySelectorPop() {
    if (!this.isBrowser) return;
    const modalRef = this.modalService.openWithData(DeliverySelectorPopComponent, {}, {
      centered: true,
      windowClass: "modal-md modal-fullscreen-md-down",
      backdrop: 'static',
      keyboard: false
    });

    this.handleDeliveryModalResult(modalRef);
  }

  private handleDeliveryModalResult(modalRef: NgbModalRef): void {
    modalRef.result
      .then(
        async (data: any) => {
          if (data && data.success) {
            this.getCartInvoiceData();
            await this.getCompanyDeliveryAddresses();

            if (data.selectedAddress) {
              localStorage.setItem('selectedUserAddress', JSON.stringify(data.selectedAddress));
              this.appService.selectedUserAddress = data.selectedAddress;
              this.selectedAddressValue = data.selectedAddress;
              await this.selectUserAddress(data.selectedAddress);
            } else {
              localStorage.removeItem('selectedUserAddress');
              this.appService.selectedUserAddress = null;
              this.selectedAddressValue = null;

              this.address = {};
              if (this.addressType === 'Governorate') {
                this.address.governorate = this.addressKey;
              } else if (this.addressType === 'City') {
                this.address.city = this.addressKey;
              } else if (this.addressType === 'Block') {
                this.address.block = this.addressKey;
              }

              this.isLoadedBranchCoveredAddresses = false;
              await this.getBranchCoveredAddresses1();

              if (this.addressType === 'Governorate') {
                this.getCities();
              } else if (this.addressType === 'City' || this.addressType === 'Block') {
                this.getBlocks();
              }

              this.getBranchStatus();
              this.getFilteredDates();
            }
            await this.promoApplyingRefresh();
          }
        },
        (reason: any) => {
        }
      )
      .catch((error: any) => {
        this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.handleDeliveryModalResult' });
      });
  }

  showShippingSelectorPop() {
    if (!this.isBrowser) return;
    const modalRef = this.modalService.openWithData(ShippingSelectorPopComponent, {}, {
      centered: true,
      windowClass: "modal-md modal-fullscreen-md-down",
      backdrop: 'static',
      keyboard: false
    });
    this.handleShippingModalResult(modalRef);
  }

  private handleShippingModalResult(modalRef: NgbModalRef): void {
    modalRef.result
      .then(
        async (data: any) => {
          if (data && data.success) {
            // Re-sync branchId, serviceName, addressKey from cart
            this.getCartInvoiceData();

            // FIX: Explicitly update the local address object so the UI reflects the change
            if (data.countryCode) {
              this.address.country = data.countryCode;
              this.addressKey = data.countryCode; // Ensure addressKey is also synced
            }

            // Reset selected shipping so getShippingOptions auto-selects and calls setShippingPrice
            this.selectedShipping = null;

            // Refresh shipping methods and status for the newly selected country
            this.getShippingOptions();
            this.getBranchStatus();
            this.getFilteredDates();
          }
          await this.promoApplyingRefresh();
        },
        (reason: any) => {
        }
      )
      .catch((error: any) => {
        this.logger.error(error?.message, { stack: error?.stack, context: 'CheckoutComponent.handleShippingModalResult' });
      });
  }

  filteredPayments(payments: any[]) {
    let tempFilteredPayments = payments;

    const shouldHideCash = this.disablePayLater ||
      (this.serviceName &&
        this.disablePayLaterFor &&
        this.disablePayLaterFor.some((service: string) =>
          service.toLowerCase() === this.serviceName.toLowerCase()
        ));

    if (shouldHideCash) {
      tempFilteredPayments = payments.filter((payment: any) =>
        payment.name.toLowerCase() !== 'cash'
      );
      if (this.selectedPayment == "Cash") {
        this.selectedPayment = "";
      }
    }

    return tempFilteredPayments;
  }

}