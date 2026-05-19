import { ShopStyle2Component } from './shop-style2/shop-style2.component';
import { ShopStyle1Component } from './shop-style1/shop-style1.component';
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { PageData } from 'src/app/models/page-data/pageData';
import { CartService } from 'src/app/services/cartServices/cart.service';
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';
import { AppServices } from 'src/app/services/appServices';
import { ActivatedRoute } from '@angular/router';
import { Invoice } from 'src/app/models/invoice-model';
import { Category } from 'src/app/models/category.model';
import { Brand } from 'src/app/models/brand.model';
import { ShopService } from 'src/app/services/shopServices/shop.service';
import { filter, firstValueFrom, timeout, catchError, takeUntil } from 'rxjs';
import { of, Subject } from 'rxjs';

@Component({
  selector: 'app-shop',
  imports: [ShopStyle2Component, ShopStyle1Component],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.css',
})
export class ShopComponent implements OnInit, OnDestroy {
  private logger = inject(LoggerService);
  private destroy$ = new Subject<void>();
  // Emitted before each reload to cancel the previous loadSharedData subscriptions
  private reload$ = new Subject<void>();

  loading = true;
  style: string | null = null;
  pageData: PageData = new PageData();

  // Shared data passed down to style components
  categories: Category[] = [];
  brands: Brand[] = [];
  productTags: any[] = [];
  invoiceData: Invoice | null = null;

  loadingCategories = true;
  loadingTags = true;
  loadingBrands = true;

  // Guard: prevents the BehaviorSubject replay (and any serviceName assignment
  // during init) from triggering loadSharedData before init has finished.
  private isInitialized = false;

  constructor(
    private pageBuilderServices: PageBuilderService,
    private cartService: CartService,
    private appService: AppServices,
    private shopService: ShopService,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    // Subscribe BEFORE the await chain so real user-triggered service changes
    // are never missed. The isInitialized guard blocks the BehaviorSubject's
    // immediate replay and any serviceName writes during waitForCartData /
    // checkServiceSelection from firing a redundant second loadSharedData.
    this.appService.serviceChange$
      .pipe(
        filter((event) => event !== null && this.isInitialized),
        takeUntil(this.destroy$)
      )
      .subscribe(async () => {
        try {
          // Cancel in-flight subscriptions from the previous loadSharedData call
          this.reload$.next();

          await this.waitForCartData();
          this.categories = [];
          this.brands = [];
          this.productTags = [];
          this.loadSharedData();
        } catch (error: any) {
          this.logger.error(error?.message, { stack: error?.stack, context: 'ShopComponent.serviceChange$' });
        }
      });

    try {
      await this.waitForCartData();
      await this.getPageData();
      this.checkServiceSelection();
      this.loadSharedData();
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'ShopComponent.ngOnInit' });
      this.style = 'grid';
    } finally {
      this.loading = false;
      // Only after init is fully done should service changes trigger reloads
      this.isInitialized = true;
    }
  }

  ngOnDestroy(): void {
    this.reload$.next();
    this.reload$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Private helpers ──

  private async waitForCartData(): Promise<void> {
    try {
      const invoiceData = await firstValueFrom(
        this.cartService.invoiceDataSub$.pipe(
          filter((invoiceData): invoiceData is Invoice => invoiceData !== null),
          takeUntil(this.destroy$),
          timeout(10000),
          catchError((error) => {
            console.warn('Timeout waiting for cart data:', error);
            return of(null);
          })
        )
      );

      if (invoiceData) {
        this.invoiceData = invoiceData;
        if (invoiceData.serviceName) {
          this.appService.serviceName = invoiceData.serviceName;
        }
      }
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'ShopComponent.waitForCartData' });
    }
  }

  private async getPageData(): Promise<void> {
    const data = await this.pageBuilderServices.getPage('shop');
    this.pageData.ParseJson(data);
    this.style = this.pageData?.template?.settings?.default_view ?? 'grid';
  }

  private checkServiceSelection(): void {
    const serviceNameFromUrl = this.route.snapshot.queryParams['service_name'];
    if (serviceNameFromUrl) {
      this.appService.serviceName = serviceNameFromUrl;
      return;
    }

    if (!this.appService.serviceName && this.appService.enforceServiceSelection && !this.appService['isServiceSelectorOpen']) {
      this.appService.showServiceSelector();
    }
  }

  private loadSharedData(): void {
    const branchId = this.invoiceData?.branchId;

    this.loadingCategories = true;
    this.shopService.getCompanyCategories(branchId).pipe(takeUntil(this.reload$), takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.categories = data; this.loadingCategories = false; },
      error: (err) => { this.loadingCategories = false; this.logger.error(err?.message, { context: 'ShopComponent.loadCategories' }); },
    });

    this.loadingTags = true;
    this.shopService.getCatgorieProductsTags(branchId).pipe(takeUntil(this.reload$), takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.productTags = data; this.loadingTags = false; },
      error: (err) => { this.loadingTags = false; this.logger.error(err?.message, { context: 'ShopComponent.loadTags' }); },
    });

    this.loadingBrands = true;
    this.shopService.getBrands().pipe(takeUntil(this.reload$), takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.brands = data; this.loadingBrands = false; },
      error: (err) => { this.loadingBrands = false; this.logger.error(err?.message, { context: 'ShopComponent.loadBrands' }); },
    });
  }
}