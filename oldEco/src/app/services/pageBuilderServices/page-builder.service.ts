import { Injectable, Inject, PLATFORM_ID, signal, computed, effect, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { PageData } from 'src/app/models/page-data/pageData';
import { BUTTONS, HOME } from 'src/app/pages/page/default-home';
import { Company } from 'src/app/models/company.model';
import { AppServices } from '../appServices';
import { AppConfigService } from '../app-config.service';
import { CompanyServices } from '../companyServices/company.service';
import { LoggerService } from '../logger/logger.service';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PageBuilderService {
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);
  isBrowser: boolean;

  // Signals replacing BehaviorSubject and Observable
  private pageDataSignal = signal<PageData | null>(null);
  private currentPageSlugSignal = signal<string>('');
  private pageCache = new Map<string, PageData>();
  private loadingStates = signal<Map<string, boolean>>(new Map());

  // Public computed signals that components can use
  pageData = this.pageDataSignal.asReadonly();
  currentPageSlug = this.currentPageSlugSignal.asReadonly();
  isLoading = computed(() => {
    const states = this.loadingStates();
    return Array.from(states.values()).some(loading => loading);
  });

  // Company data signal
  companyData = signal<Company | null>(null);

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private http: HttpClient,
    private config: AppConfigService,
    private appService: AppServices,
    private companyService: CompanyServices
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    // Effect to subscribe to company data changes
    effect(() => {
      this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
        next: (responseData: Company) => {
          this.companyData.set(responseData);
        },
      });
    });
  }

  // Computed signal for buttons based on company type
  buttonsBasedOnCompanyType = computed(() => {
    const company = this.companyData();
    if (!company) return BUTTONS;

    const companyType = company.type;

    switch (companyType) {
      case 'Resturant':
        return [
          BUTTONS[0], // Delivery
          BUTTONS[1], // Pickup
          BUTTONS[2], // Table Reservation
        ];
      case 'Retail':
        return [
          BUTTONS[3], // Shop
        ];
      case 'Salon':
        return [
          BUTTONS[3], // Shop
          BUTTONS[4], // Appointments
        ];
      default:
        return BUTTONS;
    }
  });

  // Computed signal for banner button
  bannerButton = computed(() => {
    const company = this.companyData();
    if (!company) return null;

    const companyType = company.type;

    switch (companyType) {
      case 'Resturant':
        return {
          uId: 'c2c78474-2aa3-4337-a5f3-9142651dde5e',
          abbr: 'menu',
          name: 'Menu',
          type: 'plus',
          index: 0,
          originalName: 'Explore Our Menu',
        };
      case 'Retail':
        return {
          uId: 'c2c78474-2aa3-4337-a5f3-9142651dde6e',
          abbr: 'shop',
          name: 'Shop',
          type: 'plus',
          index: 0,
          originalName: 'Shop',
        };
      case 'Salon':
        return {
          uId: 'c2c78474-2aa3-4337-a5f3-9142651dde7e',
          abbr: 'appointment',
          name: 'Book an appointment',
          type: 'plus',
          index: 0,
          originalName: 'Menu',
        };
      default:
        return null;
    }
  });

  // Computed signal for banner button text
  bannerButtonText = computed(() => {
    const company = this.companyData();
    if (!company) return null;

    const companyType = company.type;

    switch (companyType) {
      case 'Resturant':
        return 'Explore Our Menu';
      case 'Retail':
        return 'Shop';
      case 'Salon':
        return 'Make an appointment';
      default:
        return null;
    }
  });

  private setLoadingState(slug: string, loading: boolean): void {
    const currentStates = new Map(this.loadingStates());
    currentStates.set(slug, loading);
    this.loadingStates.set(currentStates);
  }

  private removeLoadingState(slug: string): void {
    const currentStates = new Map(this.loadingStates());
    currentStates.delete(slug);
    this.loadingStates.set(currentStates);
  }

  private convertHeadersToPlainObject(): Record<string, string> {
    const httpHeaders: any = this.appService.getFetchHeaders();
    const headers: Record<string, string> = {};
    if (httpHeaders) {
      try {
        // Method 1: Try to get all headers using forEach (triggers lazy init)
        if (typeof httpHeaders.forEach === 'function') {
          httpHeaders.forEach((values: string[], name: string) => {
            headers[name] = values.join(', ');
          });
        }
        // ... rest of the method
      } catch (error) {
        this.logger.error(error, { context: 'PageBuilderService.convertHeadersToPlainObject' });
      }

    }
    return headers;
  }

  async getPage(slug: string, abortController?: AbortController): Promise<PageData | null> {
    // Check cache first
    if (this.pageCache.has(slug)) {
      const cachedData = this.pageCache.get(slug)!;
      this.pageDataSignal.set(cachedData);
      this.currentPageSlugSignal.set(slug);
      return cachedData;
    }

    // Set loading state
    this.setLoadingState(slug, true);

    // Validate inputs before making the request
    if (!slug || typeof slug !== 'string') {
      this.logger.error(new Error('Invalid slug provided'), { context: 'PageBuilderService.getPage', slug });
      this.removeLoadingState(slug);
      throw new Error('Invalid slug provided');
    }

    if (!this.config.baseUrl) {
      this.logger.error(new Error('Base URL is not configured'), { context: 'PageBuilderService.getPage' });
      this.removeLoadingState(slug);
      throw new Error('Base URL is not configured');
    }

const headers = this.convertHeadersToPlainObject();    const url = `${this.config.baseUrl}theme/getPage/${slug}`;

    // Debug logging


    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        signal: abortController?.signal,
      });

      if (response.status === 401) {
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const jsonResponse = await response.json();

      if (jsonResponse.success) {
        let temp = new PageData();

        if (jsonResponse.data) {
          temp.ParseJson(jsonResponse.data);
        } else {
          // Handle home page case
          if (window.location.pathname === '/' || window.location.pathname === '') {
            temp = this.createHomePageData();
          } else {
            this.removeLoadingState(slug);
            return null;
          }
        }

        // Cache and update signals
        this.pageCache.set(slug, temp);
        this.currentPageSlugSignal.set(slug);
        this.pageDataSignal.set(temp);
        this.removeLoadingState(slug);

        return temp;
      }

      this.removeLoadingState(slug);
      return null;

    } catch (error: any) {
      this.removeLoadingState(slug);
      this.logger.error(error, { context: 'PageBuilderService.getPage', slug });
      if (error.name === 'AbortError') {
        throw error;
      }
      throw error;
    }
  }



  private createHomePageData(): PageData {
    const company = this.companyData();
    const temp = new PageData();

    // Set up home page data using computed signals
    HOME.template.sections[0].sectionData.buttonLink = this.bannerButton();
    HOME.template.sections[0].sectionData.buttonText = this.bannerButtonText();
    HOME.template.sections[1].sectionData.buttons = this.buttonsBasedOnCompanyType();

    temp.ParseJson(HOME);

    if (company) {
      temp.template.sections[0].sectionData.text2 = company.name;

      // Apply company-specific customizations
      if (company.oldThemeSettings?.template?.homeBannerURL) {
        temp.template.sections[0].sectionBackground.style = "Image";
        temp.template.sections[0].sectionHeight = "auto";
        temp.template.sections[0].sectionBackground.defaultImage.defaultUrl = company.oldThemeSettings.template.homeBannerURL;
        temp.template.sections[0].sectionBackground.overlayOpacity = company.oldThemeSettings.template.homeBannerDarkness || 50;
      }

      if (company.oldThemeSettings?.template?.homeBannerSubtitle) {
        temp.template.sections[0].sectionData.text1 = "";
        temp.template.sections[0].sectionData.text2 = company.oldThemeSettings.template.homeBannerSubtitle;
      }

      // Filter buttons based on company settings
      this.applyButtonFilters(temp, company);
    }

    return temp;
  }

  private applyButtonFilters(pageData: PageData, company: Company): void {
    let buttons = pageData.template.sections[1].sectionData.buttons;

    if (company.oldThemeSettings?.template?.hideMenuDeliveryButton) {
      buttons = buttons.filter((button: any) => button.buttonLink.abbr !== 'delivery-menu');
    }

    if (company.oldThemeSettings?.template?.hideMenuPickupButton) {
      buttons = buttons.filter((button: any) => button.buttonLink.abbr !== 'pickup-menu');
    }

    if (company.oldThemeSettings?.template?.hideAppointmentButton) {
      buttons = buttons.filter((button: any) => button.buttonLink.abbr !== "appointments");
    }

    if (company.oldThemeSettings?.template?.hideShopButton) {
      buttons = buttons.filter((button: any) => button.buttonLink.abbr !== "shop");
    }

    // Always filter out table reservation
    buttons = buttons.filter((button: any) => button.buttonLink.abbr !== "table-reservation");

    pageData.template.sections[1].sectionData.buttons = buttons;
  }

  // Method to get current page data
  getCurrentPageData(): PageData | null {
    return this.pageDataSignal();
  }

  // Method to get current page slug
  getCurrentPageSlug(): string {
    return this.currentPageSlugSignal();
  }

  // Method to clear cache
  clearCache(slug?: string): void {
    if (slug) {
      this.pageCache.delete(slug);
      // If clearing current page, reset signals
      if (this.currentPageSlugSignal() === slug) {
        this.pageDataSignal.set(null);
        this.currentPageSlugSignal.set('');
      }
    } else {
      this.pageCache.clear();
      this.pageDataSignal.set(null);
      this.currentPageSlugSignal.set('');
    }

    // Clear loading states
    this.loadingStates.set(new Map());
  }

  // Method to check if data is cached
  isCached(slug: string): boolean {
    return this.pageCache.has(slug);
  }

  // Method to check if a specific page is loading
  isPageLoading(slug: string): boolean {
    return this.loadingStates().get(slug) || false;
  }

  // Method to manually set page data (useful for testing or special cases)
  setPageData(slug: string, pageData: PageData): void {
    this.pageCache.set(slug, pageData);
    this.currentPageSlugSignal.set(slug);
    this.pageDataSignal.set(pageData);
  }
}
