import { Component, signal, computed, inject, OnDestroy } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Shopper } from 'src/app/models/shopper.module';
import { AppServices } from 'src/app/services/appServices';
import { AuthService } from 'src/app/services/authService/auth.service';
import { CartService } from 'src/app/services/cartServices/cart.service';
import { CompanyServices } from 'src/app/services/companyServices/company.service';
import { CurrencyService } from 'src/app/services/currencyService/currency.service';
import { ShopService } from 'src/app/services/shopServices/shop.service';
import { Company } from 'src/app/models/company.model';
import { FormsModule } from '@angular/forms';
import { AlertService } from 'src/app/services/alertService/alert.service';
import { DeliveryAddress, CoveredZone } from 'src/app/models/company-delivery-address.model';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Branch } from 'src/app/models/branch.model';
import { LanguageService } from 'src/app/services/langauge.service';
import { MapComponent } from './map/map.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-delivery-selector-pop',
  imports: [
    TranslateModule, MapComponent, FormsModule
  ],
  templateUrl: './delivery-selector-pop.component.html',
  styleUrl: './delivery-selector-pop.component.css'
})
export class DeliverySelectorPopComponent implements OnDestroy {

  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);
  // Signals for reactive state management
  showDeliverySelector = signal<boolean>(true);
  addresses = signal<DeliveryAddress[]>([]);
  address = signal<DeliveryAddress | undefined>(undefined);
  currentCurrency = signal<any>({});
  userData = signal<Shopper | any>(new Shopper());
  addressType = signal<any>(null);
  showMap = signal<boolean>(false);
  searchText = signal<string>('');
  deliveryType = signal<string>('');
  company = signal<Company | null>(null);
  isLoading = signal<boolean>(true);
  invoiceData: any;

  // ── Signals to pass pre-fetched map data down to MapComponent
  zones = signal<CoveredZone[]>([]);
  branches = signal<Branch[]>([]);

  // Computed signals for filtered data and display states
  filteredAddresses = computed(() => {
    const search = this.searchText().toLowerCase().trim();
    const allAddresses = this.addresses();
    const lang = this.languageService.$t.currentLang as 'ar' | 'en';

    let filtered = allAddresses;

    if (search) {
      filtered = allAddresses.filter(address => {
        // Match addressKey (always)
        if (address.addressKey?.toLowerCase().includes(search)) return true;

        // Match any translated value in the translation map
        if (address.translation) {
          for (const key of Object.keys(address.translation)) {
            const entry = address.translation[key];
            if (
              entry?.ar?.toLowerCase().includes(search) ||
              entry?.en?.toLowerCase().includes(search)
            ) {
              return true;
            }
          }
        }
        return false;
      });
    }

    // Sort alphabetically by translated label in current lang, fallback to addressKey
    return filtered.sort((a, b) => {
      const labelA = this.getTranslatedLabel(a, lang) || a.addressKey || '';
      const labelB = this.getTranslatedLabel(b, lang) || b.addressKey || '';
      return labelA.localeCompare(labelB);
    });
  });

  filteredUserAddresses = computed(() => {
    const search = this.searchText().toLowerCase().trim();
    const user = this.userData();

    let filtered = user?.addresses || [];

    if (search) {
      filtered = filtered.filter((address: any) =>
        address.title?.toLowerCase().includes(search)
      );
    }

    // Sort alphabetically by title
    return filtered.sort((a: any, b: any) =>
      (a.title || '').localeCompare(b.title || '')
    );
  });

  // Computed signal for display states
  displayState = computed(() => {
    const allAddresses = this.addresses();
    const filtered = this.filteredAddresses();
    const search = this.searchText().trim();
    const loading = this.isLoading();

    if (loading) {
      return {
        type: 'loading',
        message: 'Loading addresses...',
        showAddresses: false
      };
    }

    if (allAddresses.length === 0) {
      return {
        type: 'no-addresses',
        message: 'No delivery addresses available',
        showAddresses: false
      };
    }

    if (search && filtered.length === 0) {
      return {
        type: 'no-matches',
        message: `No addresses found for "${search}"`,
        showAddresses: false
      };
    }

    return {
      type: 'show-addresses',
      message: '',
      showAddresses: true
    };
  });

  constructor(
    private shopService: ShopService,
    private companyService: CompanyServices,
    private router: Router,
    private cartService: CartService,
    private currencyService: CurrencyService,
    private authService: AuthService,
    public appService: AppServices,
    private alertService: AlertService,
    public activeModal: NgbActiveModal,
    public languageService: LanguageService,
  ) { }

  async ngOnInit() {

    this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: any) => { if (responseData) this.invoiceData = responseData; },
    });

    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe((company: Company) => {
      this.company.set(company);
    });

    this.currencyService.currentCurrency.pipe(takeUntil(this.destroy$)).subscribe(currency => {
      this.currentCurrency.set(currency);
    });

    this.searchText.set('');

    this.getUserData();
    await this.getAddresses();
    this.isLoading.set(false);
  }

  closePop() {
    setTimeout(() => {
      this.activeModal.close();
    }, 75);
  }

  // Update search text (this will automatically trigger filtering via computed signal)
  onSearchChange(value: string) {
    this.searchText.set(value);
  }

  getUserData() {
    this.authService.userData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: any) => {
        if (responseData) {
          this.userData.set(responseData);
        } else {
          this.userData.set({});
        }
      },
    });
  }

  getAddresses() {
    return new Promise(response => {
      this.companyService.getCompanyDeliveryAddresses().pipe(takeUntil(this.destroy$)).subscribe({
        next: (responseData) => {
          if (responseData) {
            if (Array.isArray(responseData.addresses)) {
              this.addresses.set(responseData.addresses);
              this.addressType.set(responseData.addresses[0]?.type || null);
            } else {
              this.address.set(responseData.addresses);
            }

            this.deliveryType.set(responseData.deliveryAreaType);

            // ── Extract zones + branches so MapComponent doesn't need to re-fetch
            if (responseData.deliveryAreaType === 'zones' && responseData.addresses?.coveredZones) {
              this.zones.set(responseData.addresses.coveredZones ?? []);
              this.branches.set(responseData.addresses.branches ?? []);
            }

            if (responseData.deliveryAreaType === 'zones') {
              this.showDeliverySelector.set(false);
              this.showMap.set(true);
            }
          }
          response(true);
        },
        error: (error: any) => {
          this.logger.error(error?.message, { stack: error?.stack, context: 'DeliverySelectorPopComponent.fetchAddresses' });
          response(false);
        }
      });
    });
  }

  onClickAddress(address: any) {
    this.appService.selectedUserAddress = null;
    this.updateCart(address.addressKey).then(() => {
      // if (this.router.url.includes("/checkout")) {
      //   this.activeModal.close({ success: true, addressKey: address.addressKey });
      //   window.scrollTo({ top: 0 });
      // } else 
      if (this.company()?.themeSettings?.template?.showLocationPicker == false) {
        if (this.router.url.includes("/checkout")) {
          setTimeout(() => {
            this.activeModal.close({ success: true, addressKey: address.addressKey });
          }, 75);
          window.scrollTo({ top: 0 });
        } else {
          if (this.appService.redirectMenuToShop || this.router.url.includes("/shop")) {
            this.router.navigate(['/shop'], { queryParams: { addressKey: address.addressKey, service_name: "Delivery" } });
          } else {
            this.appService.isMenuDataLoaded = false;
            this.router.navigate(['/menu'], { queryParams: { addressKey: address.addressKey, service_name: "Delivery" } });
          }
          this.closePop();
          window.scrollTo({ top: 0 });
        }
      } else {
        this.showMap.set(true);
        localStorage.setItem('currentAddressKey', address.addressKey);
        this.showDeliverySelector.set(false);
      }
    });
  }

  onMapClosed() {
    this.showMap.set(false);
    document.body.style.overflow = 'auto';
  }

  onClickUserAddress(address: any) {
    this.appService.selectedUserAddress = address;

    let addressKey = "";
    const currentAddressType = this.addressType();

    if (currentAddressType === "Governorate") {
      addressKey = address.governorate;
    } else if (currentAddressType === "City") {
      addressKey = address.city;
    } else if (currentAddressType === "Block") {
      addressKey = address.block;
    }

    this.updateCart(addressKey).then(data => {
      if (data) {
        if (this.router.url.includes("/checkout")) {
          localStorage.setItem('selectedUserAddress', JSON.stringify(address));
          setTimeout(() => {
            this.activeModal.close({ success: true, selectedAddress: address, addressKey });
          }, 75);
          window.scrollTo({ top: 0 });
        } else if (this.appService.redirectMenuToShop || this.router.url.includes("/shop")) {
          this.router.navigate(['/shop'], { queryParams: { addressKey: addressKey, service_name: "Delivery" } });
          this.closePop();
          window.scrollTo({ top: 0 });
        } else {
          this.appService.isMenuDataLoaded = false;
          this.router.navigate(['/menu'], { queryParams: { addressKey: addressKey, service_name: "Delivery" } });
          this.closePop();
          window.scrollTo({ top: 0 });
        }
      } else {
        this.alertService.showAlert({ title: "This address is not available for delivery at the moment" });
      }
    });
  }

  updateCart(addressKey: string) {
    return new Promise(response => {
      const res = this.cartService.changeService2({
        sessionId: this.invoiceData?.onlineData?.sessionId,
        addressKey: addressKey,
        serviceName: 'Delivery',
      });
      response(res);
    });
  }

  getConvertedPrice(totalPrice: number) {
    const currency = this.currentCurrency();
    const price = (totalPrice / (currency.rate || 0)) || 0;
    return price.toFixed(currency.afterDecimal);
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

  shouldInclude(searchText: any, item: any, type?: string) {
    let isSearchTextValid = searchText != null && searchText.length > 0;
    let doesIncludeSearchText = false;
    if (type == 'user-address') {
      doesIncludeSearchText = item.title.toLowerCase().includes(searchText.toLowerCase());
    } else {
      doesIncludeSearchText = item.addressKey.toLowerCase().includes(searchText.toLowerCase());
    }
    return isSearchTextValid === false || doesIncludeSearchText === true;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cancel() {
    this.activeModal.dismiss('');
    if (this.appService.enforceServiceSelection) {
      this.appService.showSelectMenuServicePop = true;
      if (this.router.url.includes('/shop') || this.router.url.includes('/menu')) {
        this.appService.showServiceSelector();
      }
    }
  }
}