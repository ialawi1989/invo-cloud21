// src/app/services/productUtilityService/product-utility.service.ts

import { Inject, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CartService } from '../cartServices/cart.service';
import { CompanyServices } from '../companyServices/company.service';
import { CurrencyService } from '../currencyService/currency.service';
import { AlertService } from '../alertService/alert.service';
import { Invoice } from '../../models/invoice-model';
import { Product } from '../../models/product.model';
import { Router } from '@angular/router';
import { LoggerService } from '../logger/logger.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ProductUtilityService {
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);
  invoiceData?: Invoice;
  isBrowser: boolean;
  currentCurrency: any = {};
  selectedProduct: any;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    public cartService: CartService,
    public companyService: CompanyServices,
    public currencyService: CurrencyService,
    private router: Router,
    public alertService: AlertService,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.initSubscriptions();
  }

  private initSubscriptions(): void {
    this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: any) => {
        if (responseData) this.invoiceData = responseData;
      },
    });

    this.currencyService.currentCurrency.subscribe((currency) => {
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

  isMobile(): boolean {
    if (this.isBrowser) {
      return window.innerWidth < 991;
    }
    return false;
  }

  addItemToCart(param: any): Promise<Invoice | null> {
    const body = { ...param, sessionId: this.invoiceData!.onlineData.sessionId };

    return new Promise((resolve, reject) => {
      if (!this.isBrowser) {
        reject(new Error('Browser context required.'));
        return;
      }

      this.cartService.addItemToCart(body).pipe(takeUntil(this.destroy$)).subscribe({
        next: (responseData: Invoice | null) => {
          if (responseData) {
            this.invoiceData = responseData;

            if (param.showCart) {
              const element = document.querySelector('.cart-dropdown');
              if (element && !this.isMobile()) {
                element.classList.add('opened');
                document.body.style.overflow = 'hidden';
              }
            }
            resolve(responseData);
          } else {
            resolve(null);
          }
        },
        error: (err) => {
          this.logger.error(err, { context: 'ProductUtilityService.addItemToCart' });
          this.alertService?.showAlert('Failed to add item to cart.');
          reject(err);
        },
      });
    });
  }
 
  isInWishList(productId: string): boolean {
    if (this.isBrowser) {
      const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
      return wishlist.some((item: any) => item.id === productId);
    }
    return false;
  }

  addItemToWishlist(product: Product): void {
    let wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    const index = wishlist.findIndex((item: any) => item.id === product.id);

    if (index !== -1) {
      wishlist.splice(index, 1);
    } else {
      wishlist.push(product);

      if (this.isBrowser) {
        const element = document.querySelector('.wishlist-dropdown');
        if (element && !this.isMobile()) {
          element.classList.add('opened');
          document.body.style.overflow = 'hidden';
        }
      }
    }
    if (this.isBrowser) {
      localStorage.setItem('wishlist', JSON.stringify(wishlist));
    }
  }
}