import { Component, computed, signal, inject, OnDestroy } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { AppServices } from 'src/app/services/appServices';
import { Invoice } from 'src/app/models/invoice-model';
import { CartService } from 'src/app/services/cartServices/cart.service';
import { ShippingService } from 'src/app/services/shipping.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface DisplayState {
  type: 'loading' | 'no-countries' | 'no-matches' | 'show-countries';
  showCountries: boolean;
  message?: any;
}

@Component({
  selector: 'app-shipping-selector-pop',
  imports: [TranslateModule, FormsModule],
  templateUrl: './shipping-selector-pop.component.html',
  styleUrl: './shipping-selector-pop.component.css'
})
export class ShippingSelectorPopComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  private logger = inject(LoggerService);
  // Signals for reactive data management
  invoiceData!: Invoice;
  allCountries = signal<any[]>([]);
  shippingSetting = signal<any[]>([]);
  shippingCountries = signal<any[]>([]);
  searchText = signal<string>('');
  isLoading = signal<boolean>(false);

  // Computed properties
  filteredCountries = computed(() => {
    const countries = this.shippingCountries();
    const search = this.searchText().trim().toLowerCase();

    let filtered = countries;

    if (search) {
      filtered = countries.filter(country =>
        country.name.toLowerCase().includes(search) ||
        country.code.toLowerCase().includes(search)
      );
    }

    // Sort alphabetically by country name
    return filtered.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  });

  displayState = computed((): DisplayState => {
    if (this.isLoading()) {
      return {
        type: 'loading',
        showCountries: false,
        message: 'Loading available countries...'
      };
    }

    const allCountries = this.shippingCountries();
    const filteredCountries = this.filteredCountries();
    const hasSearch = this.searchText().trim().length > 0;

    if (allCountries.length === 0) {
      return {
        type: 'no-countries',
        showCountries: false,
        message: 'No shipping countries available'
      };
    }

    if (hasSearch && filteredCountries.length === 0) {
      return {
        type: 'no-matches',
        showCountries: false,
        message: `No countries found for "${this.searchText()}"`
      };
    }

    return {
      type: 'show-countries',
      showCountries: true
    };
  });

  constructor(
    private router: Router,
    private cartService: CartService,
    private shippingService: ShippingService,
    public appService: AppServices,
    public activeModal: NgbActiveModal
  ) {
    this.allCountries.set([...this.appService.allCountries]);
  }

  async ngOnInit() {
    this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: any) => {
        if (invoiceData) this.invoiceData = invoiceData;
      },
    });

    this.searchText.set('');
    await this.getShippingSetting();
  }

  onSearchChange(value: string) {
    this.searchText.set(value);
  }

  closePop() {
    setTimeout(() => {
      this.activeModal.close();
    }, 75);
  }

  getShippingSetting() {
    this.isLoading.set(true);
    return new Promise<void>((resolve) => {
      this.shippingService.getShippingSettings().pipe(takeUntil(this.destroy$)).subscribe({
        next: (response: any[]) => {
          this.shippingSetting.set(response);
          const zoneCountryCodes = response.map(z => z.CountryCode);
          const availableCountries = this.allCountries().filter((country: any) =>
            zoneCountryCodes.includes(country.code)
          );
          this.shippingCountries.set(availableCountries);
          this.isLoading.set(false);
          resolve();
        },
        error: () => {
          this.isLoading.set(false);
          resolve();
        }
      });
    });
  }

  /**
   * FIX: await the cart update before closing so that when checkout's
   * editService() handler fires, the invoiceData (and payment methods) are
   * already up-to-date on the server side.
   * Then close with { success: true, countryCode, country } so checkout can
   * update its local state (address.country, selectedShipping, phoneCode, etc.).
   */
  async onClickShippingCountry(country: any) {
    this.isLoading.set(true);
    try {
      await this.updateCart(country.code);
    } catch (err: any) {
      this.logger.error(err?.message, { stack: err?.stack, context: 'ShippingSelectorPopComponent.cartUpdate' });
    } finally {
      this.isLoading.set(false);
    }

    if (this.router.url.includes('/checkout')) {
      setTimeout(() => {
        this.activeModal.close({ success: true, countryCode: country.code, country });
      }, 75);
      window.scrollTo({ top: 0 });
    } else {
      this.router.navigate(['/shop'], { queryParams: { service_name: 'Shipping' } });
      setTimeout(() => {
        this.activeModal.close();
      }, 75);
      window.scrollTo({ top: 0 });
    }
  }

  /**
   * FIX: changeService2 returns a Promise — await it directly instead of
   * wrapping in another Promise and calling .subscribe() on it.
   */
  async updateCart(addressKey: string): Promise<any> {
    try {
      const result = await this.cartService.changeService2({
        sessionId: this.invoiceData.onlineData.sessionId,
        branchId: this.invoiceData.branchId,
        addressKey: addressKey,
        serviceName: 'Shipping',
      });
      return result;
    } catch (err: any) {
      this.logger.error(err?.message, { stack: err?.stack, context: 'ShippingSelectorPopComponent.cartUpdateFailed' });
      return null;
    }
  }

  getCountryFlag(countryCode: string): string {
    return `https://flagcdn.com/24x18/${countryCode.toLowerCase()}.png`;
  }

  cancel() {
    if (this.appService.enforceServiceSelection) {
      this.appService.showSelectMenuServicePop = true;
      if (this.router.url.includes('/shop') || this.router.url.includes('/menu')) {
        this.appService.showServiceSelector();
      }
    }
    this.activeModal.dismiss('');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}