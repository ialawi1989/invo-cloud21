import { Component, HostListener, Inject, PLATFORM_ID, inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
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
import { Subscription } from 'rxjs';
import { CompareService } from 'src/app/services/compare/compare.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-compare',
  imports: [RouterLink, TranslateModule],
  templateUrl: './compare.component.html',
  styleUrl: './compare.component.css'
})
export class CompareComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);

  isBrowser: boolean;
  currentCurrency: any = { rate: 1, symbol: 'USD' };
  pageData: PageData | any = new PageData();
  canGoBack: boolean = false;
  compareItems: Product[] = [];
  private compareSubscription?: Subscription;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private companyService: CompanyServices,
    private currencyService: CurrencyService,
    private pageBuilderServices: PageBuilderService,
    public appService: AppServices,
    private router: Router,
    private location: Location,
    private compareService: CompareService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  }

  async ngOnInit() {
    window.scrollTo({ top: 0 });

    await this.getPageData();

    // Subscribe to currency changes
    this.currencyService.currentCurrency.pipe(takeUntil(this.destroy$)).subscribe(currency => {
      this.currentCurrency = currency;
    });

    // Subscribe to compare items changes
    this.compareSubscription = this.compareService.getCompareItems().subscribe(items => {
      this.compareItems = items;
    });

    if (this.isBrowser) {
      const savedCurrency = localStorage.getItem('selectedCurrency');
      if (savedCurrency) {
        const currency = JSON.parse(savedCurrency);
        this.currentCurrency = currency;
      }
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.compareSubscription) {
      this.compareSubscription.unsubscribe();
    }
  }

  async getPageData() {
    let data = await this.pageBuilderServices.getPage('compare');

    if (data) {
      this.pageData = data;
    }
  }

  getConvertedPrice(price: number) {
    var convertedPrice = (price / (this.currentCurrency.rate || 1)) || 0;
    return convertedPrice.toFixed(this.currentCurrency.afterDecimal || 2);
  }

  // Remove a product from compare list
  async removeFromCompare(productId: string) {
    try {
      const success = await this.compareService.removeFromCompare(productId);
      if (success) {
        // Show success message or handle UI feedback
      }
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'CompareComponent.removeFromCompare' });
      // Show error message to user
    }
  }

  // Clear all items from compare list
  async clearAllItems() {
    if (confirm(this.getTranslation('Are you sure you want to clear all items from compare list?'))) {
      try {
        const success = await this.compareService.clearCompareList();
        if (success) {
          // Show success message
        }
      } catch (error: any) {
        this.logger.error(error?.message, { stack: error?.stack, context: 'CompareComponent.clearCompareList' });
        // Show error message to user
      }
    }
  }

  // Add product to cart
  addToCart(product: Product) {
    // Implement your add to cart logic here
    // This should integrate with your existing cart service

    // Example implementation (replace with your actual cart service):
    /*
    this.cartService.addToCart(product).then(() => {
      // Show success message
      this.showMessage('Product added to cart successfully');
    }).catch((error: any) => {
      this.logger.error(error?.message, { stack: error?.stack, context: 'CompareComponent.addToCart' });
      this.showMessage('Error adding product to cart', 'error');
    });
    */
  }

  // Add product to wishlist
  addToWishlist(product: Product) {
    if (this.isBrowser) {
      try {
        // Get current wishlist
        const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');

        // Check if product already in wishlist
        const existingIndex = wishlist.findIndex((item: any) => item.id === product.id);

        if (existingIndex === -1) {
          // Add to wishlist
          wishlist.push(product);
          localStorage.setItem('wishlist', JSON.stringify(wishlist));
          // Show success message
        } else {
          // Show info message
        }
      } catch (error: any) {
        this.logger.error(error?.message, { stack: error?.stack, context: 'CompareComponent.addToWishlist' });
      }
    }
  }

  isMobile(): boolean {
    return window.innerWidth < 991;
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
      else if (subheader_settings.style == 'Pattern' && subheader_settings.defaultPattern) {
        return `url(assets/images/page-builder/patterns/${subheader_settings.defaultPattern}.png)`;
      }
      else if (subheader_settings.style == 'Image' && subheader_settings.defaultImage && subheader_settings.defaultImage.defaultUrl) {
        return `url(${subheader_settings.defaultImage.defaultUrl})`;
      }
      return "gray";
    } else {
      return "gray";
    }
  }

  // Helper method to get translations (if you don't have a translation service)
  private getTranslation(key: string): string {
    // Implement your translation logic here or use your existing translation service
    // This is a placeholder
    return key;
  }

  // Show message to user (implement with your notification system)
  private showMessage(message: string, type: 'success' | 'error' | 'info' = 'success') {
    // Implement your notification/toast system here
  }
}
