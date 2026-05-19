// src/app/app.component.ts

import {
  Component,
  DOCUMENT,
  Inject,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  Renderer2,
  inject,
} from '@angular/core';
import { ActivatedRoute, NavigationStart, RouterModule } from '@angular/router';
import {
  CommonModule,
  isPlatformBrowser,
  ViewportScroller,
} from '@angular/common';

import { Router, NavigationEnd } from '@angular/router';
import { filter, timeout, takeUntil } from 'rxjs/operators';
import { CartService } from './services/cartServices/cart.service';
import { CompanyServices } from './services/companyServices/company.service';
import { Company } from './models/company.model';
import { SearchService } from './services/searchService/search.service';
import { PaymentService } from './services/paymentServices/payments.service';
import { Invoice } from './models/invoice-model';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { PageStateService } from './services/page-state.service';
import { FooterModule } from './components/footer/footer.module';
import { HeaderModule } from './components/header/header.module';
import { LoadingModule } from './components/loading/loading.module';
import { NoConnectionComponent } from './pages/no-connection/no-connection.component';
import { AuthService } from './services/authService/auth.service';
import { LoadingService } from './services/loadingService/loading.service';
import { AlertService } from './services/alertService/alert.service';
import { Subscription, Subject } from 'rxjs';
import { Product } from './models/product.model';
import { TranslateModule } from '@ngx-translate/core';
import { PushNotificationService } from './services/notification.service';
import { LoginPopComponent } from './components/auth/login-pop/login-pop.component';
import { PromoPopupComponent } from './components/promo-popup/promo-popup.component';
import { PromoService } from './services/promoService/promo.service';
import { AppServices } from './services/appServices';
import { ToolBarButtonsComponent } from './components/toolbar-buttons/toolbar-buttons.component';
import { ModalService } from './services/modal.service';
import { LanguageService } from './services/langauge.service';
import { MobileIconBarSettings } from './models/mobile-bar-settings.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LoggerService } from './services/logger/logger.service';
@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterModule,
    FooterModule,
    HeaderModule,
    LoadingModule,
    NoConnectionComponent,
    TranslateModule,
    ToolBarButtonsComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);
  isBrowser: boolean;
  loading: boolean = true;
  showNoConnection: boolean = false;

  userData: any = {};
  companyData: Company = new Company();
  companyLoadErr: any = null;
  searchQuery: string = '';

  private subscription: Subscription = new Subscription();
  private lastScrollPositions = new Map<string, [number, number]>();
  private scrollPositions = new Map<string, [number, number]>();
  private lastUrl: string | null = null;
  private isPopState = false;

  isBlankPage = false;
  serviceName = ''
  private productLinkRedirected = false; // Flag to prevent infinite redirects

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private searchService: SearchService,
    private cartService: CartService,
    private companyService: CompanyServices,
    private router: Router,
    private pageStateService: PageStateService,
    private paymentService: PaymentService,
    public appService: AppServices,
    private pushService: PushNotificationService,
    public authService: AuthService,
    private sanitizer: DomSanitizer,
    private alertService: AlertService,
    private renderer: Renderer2,
    private scroller: ViewportScroller,
    private ngZone: NgZone,
    private route: ActivatedRoute,
    @Inject(DOCUMENT) private document: Document,
    private promoService: PromoService,
    private modalService: ModalService,
    private languageService: LanguageService,
    private loadingService: LoadingService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.isBrowser) {
      // Clean up the event listener when the component is destroyed
      window.removeEventListener('beforeunload', this.resetVisitStatus);
    }
    this.subscription.unsubscribe(); // Unsubscribe from all subscriptions
  }

  private _showIOSMsg: boolean | null = null;

  get showIOSMsg() {
    if (this._showIOSMsg !== null) return this._showIOSMsg;
    if (!this.isBrowser) return false;

    const closedIosMsg = localStorage.getItem('closedIosMsg') === 'true';
    const closedIosDate = new Date(localStorage.getItem('closedIosDate') ?? '').getTime();
    const currentDate = Math.round(Date.now() / 1000);
    const diffInDays = (currentDate - Math.round(closedIosDate / 1000)) / 60 / 60 / 24;
    const isShow = !closedIosMsg && !(diffInDays < 5) && this.installMsgIOS();

    this._showIOSMsg = isShow;

    // Apply positioning once, not on every change detection cycle
    requestAnimationFrame(() => {
      const subEl = document.querySelector('.subscription-container') as HTMLElement;
      const waEl = document.querySelector('.whatsapp-container') as HTMLElement;
      if (subEl) subEl.style.bottom = isShow ? '150px' : '100px';
      if (waEl) waEl.style.bottom = isShow ? '205px' : '155px';
    });

    return isShow;
  }

  installMsgIOS() {
    if (!this.isBrowser) return false;
    // Detects if device is on iOS
    const isIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };
    let nav: any = window.navigator;
    // Detects if device is in standalone mode
    const isInStandaloneMode = () =>
      'standalone' in window.navigator && nav.standalone;

    // Checks if should display install popup notification:
    if (isIos() && !isInStandaloneMode()) {
      return true;
    }
    return false;
  }

  closeIosMsg() {
    let date = new Date().toString();
    localStorage.setItem('closedIosMsg', 'true');
    localStorage.setItem('closedIosDate', date);
    // this.loading = false;
  }

  /**
   * Handle direct product links by redirecting to parent page first
   * Examples:
   * - /menu/product/04104f08... → /menu
   * - /shop/product/04104f08... → /menu
   * - /collections/123/product/456 → /collections/123
   */
  private handleDirectProductLink(): void {
    try {
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search; // Captures ?addToCart=true...
      const urlPattern = /^\/([^\/]+)(\/([^\/]+))?(\/product\/[a-f0-9\-]+)$/i;
      const match = currentPath.match(urlPattern);

      if (match && !this.productLinkRedirected) {
        const firstSegment = match[1].toLowerCase();
        const secondSegment = match[3];
        const productPath = match[4];

        if (firstSegment === 'product' || firstSegment === 'pager') {
          return;
        }

        let parentPath = `/${firstSegment}`;
        if (secondSegment) {
          parentPath += `/${secondSegment}`;
        }

        this.productLinkRedirected = true;

        // Navigate to parent first
        this.router.navigate([parentPath]).then(() => {
          setTimeout(() => {
            // Re-attach the search parameters (query string) to the final URL
            const finalUrl = `${parentPath}${productPath}${currentSearch}`;
            this.router.navigateByUrl(finalUrl);
          }, 300);
        }).catch((error: any) => {
          this.logger.error(error?.message, { stack: error?.stack, context: 'AppComponent.handleDirectProductLink.navigate' });
        });
      }
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'AppComponent.handleDirectProductLink' });
    }
  }

  /**
   * Reset the product link redirect flag when navigating away from product pages
   */
  private resetProductLinkRedirectFlag(): void {
    this.router.events
      .pipe(takeUntil(this.destroy$), filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const pathWithoutProduct = event.url.split('/product/')[0];
        // Reset the flag when user navigates away from product pages
        if (!event.url.includes('/product/')) {
          this.productLinkRedirected = false;
        }
      });
  }

  async ngOnInit() {

    if (this.isBrowser) {
      if (window.location.href.includes('pager') || window.location.href.includes('feedback')) {
        this.isBlankPage = true;
      } else {
        this.isBlankPage = false;
      }

      // Handle direct product links (e.g., shared links)
      this.handleDirectProductLink();
    }

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(async (params: Record<string, any>) => {
      this.serviceName = params['service_name'];
    })

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params: any) => {
      const id = params.get('id');   // name must match your route
    });

    if (!this.isBlankPage) {
      this.paymentService.initInApp();
    }

    console.warn = () => { }; //hide yellow warnings in console.log
    this.router.events
      .pipe(takeUntil(this.destroy$), filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe((e: NavigationStart) => {
        this.lastUrl = this.router.url;
        this.isPopState = e.navigationTrigger === 'popstate';
        if (this.lastUrl) {
          const pos = this.scroller.getScrollPosition();
          this.scrollPositions.set(this.lastUrl, pos);
        }
      });

    // Restore scroll after nav
    this.router.events
      .pipe(takeUntil(this.destroy$), filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        if (this.isPopState) {
          const pos = this.scrollPositions.get(this.router.url);
          if (pos) {
            // Delay required for DOM to be ready
            setTimeout(() => {
              this.ngZone.run(() => {
                this.scroller.scrollToPosition(pos);
                // Change shared state or update input-bound properties
              });
            }, 0);
          }
        }
      });

    // Reset product link redirect flag when navigating
    this.resetProductLinkRedirectFlag();

    //for invo.
    this.appService.initGoogleAnalytics('G-X72VMBG0BN');
    // this.appService.initFacebookPixel('402757894888300');
    // this.appService.initTikTokPixel('');


    // Introduce a small delay before executing scroll-related functions
    // setTimeout(() => {
    //   this.onWindowScroll();
    //   // this.onViewportScroll();
    // }, 100);

    // Listen for route changes and respond accordingly
    // this.router.events
    //   .pipe(filter((event) => event instanceof NavigationEnd))
    //   .subscribe((event: NavigationEnd) => {
    //     this.onRouteChange(event);
    //   });

    // Initialize loading data
    if (this.isBrowser) {
      this.authService.userData$.pipe(takeUntil(this.destroy$)).subscribe({
        next: (responseData: any) => {
          this.userData = responseData;
        },
      });
      if (this.appService) {
        this.appService.initializeApp().then(async () => {
          // Start cart session in parallel with preferences (they are independent)
          const cartPromise = (!this.isBlankPage) ? this.initCartSession() : Promise.resolve();

          // Wait for loadPreferences to finish.
          // FIX: Catch the rejection so the rest of the chain (mobile bar,
          // shipping, menu tree, cart wait) is skipped instead of throwing
          // out of this async block. loadPreferences itself has already set
          // showNoConnection + loading=false on failure, so returning here
          // lets the template render <app-no-connection>.
          try {
            await this.loadPreferences();
          } catch {
            await cartPromise.catch(() => undefined);
            return;
          }
          // initialize the mobile icon bar AFTER loading preferences
          if (this.companyData) {
            await this.initializeMobileIconBar();
          }
          if (!this.isBlankPage) {
            // FIX: do NOT await the geo lookup — checkAndLoadShipping calls
            // ipinfo.io which can be slow or blocked on some networks. Even
            // with the new 3s timeout in getGLocation, blocking the boot
            // chain on it for 3s just to compute isShipping is wasteful.
            // Fire-and-forget; the result lands on appService.glocation /
            // appService.isShipping when it arrives. Templates that read
            // those signals will react via change detection.
            this.checkAndLoadShipping();
          }
          // change primary color
          try {
            this.companyData.menuSettings.primaryMenu[0].template.groupedList =
              this.buildMenuTree();
          } catch (error) {
          }

          try {
            this.appService.disableDelivery =
              this.companyData.oldThemeSettings?.template?.disableDelivery ||
              false;
            this.appService.disablePickup =
              this.companyData.oldThemeSettings?.template?.disablePickup ||
              false;
            this.appService.disablePayLater =
              this.companyData.oldThemeSettings?.template?.disablePayLater ||
              false;
            this.appService.disableScheduleOrder =
              this.companyData.oldThemeSettings?.template
                ?.disableScheduleOrder || false;
            //viewOnly
            if (this.companyData.themeSettings?.template?.viewOnly != null) {
              this.appService.viewOnly =
                this.companyData.themeSettings?.template?.viewOnly;
            } else {
              this.appService.viewOnly =
                this.companyData.oldThemeSettings?.template?.viewOnly || false;
            }
            //quickOrder
            if (this.companyData.themeSettings?.template?.quickOrder != null) {
              this.appService.quickOrder =
                this.companyData.themeSettings?.template?.quickOrder;
            } else {
              this.appService.quickOrder =
                this.companyData.oldThemeSettings?.template?.quickOrder ||
                false;
            }
            //processPaymentAfterAcceptance
            if (
              this.companyData.themeSettings?.template
                ?.processPaymentAfterAcceptance != null
            ) {
              this.appService.processPaymentAfterAcceptance =
                this.companyData.themeSettings?.template?.processPaymentAfterAcceptance;
            } else {
              this.appService.processPaymentAfterAcceptance =
                this.companyData.oldThemeSettings?.template
                  ?.processPaymentAfterAcceptance || false;
            }
            //redirectMenuToShop
            if (
              this.companyData.themeSettings?.template
                ?.redirectMenuToShop != null
            ) {
              this.appService.redirectMenuToShop =
                this.companyData.themeSettings?.template?.redirectMenuToShop;
            }
            //contactInfo
            if (this.companyData.themeSettings?.template?.contactInformation) {
              this.appService.contactEmail =
                this.companyData.themeSettings?.template?.contactInformation?.email;
              this.appService.contactPhone =
                this.companyData.themeSettings?.template?.contactInformation?.phone;
            } else {
              if (this.companyData.oldThemeSettings?.template?.contactEmail) {
                this.appService.contactEmail =
                  this.companyData.oldThemeSettings?.template?.contactEmail ||
                  '';
              }
              if (this.companyData.oldThemeSettings?.template?.contactPhone) {
                this.appService.contactPhone =
                  this.companyData.oldThemeSettings?.template?.contactPhone ||
                  '';
              }
            }

            //primaryColor
            if (
              this.companyData.themeSettings?.template?.colors?.primaryColor
            ) {
              document.documentElement.style.setProperty(
                '--primary-color',
                this.companyData.themeSettings?.template?.colors?.primaryColor
              );
            } else if (
              this.companyData.oldThemeSettings.template?.style?.primaryColor
            ) {
              document.documentElement.style.setProperty(
                '--primary-color',
                this.companyData.oldThemeSettings.template?.style?.primaryColor
              );
            }
            //promotion
            if (!this.isBlankPage) {
              if (this.companyData.themeSettings?.template?.promo) {
                const promoSettings = this.companyData.themeSettings.template.promo;
                if (promoSettings.image?.defaultUrl || promoSettings.title || promoSettings.subtitle) {
                  if (promoSettings.showInHomeOnly) {
                    // Check if the current page is the home page
                    if (this.isHomePage()) {
                      this.openPromotion({
                        title: promoSettings.title,
                        subtitle: promoSettings.subtitle,
                        mediaUrl: promoSettings.image?.defaultUrl,
                      });
                    }
                  } else {
                    // If not restricted to home only, show promo anywhere
                    this.openPromotion({
                      title: promoSettings.title,
                      subtitle: promoSettings.subtitle,
                      mediaUrl: promoSettings.image?.defaultUrl,
                    });
                  }
                }
              }
            }


            if (
              !this.companyData.themeSettings.template.socialmedia &&
              this.companyData?.oldThemeSettings?.template?.socialMedia
            ) {
              if (
                Array.isArray(
                  this.companyData?.oldThemeSettings?.template?.socialMedia
                )
              ) {
                this.companyData.themeSettings.template.socialmedia = {};
                this.companyData?.oldThemeSettings?.template?.socialMedia.forEach(
                  (social: any) => {
                    if (social.icon == 'instagram') {
                      this.companyData.themeSettings.template.socialmedia.instagram =
                        social.url;
                    } else if (social.icon == 'pinterest') {
                      this.companyData.themeSettings.template.socialmedia.pinterest =
                        social.url;
                    } else if (social.icon == 'youtube') {
                      this.companyData.themeSettings.template.socialmedia.youtube =
                        social.url;
                    } else if (social.icon == 'snapchat') {
                      this.companyData.themeSettings.template.socialmedia.snapchat =
                        social.url;
                    } else if (social.icon == 'facebook') {
                      this.companyData.themeSettings.template.socialmedia.facebook =
                        social.url;
                    } else if (social.icon == 'twitter') {
                      this.companyData.themeSettings.template.socialmedia.twitter =
                        social.url;
                    } else if (social.icon == 'linkedin') {
                      this.companyData.themeSettings.template.socialmedia.linkedin =
                        social.url;
                    } else if (social.icon == 'tiktok') {
                      this.companyData.themeSettings.template.socialmedia.tiktok =
                        social.url;
                    } else if (social.icon == 'tumblr') {
                      this.companyData.themeSettings.template.socialmedia.tumblr =
                        social.url;
                    } else if (social.icon == 'vimeo') {
                      this.companyData.themeSettings.template.socialmedia.vimeo =
                        social.url;
                    }
                  }
                );
              }
            }
            this.appService.shippingType =
              this.companyData.themeSettings.template.shippingOptions.type ||
              'delivery';
          } catch (error) { }

          // change favicon
          if (
            this.companyData.themeSettings?.template?.header?.logo
              ?.defaultUrl ||
            this.companyData.defaultUrl
          ) {
            this.changeFavicon(
              this.companyData.themeSettings?.template?.header?.logo
                ?.defaultUrl || this.companyData.defaultUrl
            );
          }

          // for customer company
          if (this.companyData.themeSettings?.template?.googleAnalyticsId) {
            this.appService.initGoogleAnalytics(
              this.companyData.themeSettings?.template?.googleAnalyticsId
            );
          }
          if (this.companyData.themeSettings?.template?.facebookPixelId) {
            this.appService.initFacebookPixel(
              this.companyData.themeSettings?.template?.facebookPixelId
            );
          }
          if (this.companyData.themeSettings?.template?.tiktokPixelId) {
            this.appService.initTikTokPixel(
              this.companyData.themeSettings?.template?.tiktokPixelId
            );
          }

          this.appService.enforceServiceSelection = this.companyData.themeSettings?.template?.enforceServiceSelection || false;

          // Wait for cart session that was started in parallel
          await cartPromise;

          this.loading = false;
        });
      }
    }

    this.getCartInvoiceData();

    this.isEnter = false;
  }

  buildMenuTree() {
    const result: any[] = [];
    const depthStack: any[] = [];
    for (const item of this.companyData.menuSettings.primaryMenu[0]?.template
      ?.list) {
      const depth = item.depth ?? 0;
      const newItem = { ...item };

      // Remove deeper levels from the stack
      while (depthStack.length > depth) {
        depthStack.pop();
      }
      if (depth === 0) {
        result.push(newItem);
        depthStack[0] = newItem;
      } else {
        const parent = depthStack[depth - 1];
        if (!parent.children) parent.children = [];
        parent.children.push(newItem);
        depthStack[depth] = newItem;
      }
    }
    return result;
  }

  // async subscribe(sessionId?: any) {
  //   const success = await this.pushService.subscribeToNotifications(sessionId);
  //   if (success) {
  //     console.log('Successfully subscribed to notifications');
  //   } else {
  //     console.log('Failed to subscribe to notifications');
  //   }
  // }

  private resetVisitStatus = () => {
    // Remove the session storage item to reset the visit status
    for (const key in sessionStorage) {
      if (key.startsWith('hasVisited_')) {
        sessionStorage.removeItem(key);
        this.pageStateService.removePageState(key);
      }
    }
  };

  getCart(sessionId: string) {

    return new Promise((resolve) => {
      this.cartService.getCart(sessionId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (responseData: Invoice | null) => {
          if (responseData) {
            if (this.isBrowser) {
              this.cartService.setCartInvoiceData(responseData);
              // FIX (perf): branch status is no longer fetched inside
              // cartService.getCart — it's only refreshed at legitimate
              // cart-screen entry points like this one.
              this.cartService.checkBranchStatus(responseData.branchId, (responseData as any).serviceName);
              const notificationSupported = typeof Notification !== 'undefined';
              const permission = notificationSupported
                ? Notification.permission
                : 'unsupported';
            }
            resolve(true);
          } else {
            // FIX: see checkout.component.ts — `resolve(true)` previously
            // ran synchronously below this branch, resolving the outer
            // Promise before createCartSession() finished and leaving
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

  private async initCartSession(): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      const sessionId = localStorage.getItem('sessionId');
      if (sessionId && sessionId !== 'undefined') {
        await this.getCart(sessionId);
      } else {
        await this.createCartSession();
      }
    } else {
      await this.createCartSession();
    }
  }

  async createCartSession() {
    return new Promise(async (resolve, reject) => {
      this.cartService.createCart({ serviceName: this.serviceName }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (responseData: any) => {
          this.cartService.setCartInvoiceData(responseData)
          localStorage.setItem('sessionId', responseData.onlineData.sessionId);
          resolve(true);
        },
        error: (err: any) => {
          this.logger.error(err?.message, { stack: err?.stack, context: 'AppComponent.createCartSession' });
          reject(err); // Reject promise on error
        },
      });
    });
  }

  loadPreferences() {
    return new Promise((resolve, reject) => {
      // FIX: Cap the request at 8s so a hanging upstream (e.g. unknown
      // subdomain that the backend never answers) cannot leave the app
      // stuck in `loading = true` forever — which would render the empty
      // @if(loading) {} branch and white out the page.
      this.companyService.getCompanyPreferences().pipe(timeout(8000)).pipe(takeUntil(this.destroy$)).subscribe({
        next: (responseData: Company | null) => {
          if (responseData) {
            this.companyData = responseData; // Assign the returned company to the component property
            this.companyService.setCompanyData(this.companyData);
            document.title =
              this.companyData.themeSettings.template.websiteTitle ||
              this.companyData.name;
            resolve(true);
          } else {
            this.showNoConnection = true;
            this.loading = false;
            this.logger.error('Received null company data', { context: 'AppComponent.loadPreferences' });
            reject('No company data received');
          }
        },
        error: (err: any) => {
          this.logger.error(err?.message, { stack: err?.stack, context: 'AppComponent.loadPreferences' });
          this.companyLoadErr = err;
          this.showNoConnection = true;
          // FIX: Without this, when loadPreferences rejects the rest of the
          // initializeApp().then() chain aborts before reaching `this.loading
          // = false` (line ~546) — leaving the template stuck on the empty
          // @if(loading) branch instead of showing <app-no-connection>.
          this.loading = false;
          reject(err);
        },
      });
    });
  }

  closeMobileMenu() {
    this.renderer.removeClass(document.body, 'mmenu-active');
    this.renderer.setStyle(document.body, 'overflow', 'auto');
  }

  defaults = {
    animation: {
      name: 'fadeIn',
      duration: '1.2s',
      delay: '.2s',
    },
  };
  parseOptions(options: any) {
    return 'string' == typeof options
      ? JSON.parse(options.replace(/'/g, '"').replace(';', ''))
      : {};
  }

  scrollTop(behavior: any) {
    if (!this.isBrowser) return;
    // FIX: passing `behavior: null` to window.scrollTo throws TypeError in
    // strict WebViews (iOS Safari, some Android WebViews). Most call sites
    // pass `null` to mean "default jump". Only include `behavior` when it's
    // a recognised string.
    const opts: ScrollToOptions = { top: 0 };
    if (behavior === 'smooth' || behavior === 'auto' || behavior === 'instant') {
      opts.behavior = behavior;
    }
    window.scrollTo(opts);
  }

  showSearchProducts(): void {
    this.searchService.toggleMobileSearch();
  }

  onSearchInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery = input.value;
    this.searchService.setSearchQuery(this.searchQuery); // Emit the search query
  }

  search(event: Event) {
    event.preventDefault(); // Prevent form submission
    this.searchService.setSearchQuery(this.searchQuery); // Emit the search query
  }

  gotoAccount() {
  }

  hideTabs(): boolean {
    if (
      (this.isMobile() && this.router.url.includes('menu')) ||
      this.router.url.includes('shop') ||
      this.router.url.includes('product') ||
      this.router.url.includes('checkout') ||
      this.router.url.includes('cart')
    ) {
      return false;
    } else {
      return true;
    }
  }

  isMobile(): boolean {
    if (this.isBrowser) return window.innerWidth < 720; // Adjust the width threshold as needed
    return false;
  }

  openLogin() {
    if (!this.userData?.id) {
      this.openLoginPop();
    } else {
      this.router.navigate(['/account']);
    }
  }

  openLoginPop() {
    if (!this.isBrowser) return;

    try {
      // Check if modal service is available
      if (!this.modalService) {
        this.logger.error('Modal service not available', { context: 'AppComponent.openLoginPop' });
        return;
      }

      // Open the modal using the ModalService
      const modalRef = this.modalService.openWithData(
        LoginPopComponent,
        {},
        {
          centered: true,
          windowClass: 'modal-md modal-fullscreen-md-down',
          backdrop: 'static', // Prevent closing on backdrop click
          keyboard: false, // Prevent closing on escape
        }
      );

      // Handle modal result
      this.handleModalResult(modalRef);
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'AppComponent.openLoginPop' });
    }
  }

  // Helper method to handle modal results
  private handleModalResult(modalRef: NgbModalRef): void {
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
        this.logger.error(error?.message, { stack: error?.stack, context: 'AppComponent.handleModalResult' });
      });
  }

  logout() {
    this.authService.confLogout();
  }

  openPromotion(data: any) {
    if (!this.isBrowser) return;
    try {
      // Check if modal service is available
      if (!this.modalService) {
        this.logger.error('Modal service not available', { context: 'AppComponent.openPromotion' });
        return;
      }
      // Create modal with error handling
      let component = PromoPopupComponent;
      const modalRef = this.modalService.open(component, {
        centered: true,
        size: 'lg',
        windowClass: 'lg_modal modal-promo',
        backdrop: 'static', // Prevent closing on backdrop click
        keyboard: false, // Prevent closing on escape
      });
      // Check if modal was created successfully
      if (!modalRef) {
        this.logger.error('Failed to create promo modal', { context: 'AppComponent.openPromotion' });
        return;
      }
      // Set component data with safety check
      if (modalRef.componentInstance && modalRef.componentInstance.loadData) {
        let tempData = {
          title: data.title,
          subtitle: data.subtitle,
          mediaUrl: data.mediaUrl
        };
        modalRef.componentInstance.loadData(tempData);
      }
      // Handle modal result
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
          this.logger.error(error?.message, { stack: error?.stack, context: 'AppComponent.openPromotion.modalResult' });
        });
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'AppComponent.openPromotion' });
    }
  }

  openCartDropdown() {
    // this.router.navigate(['/cart']);

    if (this.isBrowser) {
      const element = document.querySelector('.cart-dropdown');

      if (element) {
        if (this.isMobile()) {
          // Store original parent and sibling position
          // this.originalParent = element.parentNode as Element;
          // this.originalNextSibling = element.nextSibling as Element;
          //Move dropdown to <body>
          // document.body.appendChild(element);
        }

        element.classList.add('opened');
        document.body.style.overflow = 'hidden';
      }
    }
  }

  isEnter = true;
  isBouncing = false;
  invoiceData!: Invoice;
  getCartInvoiceData() {
    const sub = this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: Invoice | null) => {
        if (responseData) {
          this.invoiceData = responseData;

          setTimeout(() => {
            if (!this.isEnter) {
              if (
                !this.router.url.includes('/product') &&
                !this.router.url.includes('/checkout') &&
                !this.router.url.includes('/cart')
              ) {
                this.isBouncing = true;
              }
              setTimeout(() => {
                this.isBouncing = false;
              }, 1500);
            }
          }, 175);
        }
      },
    });
    this.subscription.add(sub); // Add the subscription to the composite
  }

  openWishlistDropdown() {
    if (this.isBrowser) {
      const element = document.querySelector('.wishlist-dropdown');
      if (element) {
        element.classList.add('opened');
        document.body.style.overflow = 'hidden';
      }
    }
  }

  getWishlist() {
    if (this.isBrowser) {
      var products: Product[] = JSON.parse(
        localStorage.getItem('wishlist') || '[]'
      );
      return products;
    }
    return [];
  }

  changeFavicon(url: string) {
    let link: HTMLLinkElement = this.renderer.selectRootElement(
      'link[rel="icon"]',
      true
    );
    if (link) {
      this.renderer.setAttribute(link, 'href', url);
    } else {
      link = this.renderer.createElement('link');
      this.renderer.setAttribute(link, 'rel', 'icon');
      this.renderer.setAttribute(link, 'type', 'image/x-icon');
      this.renderer.setAttribute(link, 'href', url);
      this.renderer.appendChild(document.head, link);
    }
  }

  goToAccount() {
    this.router.navigate(['/account']);
  }

  isHomePage() {
    return window.location.pathname === '/' || window.location.pathname === '';
  }

  // showHomeAsDefault() {
  //   let menuList = this.companyData.menuSettings.primaryMenu[0]?.template?.list;
  //   if (menuList) {
  //     return !menuList.some((page: any) => {
  //       page.abbr?.toLowerCase() === 'home' ||
  //       page.abbr?.toLowerCase() === 'homepage' ||
  //       page.abbr?.toLowerCase() === 'home-sample'
  //     });
  //   } else {
  //     return true;
  //   }
  // }

  checkAndLoadShipping() {
    return new Promise((resolve) => {
      this.appService.getGLocation().then(
        (data: any) => {
          this.appService.glocation = data;
          // this.appService.glocation.country = "IR";
          if (
            this.appService.getCountryNameByCountryCode(
              this.appService.glocation?.country
            ) != this.companyData.country
          ) {
            this.appService.isShipping = true;
          } else {
            this.appService.isShipping = false;
          }
          resolve(true);
        },
        (error: any) => {
          resolve(false);
        }
      );
    });
  }
  //
  isOnlyImage() { }

  openMobileMenu($event: any) {

    this.renderer.addClass(document.body, 'mmenu-active');
    this.renderer.setStyle(document.body, 'overflow', 'hidden');
  }

  isActive(slug: string): boolean {
    const currentUrl = this.router.url;

    // Handle root path
    if (slug === '' || slug === '/') {
      return currentUrl === '/' || currentUrl === '';
    }

    // Remove leading slash from slug if present
    const normalizedSlug = slug.startsWith('/') ? slug.substring(1) : slug;

    // Get the path without query parameters
    const currentPath = currentUrl.split('?')[0].split('#')[0];

    // Check if current path starts with the slug
    return (
      currentPath === `/${normalizedSlug}` ||
      currentPath.startsWith(`/${normalizedSlug}/`)
    );
  }

  currentLang() {
    return this.languageService.getLanguage();
  }

  // Initialize the mobile icon bar settings
  // Initialize the mobile icon bar settings
  initializeMobileIconBar(): void {
    try {
      // Check if companyData exists
      if (!this.companyData) {
        console.warn('Company data not initialized yet');
        return;
      }

      // Create a new instance of the class
      const mobileIconBarSettings = new MobileIconBarSettings();

      // Safely check and parse existing data
      if (this.companyData.mobileIconBar) {
        try {
          mobileIconBarSettings.ParseJson(this.companyData.mobileIconBar);
        } catch (parseError) {
          console.warn('Error parsing mobile icon bar settings:', parseError);
        }
      }

      // Assign the class instance
      this.companyData.mobileIconBar = mobileIconBarSettings;

      // Initialize template if needed
      if (!this.companyData.mobileIconBar.template) {
        this.companyData.mobileIconBar.template = {};
      }

      // Initialize defaults
      this.companyData.mobileIconBar.initializeDefaults();

      // Sort list if it exists
      if (this.companyData.mobileIconBar.template.list) {
        this.companyData.mobileIconBar.template.list.sort(
          (a: any, b: any) => a.index - b.index
        );
      }
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'AppComponent.initializeMobileIconBar' });
      // Create a default instance if initialization fails
      this.companyData.mobileIconBar = new MobileIconBarSettings();
      this.companyData.mobileIconBar.initializeDefaults();
    }
  }

  sanitizeIcon(icon: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(icon);
  }


}