// src/app/services/appServices.ts

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { AppConfigService } from "./app-config.service";
import { map, Observable, Subject, BehaviorSubject } from "rxjs";
import { takeUntil } from 'rxjs/operators';
import { Inject, Injectable, PLATFORM_ID, inject } from "@angular/core";
import { Router } from "@angular/router";
import { ShopService } from "./shopServices/shop.service";
import { AuthService } from "./authService/auth.service";
import { AlertService } from "./alertService/alert.service";
import { APP_CONFIG, AppConfig } from "../app-config.token";
import { isPlatformBrowser } from "@angular/common";

import { PickupSelectorPopComponent } from "../components/pickup-selector-pop/pickup-selector-pop.component";
import { ShippingSelectorPopComponent } from "../components/shipping-selector-pop/shipping-selector-pop.component";
import { ModalService } from "./modal.service";
import { NgbModalRef } from "@ng-bootstrap/ng-bootstrap";
import { DeliverySelectorPopComponent } from "../components/delivery-selector-pop/delivery-selector-pop.component";
import { ServiceSelectorPopComponent } from "../components/service-selector-pop/service-selector-pop.component";
import { LoggerService } from "./logger/logger.service";
import { RELEASE } from "../../version";

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

declare global {
  interface Window {
    fbq: any;
  }
}

declare global {
  interface Window {
    ttq: any;
  }
}

// Interface for service change event
export interface ServiceChangeEvent {
  serviceName: string;
  branchId?: string;
  addressKey?: string;
  previousServiceName?: string;
  previousBranchId?: string;
}

@Injectable({
  providedIn: "root"
})

