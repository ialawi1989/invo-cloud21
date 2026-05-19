import { Component, HostListener, Inject, PLATFORM_ID, OnDestroy} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cartServices/cart.service';

import { Invoice } from '../../models/invoice-model';
import { Company } from '../../models/company.model';
import { CompanyServices } from '../../services/companyServices/company.service';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { CurrencyService } from '../../services/currencyService/currency.service';
import { TranslateModule } from '@ngx-translate/core';
import { AppServices } from '../../services/appServices';
import { NavigationTrackerService } from 'src/app/services/track-product-nav.service';
import { AlertService } from 'src/app/services/alertService/alert.service';
import { Location } from '@angular/common';
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';
import { PageData } from 'src/app/models/page-data/pageData';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-cart',
  imports: [
    RouterLink,
    TranslateModule,
    CommonModule
  ],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css'
})
export class CartComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  invoiceData?: Invoice | any;
  companyData: Company = new Company();

  isBrowser: boolean;
  currentCurrency: any = {};
  canGoBack: boolean = false;
  pageData: PageData | any = new PageData();

  constructor(
    private cartService: CartService,
    @Inject(PLATFORM_ID) private platformId: any,
    private currencyService: CurrencyService,
    private companyService: CompanyServices,
    public appService: AppServices,
    private navTracker: NavigationTrackerService,
    private pageBuilderServices: PageBuilderService,
    private router: Router,
    private alertService: AlertService,
    private location: Location,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  }

  ngOnInit(): void {
    setTimeout(() => {
      window.scrollTo({ top: 0 });
    }, 75);
    this.currencyService.currentCurrency.pipe(takeUntil(this.destroy$)).subscribe(currency => {
      this.currentCurrency = currency;
    });


    if (this.isBrowser) {
      const savedCurrency = localStorage.getItem('selectedCurrency');

      if (savedCurrency) {
        const currency = JSON.parse(savedCurrency);
        this.currentCurrency = currency;
      }
    }

    this.getCompanyData();
    this.getPageData();
    this.getCartInvoiceData()
  }

  getCompanyData() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => {
        this.companyData = data;
      },
    });
  }

  getCartInvoiceData() {
    this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: Invoice | null) => {
        if (invoiceData) {
          this.invoiceData = invoiceData;
        }
      },
    });
  }

  getConvertedPrice(totalPrice: number) {
    var price = (totalPrice / (this.currentCurrency.rate || 0)) || 0
    return price.toFixed(this.currentCurrency.afterDecimal);
  }

  // Per-line UI state so the row can show a "working" affordance while a
  // mutation is in flight. busyLineIds = qty change pending, removingLineIds =
  // delete pending (animated fade-out before the line disappears from
  // invoiceData). Rapid clicks against the same line are also deduped here.
  busyLineIds = new Set<string>();
  removingLineIds = new Set<string>();

  isLineBusy(id: string): boolean {
    return this.busyLineIds.has(id) || this.removingLineIds.has(id);
  }

  removeItem(id: string) {
    if (this.removingLineIds.has(id)) return;
    this.removingLineIds.add(id);
    this.cartService.removeItemFromCart({ transactionId: id, sessionId: this.invoiceData.onlineData.sessionId }).pipe(takeUntil(this.destroy$)).subscribe({
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

  changeQty(qty: number, id: string, event: string) {
    if (event === 'increase') {
      qty++;
    } else {
      if (qty === 1) {
        return;
      }
      qty--;
    }
    if (this.busyLineIds.has(id)) return;
    this.busyLineIds.add(id);
    this.cartService.changeItemQty({ qty, transactionId: id, sessionId: this.invoiceData.onlineData.sessionId }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: Invoice | null) => {
        this.busyLineIds.delete(id);
        if (this.appService.getBranchStatusValue() != 'open') {
          this.alertService.showAlert({title:"Branch is " + this.appService.getBranchStatusValue()});
          return;
        }
        if (invoiceData) {
          this.invoiceData = invoiceData;
        }
      },
      error: () => {
        this.busyLineIds.delete(id);
      },
    });
  }

  getExtraPrice(options: any) {
    let exPrice = 0;
    if (options.length > 0) {
      options.forEach((option: any) => {
        exPrice += option.price;
      })
    }
    return exPrice;
  }

  calculateDiscountPrice(line: any) {
    let total = 0;
    if (line.discountAmount > 0) {
      if (line.discountPercentage) {
        total = line.price * line.discountAmount / 100;
      } else {
        total = line.discountAmount;
      }
    } else if (line.comparePriceAt > 0) {
      total = line.comparePriceAt - line.price;
    }
    // total += line.taxTotal;
    return total;
  }

  goBack() {
    if (this.canGoBack) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }


  goBackToPreviousProductsPage(): void {
    const lastUrl = this.navTracker.getLastValidUrl();
    this.router.navigateByUrl(lastUrl);
  }


  async getPageData() {
    let data = await this.pageBuilderServices.getPage('cart');

    if (data) {
      this.pageData = data;
    }
  }

  getHeaderBackground(subheader_settings: any) {
    if (subheader_settings) {
      if (subheader_settings.style == 'Color' && subheader_settings.defaultColor) {
        return subheader_settings.defaultColor || "gray";
      }
      else
        if (subheader_settings.style == 'Pattern' && subheader_settings.defaultPattern) {
          return `url(assets/images/page-builder/patterns/ ${subheader_settings.defaultPattern} .png)`;
        }
        else
          if (subheader_settings.style == 'Image' && subheader_settings.defaultImage && subheader_settings.defaultImage.defaultUrl) {
            return `url( ${subheader_settings.defaultImage.defaultUrl})`;
          }
      return "gray";
    } else {
      return "gray";
    }
  }

  scanProduct(){
    
  }
  

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}