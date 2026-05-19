import { Injectable, Inject, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Product } from '../../models/product.model';
import { CompanyServices } from '../companyServices/company.service';
import { LoggerService } from '../logger/logger.service';

@Injectable({
  providedIn: 'root'
})
export class CompareService {
  private isBrowser: boolean;
  private logger = inject(LoggerService);
  private compareItems = new BehaviorSubject<Product[]>([]);
  private maxCompareItems = 4; // Maximum items that can be compared

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private companyService: CompanyServices
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.loadCompareItems();
  }

  // Get compare items as observable
  getCompareItems() {
    return this.compareItems.asObservable();
  }

  // Get current compare items array
  getCurrentCompareItems(): Product[] {
    return this.compareItems.value;
  }

  // Check if user is logged in
  isUserLoggedIn(): boolean {
    // Replace this with your actual authentication check
    // This is just an example - you should use your auth service
    if (this.isBrowser) {
      const token = localStorage.getItem('userAuth') || sessionStorage.getItem('userAuth');
      return !!token;
    }
    return false;
  }

  // Load compare items from localStorage or user profile
  private async loadCompareItems() {
    if (!this.isBrowser) return;

    try {
      if (this.isUserLoggedIn()) {
        // Load from user profile via API
        await this.loadFromUserProfile();
      } else {
        // Load from localStorage
        this.loadFromLocalStorage();
      }
    } catch (error) {
      this.logger.error(error, { context: 'CompareService.loadCompareItems' });
      // Fallback to localStorage if API fails
      this.loadFromLocalStorage();
    }
  }

  // Load compare items from localStorage
  private loadFromLocalStorage() {
    if (!this.isBrowser) return;

    const stored = localStorage.getItem('compareList');
    if (stored) {
      try {
        const parsedItems = JSON.parse(stored);
        const products: Product[] = [];

        parsedItems.forEach((item: any) => {
          const product = new Product();
          product.ParseJson(item);
          product.mediaUrl = item.mediaUrl;
          products.push(product);
        });

        this.compareItems.next(products);
      } catch (error) {
        this.logger.error(error, { context: 'CompareService.loadFromLocalStorage' });
        localStorage.removeItem('compareList');
      }
    }
  }

  // Load compare items from user profile
  private async loadFromUserProfile() {
    try {
      // // Replace with your actual API call to get user's compare list
      // const response = await this.companyService.getUserCompareList().toPromise();
      // if (response && response.compareItems) {
      //   const products: Product[] = [];

      //   response.compareItems.forEach((item: any) => {
      //     const product = new Product();
      //     product.ParseJson(item);
      //     product.mediaUrl = item.mediaUrl;
      //     products.push(product);
      //   });

      //   this.compareItems.next(products);

      //   // Also sync to localStorage for offline access
      //   this.syncToLocalStorage(products);
      // }
    } catch (error) {
      this.logger.error(error, { context: 'CompareService.loadFromUserProfile' });
      throw error;
    }
  }

  // Add item to compare list
  async addToCompare(product: Product): Promise<boolean> {
    const currentItems = this.getCurrentCompareItems();

    // Check if item already exists
    if (this.isInCompare(product.id)) {
      return false;
    }

    // Check maximum limit
    if (currentItems.length >= this.maxCompareItems) {
      return false;
    }

    const updatedItems = [...currentItems, product];

    try {
      if (this.isUserLoggedIn()) {
        // Save to user profile
        await this.saveToUserProfile(updatedItems);
      } else {
        // Save to localStorage
        this.saveToLocalStorage(updatedItems);
      }

      this.compareItems.next(updatedItems);
      return true;
    } catch (error) {
      this.logger.error(error, { context: 'CompareService.addToCompare', productId: product.id });
      return false;
    }
  }

  // Remove item from compare list
  async removeFromCompare(productId: string): Promise<boolean> {
    const currentItems = this.getCurrentCompareItems();
    const updatedItems = currentItems.filter(item => item.id !== productId);

    try {
      if (this.isUserLoggedIn()) {
        // Save to user profile
        await this.saveToUserProfile(updatedItems);
      } else {
        // Save to localStorage
        this.saveToLocalStorage(updatedItems);
      }

      this.compareItems.next(updatedItems);
      return true;
    } catch (error) {
      this.logger.error(error, { context: 'CompareService.removeFromCompare', productId });
      return false;
    }
  }

  // Clear all compare items
  async clearCompareList(): Promise<boolean> {
    try {
      if (this.isUserLoggedIn()) {
        // Clear from user profile
        await this.saveToUserProfile([]);
      } else {
        // Clear from localStorage
        this.saveToLocalStorage([]);
      }

      this.compareItems.next([]);
      return true;
    } catch (error) {
      this.logger.error(error, { context: 'CompareService.clearCompareList' });
      return false;
    }
  }

  // Check if product is in compare list
  isInCompare(productId: string): boolean {
    return this.getCurrentCompareItems().some(item => item.id === productId);
  }

  // Get compare count
  getCompareCount(): number {
    return this.getCurrentCompareItems().length;
  }

  // Check if compare list is full
  isCompareFull(): boolean {
    return this.getCurrentCompareItems().length >= this.maxCompareItems;
  }

  // Save to localStorage
  private saveToLocalStorage(items: Product[]) {
    if (!this.isBrowser) return;

    try {
      localStorage.setItem('compareList', JSON.stringify(items));
    } catch (error) {
      this.logger.error(error, { context: 'CompareService.saveToLocalStorage' });
    }
  }

  // Save to user profile
  private async saveToUserProfile(items: Product[]) {
    try {
      // Replace with your actual API call to save user's compare list
      // await this.companyService.saveUserCompareList(items).toPromise();

      // Also sync to localStorage
      this.syncToLocalStorage(items);
    } catch (error) {
      this.logger.error(error, { context: 'CompareService.saveToUserProfile' });
      throw error;
    }
  }

  // Sync items to localStorage
  private syncToLocalStorage(items: Product[]) {
    if (this.isBrowser) {
      try {
        localStorage.setItem('compareList', JSON.stringify(items));
      } catch (error) {
        this.logger.error(error, { context: 'CompareService.syncToLocalStorage' });
      }
    }
  }

  // Method to sync localStorage data to user profile when user logs in
  async syncLocalStorageToProfile(): Promise<void> {
    if (!this.isBrowser || !this.isUserLoggedIn()) return;

    try {
      const localItems = localStorage.getItem('compareList');
      if (localItems) {
        const parsedItems = JSON.parse(localItems);
        if (parsedItems.length > 0) {
          await this.saveToUserProfile(parsedItems);
        }
      }
    } catch (error) {
      this.logger.error(error, { context: 'CompareService.syncLocalStorageToProfile' });
    }
  }

  // Method to handle user logout (move profile data to localStorage)
  handleUserLogout(): void {
    if (!this.isBrowser) return;

    const currentItems = this.getCurrentCompareItems();
    this.saveToLocalStorage(currentItems);
  }
}