export class AppServices {

  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);
  isMenuDataLoaded = false;
  windowLocationReload = false;

  // Seeded at construction time from src/version.ts (auto-bumped by
  // scripts/bump-version.mjs on every build). No more HTTP fetch needed.
  appVersion: string = RELEASE;
  isBrowser: boolean;

  subDomain: any;
  lang: string | any = 'en';
  auth_token = "";
  selectedUserAddress: any = null;

  // Private backing field for serviceName
  private _serviceName: string = "";

  // BehaviorSubject to track service changes
  private serviceChangeSubject = new BehaviorSubject<ServiceChangeEvent | null>(null);
  public serviceChange$ = this.serviceChangeSubject.asObservable();

  // Getter and setter for serviceName to emit changes
  get serviceName(): string {
    return this._serviceName;
  }

  set serviceName(value: string) {
    const previousServiceName = this._serviceName;
    this._serviceName = value;

    // Emit service change event
    if (previousServiceName !== value) {
      this.serviceChangeSubject.next({
        serviceName: value,
        previousServiceName: previousServiceName
      });
    }
  }

  deliveryStatus: string = ""; // open/close
  deliveryIsBusy: boolean = true; // if deliveryStatus is close check this
  pickUpStatus: string = "";  // open/close
  pickUpIsBusy: boolean = false;  // if pickUpStatus is close check this

  //website options
  //<--
  viewOnly = false;
  quickOrder = false;
  disablePayLater = false;
  disableScheduleOrder = false;
  processPaymentAfterAcceptance = false;
  redirectMenuToShop = false;
  disableDelivery = false;
  disablePickup = false;
  disableOtp = true;
  //--
  socialMedia = [];
  //--
  aboutText: string = "";
  termsText: string = "";
  contactEmail: string = "";
  contactPhone: string = "";
  //--
  glocation: any = {};
  isShipping: boolean = false; // if user location same company location it should be false , else true;
  shippingType: string = "delivery" //shipping / delivery
  //-->

  allCountries: any[] = [];
  showSelectMenuServicePop: boolean = true;
  enforceServiceSelection: boolean = false;

  constructor(
    @Inject(APP_CONFIG) private appConfig: Promise<AppConfig>,
    private config: AppConfigService,
    private http: HttpClient,
    private router: Router,
    private shopService: ShopService,
    private auth: AuthService,
    private alertService: AlertService,
    private modalService: ModalService,
    @Inject(PLATFORM_ID) private platformId: any,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.loadAppVersion();
    this.loadCountries();
    auth.currentToken.subscribe(v => {
      this.auth_token = v;
    });
    ;
  }

  /**
   * Emit a service change event manually
   * Use this when you want to notify subscribers about a service change
   */
  emitServiceChange(event: ServiceChangeEvent): void {
    this.serviceChangeSubject.next(event);
  }

  // Kept for backward compatibility with any external caller. The version is
  // already baked in at construction (`appVersion = RELEASE`), but we still
  // reassign here in case something later calls this expecting a refresh.
  loadAppVersion() {
    this.appVersion = RELEASE;
  }

  async loadCountries() {
    let tempCountriesData: any[] = await this.loadFileJson("./assets/json/countries.json");
    tempCountriesData.sort((a, b) => {
      return a.dial_code.localeCompare(b.dial_code);
    });
    this.allCountries = tempCountriesData || [];
  }

  getHeaders() {
    let params: any = {
      'Content-Type': 'application/json'
    }
    if (this.auth_token) {
      params["Auth-Token"] = this.auth_token
    }
    return new HttpHeaders(params);
  }

  getFetchHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.auth_token) {
      headers['Auth-Token'] = this.auth_token;
    }

    return headers;
  }

  async loadFileJson(filePath: string) {
    return new Promise<any>((resolve, reject) => {
      this.http.get(filePath).subscribe(
        (data: any) => {
          if (data != null) {
            resolve(data);
          } else {
            reject('No data received');
          }
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  async initializeApp() {
    return new Promise(async (response) => {
      // FIX: Guard against SSR — window does not exist on the server.
      // initializeApp() is only meaningful in the browser; bail out early
      // to prevent "window is not defined" crashes during SSR/hydration.
      if (typeof window === 'undefined') {
        console.warn('[initializeApp] SSR context detected — skipping browser-only init.');
        response(true);
        return;
      }

      let domain: any = this.getMainDomain(window.location.host);

      if (
        this.isAlternativeLocal() ||
        this.isLocalConfig() ||
        this.isOnPrem() ||
        this.isDevConfig() ||
        this.isTestConfig() ||
        this.isProdConfig() ||
        domain === 'invopos.shop'
      ) {
        await this.initSubDomain();

        // FIX: If initSubDomain() detected a reserved hostname prefix (e.g. "www",
        // "dev") and left subDomain empty, fall through to getSlugByDomain so the
        // full domain is resolved to the correct company slug server-side.
        // Without this, the request fires as './v1/ecommerce//getCompanyPrefrences'
        // and the backend returns "Company Not Found".
        if (!this.subDomain && domain) {
          console.warn('[initializeApp] initSubDomain returned empty slug — falling back to getSlugByDomain for domain:', domain);
          this.subDomain = await this.getSlugByDomain(domain);
        }
      } else {
        //custom domain
        this.subDomain = await this.getSlugByDomain(domain);
      }

      // FIX: Validate that a subdomain was actually resolved before mutating
      // baseUrl. An empty/falsy subdomain would produce a URL like
      // './v1/ecommerce//getCompanyPrefrences' which the backend rejects
      // with "Company Not Found".
      if (!this.subDomain) {
        this.logger.error(new Error('[initializeApp] subDomain is empty — cannot build a valid baseUrl. Check your config.json or domain lookup.'), { context: 'AppServices.initializeApp' });
        response(false);
        return;
      }

      this.config.baseUrl = this.config.baseUrl + this.subDomain + '/';

      // FIX: Mark config as initialized BEFORE resolving the promise so that
      // any code awaiting initializeApp() sees isInitialized === true
      // immediately and can safely call API services.
      this.config.isInitialized = true;

      this.auth.currentToken.subscribe(v => {
        this.auth_token = v;
        this.auth.checkLoggedIn();
      });

      response(true);
    });
  }

  async initSubDomain() {
    let appConfig = await (this.appConfig);
    this.subDomain = appConfig.subdomain?.trim() ?? '';

    if (!this.subDomain) {
      // FIX: Guard against SSR — window.location is not available server-side.
      // Falling back to the hostname first segment is only valid in the browser.
      if (typeof window !== 'undefined') {
        const firstSegment = window.location.hostname.split('.')[0];

        // FIX: Reserved hostname prefixes (www, dev, test, staging, etc.) are NOT
        // company slugs. Using them as-is causes the backend to throw "Company Not
        // Found" because no company is registered under those names.
        // When we detect one of these prefixes AND the hostname has more than one
        // segment (i.e. it's not a bare on-prem hostname), we leave subDomain empty
        // so that initializeApp() can fall through to getSlugByDomain() instead.
        const RESERVED_PREFIXES = ['www', 'dev', 'test', 'staging', 'preprod', 'uat', 'qa', 'demo'];
        const isMultiSegment = window.location.hostname.split('.').length > 1;

        if (RESERVED_PREFIXES.includes(firstSegment.toLowerCase()) && isMultiSegment) {
          console.warn(
            `[initSubDomain] Hostname prefix "${firstSegment}" is a reserved word, not a company slug. ` +
            'Leaving subDomain empty so getSlugByDomain() can resolve it from the full domain.'
          );
          this.subDomain = '';
        } else {
          this.subDomain = firstSegment;
        }
      } else {
        console.warn('[initSubDomain] SSR context and no subdomain in config — subDomain will be empty.');
      }
    }

  }

  getMainDomain(url: string) {
    try {
      // Split the url into parts
      const parts = url.split('.').reverse();
      // The domain should be the second part from the end
      if (parts.length > 1) {
        // Handle cases with country-code TLDs like '.co.uk'
        const tld = parts[0];
        const sld = parts[1];
        if (parts.length > 2 && tld.length === 2 && sld.length > 2) {
          return `${sld}.${tld}`;
        }
        return `${sld}.${tld}`;
      }
      // If there is no valid domain found, return null
      return null;
    } catch (error) {
      this.logger.error(error, { context: 'AppServices.getMainDomain', url });
      return null;
    }
  }

  isAlternativeLocal() {
    if (typeof window === 'undefined') return false;
    if (
      window.location.host.includes("nip.io") || window.location.host.includes("vcap.me")
    ) {
      return true;
    } else {
      return false;
    }
  }

  isLocalConfig() {
    if (typeof window === 'undefined') return false;
    if (
      window.location.host.includes("localhost") || window.location.host.includes("10.2.2")
    ) {
      return true;
    } else {
      return false;
    }
  }

  isOnPrem() {
    if (typeof window === 'undefined') return false;
    if (this.isLocalConfig() == false &&
      window.location.host.includes(".") == false
    ) {
      return true;
    } else {
      return false;
    }
  }

  isDevConfig() {
    if (typeof window === 'undefined') return false;
    if (window.location.host == "devback.invopos.co") {
      return true;
    } else {
      return false;
    }
  }

  isTestConfig() {
    if (typeof window === 'undefined') return false;
    if (
      window.location.host == "testback.invopos.co"
    ) {
      return true;
    } else {
      return false;
    }
  }

  isProdConfig() {
    if (typeof window === 'undefined') return false;
    if (window.location.host == "productionback.invopos.co"
    ) {
      return true;
    } else {
      return false;
    }
  }

  getSlugByDomain(domain: any) {
    return new Promise(response => {
      this.getSlugByDomainData({ Domain: domain }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (responseData: any) => {
          if (responseData) {
            response(responseData.slug);
          }
        },
        error: (err: any) => {
          this.logger.error(err, { context: 'AppServices.getSlugByDomain' }); // Handle errors
          response(false);
        },
      });
    })
  }

  getSlugByDomainData(body: any): Observable<any> {
    return this.http
      .post<{ success: boolean; data: any[] }>(`${this.config.baseUrl?.replace('/ecommerce/', '/')}app/getSlugByDomain`, body)
      .pipe(
        map((response: any) => {
          if (response.success) {
            return response.data;
          }
          return null;
        })
      );
  }

  hexToRgba(hex: string, opacity = 0.3) {
    // Remove the hash at the start if it's there
    hex = hex.replace(/^#/, '');

    // Parse r, g, b values
    let r, g, b;
    if (hex.length === 3) {
      r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
      g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
      b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else {
      throw new Error('Invalid hex color format');
    }

    // Return the RGBA color
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  initGoogleAnalytics(trackingId: string) {
    if (isPlatformBrowser(this.platformId)) {
      const scriptElement = document.createElement('script');
      scriptElement.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
      scriptElement.async = true;
      if(scriptElement != null && scriptElement != undefined){
        document.head.appendChild(scriptElement);
      }

      window['dataLayer'] = window['dataLayer'] || [];
      window['gtag'] = function () {
        window['dataLayer'].push(arguments);
      };
      window['gtag']('js', new Date());
      window['gtag']('config', trackingId);
    }
  }

  initFacebookPixel(facebookPixelID: string) {
    if (isPlatformBrowser(this.platformId)) {
      if (window.fbq) return;

      window.fbq = function () {
        window.fbq.callMethod ? window.fbq.callMethod.apply(window.fbq, arguments) : window.fbq.queue.push(arguments);
      };
      window.fbq.push = window.fbq;
      window.fbq.loaded = true;
      window.fbq.version = '2.0';
      window.fbq.queue = [];

      const scriptElement = document.createElement('script');
      scriptElement.async = true;
      scriptElement.src = 'https://connect.facebook.net/en_US/fbevents.js';
      if(scriptElement != null && scriptElement != undefined){
        document.head.appendChild(scriptElement);
      }

      window.fbq('init', facebookPixelID);
    }
  }

  initTikTokPixel(pixelId: string) {
    if (isPlatformBrowser(this.platformId)) {
      if (window.ttq) return;

      window.ttq = window.ttq || [];
      window.ttq.push(['init', pixelId]);
      window.ttq.push(['track', 'PageView']);

      const scriptElement = document.createElement('script');
      scriptElement.async = true;
      scriptElement.src = 'https://analytics.tiktok.com/i18n/pixel/sdk.js';
      if(scriptElement != null && scriptElement != undefined){
        document.head.appendChild(scriptElement);
      }

    }
  }

  gotoPage(item: any, queryParams?: any) {
    window.scrollTo({ top: 0 });
    if (item?.type == "customUrl" || item?.abbr == "customUrl") {
      window.open(item.customUrl, '_blank');
    } else if (item?.type == "collections" || item?.abbr == "collections") {
      this.router.navigate(['/collections/' + item.abbr?.toLowerCase()], { queryParams: {} });
    } else if (item?.type == "plus" || item?.abbr == "plus") {
      this.router.navigate(['/' + item.abbr?.toLowerCase()], { queryParams: {} });
    } else if (item?.type == "orders" || item?.abbr == "orders") {
      this.router.navigate(['/my-orders'], { queryParams: {} });
    } else if (item?.type == "reservations" || item?.abbr == "reservations") {
      this.router.navigate(['/my-reservations'], { queryParams: {} });
    } else if (item?.type == "pages" || item?.abbr == "pages") {
      this.router.navigate(['/' + item.abbr?.toLowerCase()], { queryParams: queryParams });
    } else if (item?.type == "services" || item?.abbr == "services") {

      if (item.abbr == 'pickup-menu') {
        this.showPickupSelectorPop();
      } else if (item.abbr == 'delivery-menu') {
        if (this.shippingType == 'shipping') {
          this.showShippingSelectorPop();
        } else {
          this.showDeliverySelectorPop();

        }

      } else if (item.abbr) {
        this.router.navigate(['/' + item.abbr?.toLowerCase()], { queryParams: queryParams });
      }
      // }
    } else {
      if (item?.abbr) {
        this.router.navigate(['/' + item?.abbr], { queryParams: queryParams });
      } else {
        this.router.navigate(['/']);
      }
    }
  }

  showPickupSelectorPop() {
    if (!this.isBrowser) return;
    const modalRef = this.modalService.openWithData(PickupSelectorPopComponent, {}, {
      centered: true,
      windowClass: "modal-md modal-fullscreen-md-down",
      backdrop: 'static',
      keyboard: false
    });

    this.handleModalResult(modalRef);
    this.showSelectMenuServicePop = false;
  }

  showShippingSelectorPop() {
    if (!this.isBrowser) return;
    const modalRef = this.modalService.openWithData(ShippingSelectorPopComponent, {}, {
      centered: true,
      windowClass: "modal-md modal-fullscreen-md-down",
      backdrop: 'static',
      keyboard: false
    });
    this.handleModalResult(modalRef);
    this.showSelectMenuServicePop = false;
  }

  showDeliverySelectorPop() {
    if (!this.isBrowser) return;
    const modalRef = this.modalService.openWithData(DeliverySelectorPopComponent, {}, {
      centered: true,
      windowClass: "modal-md modal-fullscreen-md-down",
      backdrop: 'static',
      keyboard: false
    });

    this.handleModalResult(modalRef);
    this.showSelectMenuServicePop = false;
  }

  private handleModalResult(modalRef: NgbModalRef): void {
    modalRef.result.then(
      (data: any) => {
        if (data && data.success) {
          // Handle success
        }
      },
      (reason: any) => {
        // Handle dismissal
      }
    ).catch(error => {
      this.logger.error(error, { context: 'AppServices.handleModalResult' });
    });
  }

  getOptionGroupTitle(group: any) {
    let text = "";
    if (group.translation) {
      if (this.lang == 'ar') {
        text = group.translation?.alias?.ar || group.translation?.title?.ar || group.title;
      } else {
        text = group.translation?.alias?.en || group.translation?.title?.en || group.title;
      }
    } else {
      text = group.alias || group.title;
    }
    return text;
  }

  getOptionName(option: any) {
    let text = "";
    // console.log("getOptionName.option", option);
    if (option.translation) {
      if (this.lang == 'ar') {
        text = option.translation?.displayName?.ar || option.translation?.alias?.ar || option.translation?.name?.ar || option.optionName;
      } else {
        text = option.translation?.displayName?.en || option.translation?.alias?.en || option.translation?.name?.en || option.optionName;
      }
    } else {
      text = option.displayName || option.alias || option.optionName;
    }
    return text;
  }

  getBranchStatusValue() {
    if (this._serviceName == 'PickUp') {
      if (this.pickUpStatus == 'close') {
        if (this.pickUpIsBusy) {
          return 'busy';
        } else {
          return 'close';
        }
      } else {
        return 'open';
      }
    } else if (this._serviceName == 'Delivery') {
      if (this.deliveryStatus == 'close') {
        if (this.deliveryIsBusy) {
          return 'busy';
        } else {
          return 'close';
        }
      } else {
        return 'open';
      }
    } else {
      return 'open';
    }
  }

  getGLocation() {
    return new Promise(async (resolve, reject) => {
      try {
        // FIX: cap the third-party geo lookup at 3s. ipinfo.io can be slow
        // or fully blocked on corporate / ad-block networks; without a
        // timeout the surrounding await chain stalled the boot indefinitely
        // and left the app stuck on the loading spinner.
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

  getCountryNameByCountryCode = (countryCode: any) => {

    const result = this.allCountries.filter((country) => country.code == countryCode);
    if (result && result.length) {
      return result[0].name;
    } else {
      return undefined;
    }
  }


  getOptionGroupName(groupedOptions: any) {
    // Get the first option to access optionGroupTranslation
    const firstOption = groupedOptions.options[0];
    let text = "";

    if (firstOption?.optionGroupTranslation) {
      if (this.lang == 'ar') {
        text = firstOption.optionGroupTranslation?.displayName?.ar ||
          firstOption.optionGroupTranslation?.alias?.ar ||
          firstOption.optionGroupTranslation?.name?.ar ||
          groupedOptions.optionGroupName;
      } else {
        text = firstOption.optionGroupTranslation?.displayName?.en ||
          firstOption.optionGroupTranslation?.alias?.en ||
          firstOption.optionGroupTranslation?.name?.en ||
          groupedOptions.optionGroupName;
      }
    } else {
      text = groupedOptions.optionGroupName;
    }

    return text;
  }

  getGroupedOptions(options: any[]): any {
    const grouped = options.reduce((acc, option) => {
      const groupId = option.optionGroupId;
      if (!acc[groupId]) {
        acc[groupId] = {
          optionGroupId: groupId,
          optionGroupName: option.optionGroupName,
          options: []
        };
      }
      acc[groupId].options.push(option);
      return acc;
    }, {});

    return Object.values(grouped);
  }

  modal: any;
  private isServiceSelectorOpen: boolean = false;

  showServiceSelector(): void {
    if (!this.isBrowser) return;

    // Prevent opening if already open
    if (this.isServiceSelectorOpen) {
      return;
    }

    try {
      // Check if modal service is available
      if (!this.modalService) {
        this.logger.error(new Error('Modal service not available'), { context: 'AppServices.showServiceSelector' });
        return;
      }

      // Set flag before opening
      this.isServiceSelectorOpen = true;
      this.showSelectMenuServicePop = false;
      const modalRef = this.modalService.openWithData(ServiceSelectorPopComponent, null, {
        centered: true,
        size: 'md',
        windowClass: 'md_modal',
        backdrop: 'static',
        keyboard: false,
      });

      // Reset flag when modal closes (either by close or dismiss)
      modalRef.result.then(
        () => {
          this.isServiceSelectorOpen = false;
        },
        () => {
          this.isServiceSelectorOpen = false;
        }
      ).catch(() => {
        this.isServiceSelectorOpen = false;
      });

    } catch (error) {
      this.logger.error(error, { context: 'AppServices.showServiceSelector' });
      this.isServiceSelectorOpen = false; // Reset flag on error
    }
  }

  /**
   * Build a safe image src for a product / cart line.
   *
   * Different code paths attach `mediaUrl` in different shapes:
   *   - a plain string URL ("https://.../foo.png")
   *   - an object like `{ defaultUrl: "https://.../foo.png", ... }` (page-builder model)
   *   - undefined / null (no media)
   *   - the wishlist serialises the whole product into localStorage, so it
   *     can store the object form even where the runtime expected a string.
   *
   * Templates were doing `product.mediaUrl + '?width=300' || 'fallback'`
   * which had two bugs: it stringified objects to "[object Object]" (causing
   * `<img src="/[object%20Object]">` requests that hammered the SSR until
   * the rate-limiter returned 429), and the `||` fallback never fired
   * because string concatenation always yields a non-empty string.
   *
   * Use this from any template: `[src]="appService.productImage(item.mediaUrl, 300)"`.
   */
  productImage(mediaUrl: any, width: number = 300): string {
    let url: string | null = null;
    if (typeof mediaUrl === 'string' && mediaUrl) {
      url = mediaUrl;
    } else if (mediaUrl && typeof mediaUrl === 'object' && typeof mediaUrl.defaultUrl === 'string' && mediaUrl.defaultUrl) {
      url = mediaUrl.defaultUrl;
    }
    if (!url) return 'assets/images/default-blank-image.png';
    return width ? `${url}?width=${width}` : url;
  }

}