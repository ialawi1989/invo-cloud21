import { Component, HostListener, Inject, PLATFORM_ID, OnDestroy} from '@angular/core';
import { Product } from '../../models/product.model';
import { Router, RouterLink } from '@angular/router';
import { CompanyServices } from '../../services/companyServices/company.service';
import { isPlatformBrowser } from '@angular/common';
import { CurrencyService } from '../../services/currencyService/currency.service';
import { TranslateModule } from '@ngx-translate/core';
import { AppServices } from 'src/app/services/appServices';
import { PageData } from 'src/app/models/page-data/pageData';
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';
import { Location } from '@angular/common';
import { Company } from 'src/app/models/company.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-wishlist',
  imports: [RouterLink, TranslateModule],
  templateUrl: './wishlist.component.html',
  styleUrl: './wishlist.component.css'
})
export class WishlistComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  isBrowser: boolean;
  currentCurrency: any = { rate: 1, symbol: 'USD' };
  pageData: PageData | any = new PageData();
  canGoBack: boolean = false;
  companyData: Company = new Company();

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private companyService: CompanyServices,
    private currencyService: CurrencyService,
    private pageBuilderServices: PageBuilderService,
    public appService: AppServices,
    private router: Router,
    private location: Location,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  }

  async ngOnInit() {
    window.scrollTo({ top: 0 });
    this.getCompanyData();
    await this.getPageData();

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
  }

  getCompanyData() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: Company) => {
        this.companyData = responseData;
      },
    });
  }

  async getPageData() {
    let data = await this.pageBuilderServices.getPage('wishlist');

    if (data) {
      this.pageData = data;
    }
  }


  getConvertedPrice(price: number) {
    var price = (price / (this.currentCurrency.rate || 0)) || 0
    return price.toFixed(this.currentCurrency.afterDecimal);
  }
  // Retrieve the wishlist (optional, for debugging or display)
  getWishlist() {
    if (this.isBrowser) {
      let products: Product[] = []
      var tempProducts: Product[] = JSON.parse(localStorage.getItem('wishlist') || '[]');
      let temp;
      tempProducts.forEach(element => {
        temp = new Product();
        temp.ParseJson(element);
        temp.mediaUrl = element.mediaUrl;
        products.push(temp);
      });
      return products;
    }
    return []
  }

  // Remove a product from the wishlist
  removeItemFromWishlist(productId: string) {
    if (this.isBrowser) {
      // Get the current wishlist from localStorage
      const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');

      // Filter out the product to be removed
      const updatedWishlist = wishlist.filter((item: any) => item.id !== productId);

      // Save the updated wishlist to localStorage
      localStorage.setItem('wishlist', JSON.stringify(updatedWishlist));

    }

  }


  isMobile(): boolean {
    return window.innerWidth < 991; // Adjust the width threshold as needed
  }

  goBack() {
    if (this.canGoBack) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
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



  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
