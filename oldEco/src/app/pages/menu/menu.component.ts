import { Component, OnInit, OnDestroy, inject } from "@angular/core";
import { LoggerService } from "src/app/services/logger/logger.service";
import { PageBuilderService } from "../../services/pageBuilderServices/page-builder.service";
import { PageData } from "../../models/page-data/pageData";
import { BranchStatusAlertComponent } from "../../components/branch-status-alert/branch-status-alert.component";
import { CartService } from "src/app/services/cartServices/cart.service";
import { Invoice } from "src/app/models/invoice-model";
import { AppServices } from "src/app/services/appServices";
import { ActivatedRoute } from "@angular/router";
import { filter, firstValueFrom, timeout, catchError, takeUntil, lastValueFrom } from "rxjs";
import { of, Subject } from "rxjs";
import { MenuStyle1Component } from "./menu-style1/menu-style1.component";
import { MenuStyle2Component } from "./menu-style2/menu-style2.component";
import { MenuService } from "../../services/menuServices/menu.service";
import { MenuSectionProducts } from "src/app/models/menu-sections-products";
import { ProductTag } from "src/app/models/product-tage.model";

@Component({
  selector: 'app-menu',
  imports: [
    BranchStatusAlertComponent,
    MenuStyle1Component,
    MenuStyle2Component,
  ],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'],
})
export class MenuComponent implements OnInit, OnDestroy {
  private logger = inject(LoggerService);
  private destroy$ = new Subject<void>();

  loading = true;
  style: string | null = null;
  pageData: PageData = new PageData();

  // ── Data passed down to child ────────────────────────────────
  allSectionsProducts: MenuSectionProducts[] = [];
  sections: any[] = [];
  productTags: ProductTag[] = [];

  private invoiceData: any;
  // Guard: prevents the BehaviorSubject replay (and any serviceName assignment
  // during init) from triggering loadMenuData before init has finished.
  private isInitialized = false;

  constructor(
    private pageBuilderServices: PageBuilderService,
    private cartService: CartService,
    private menuService: MenuService,
    private appService: AppServices,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    this.loading = true;

    // Subscribe ONCE to keep invoiceData in sync — never inside loadMenuData
    this.cartService.invoiceDataSub$
      .pipe(takeUntil(this.destroy$))
      .subscribe((invoiceData: Invoice | null) => {
        if (invoiceData) {
          this.invoiceData = invoiceData;
        }
      });

    // Subscribe BEFORE the await chain so real user-triggered service changes
    // are never missed. The isInitialized guard blocks the BehaviorSubject's
    // immediate replay and any serviceName writes during waitForCartData /
    // checkServiceSelection from firing a redundant second loadMenuData.
    this.appService.serviceChange$
      .pipe(
        filter((event) => event !== null && this.isInitialized),
        takeUntil(this.destroy$)
      )
      .subscribe(async () => {
        try {
          await this.loadMenuData();
        } catch (error: any) {
          this.logger.error(error?.message, { stack: error?.stack, context: 'MenuComponent.serviceChange$' });
        }
      });

    try {
      await this.waitForCartData();
      await this.getPageData();
      this.checkServiceSelection();
      await this.loadMenuData();
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'MenuComponent.ngOnInit' });
      this.style = 'grid';
    } finally {
      this.loading = false;
      // Only after init is fully done should service changes trigger reloads
      this.isInitialized = true;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

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

      if (invoiceData?.serviceName) {
        this.appService.serviceName = invoiceData.serviceName;
      }
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'MenuComponent.waitForCartData' });
    }
  }

  private checkServiceSelection(): void {
    const queryParams = this.route.snapshot.queryParams;
    const serviceNameFromUrl = queryParams['service_name'];

    if (serviceNameFromUrl) {
      this.appService.serviceName = serviceNameFromUrl;
      return;
    }

    const serviceName = this.appService.serviceName;
    const enforceServiceSelection = this.appService.enforceServiceSelection;
    const isServiceSelectorOpen = this.appService['isServiceSelectorOpen'];
    if (!serviceName && enforceServiceSelection && !isServiceSelectorOpen) {
      this.appService.showServiceSelector();
    }
  }

  // ── DineIn cart recreation ───────────────────────────────────

  private async handleDineIn(branchId?: string): Promise<void> {
    const queryParams = this.route.snapshot.queryParams;
    const tableId = queryParams['table_id'] || this.invoiceData.tableId || undefined;
    const serviceName =
      this.appService.serviceName ||
      this.invoiceData?.serviceName ||
      queryParams['service_name'] ||
      '';

    if (serviceName === 'DineIn' && !this.appService.isMenuDataLoaded) {
      await this.reCreateCart(serviceName, this.invoiceData.onlineData.sessionId, tableId, branchId);
    }
  }

  private async reCreateCart(
    serviceName: string,
    sessionId: string,
    tableId: string,
    branchId?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cartService.createCart({ serviceName, sessionId, tableId, branchId }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: Invoice | any) => {
          this.cartService.setCartInvoiceData(data);
          localStorage.removeItem('sessionId');
          localStorage.setItem('sessionId', data.onlineData.sessionId);
          resolve();
        },
        error: (err: any) => {
          this.logger.error(err?.message, { stack: err?.stack, context: 'MenuComponent.reCreateCart' });
          reject(err);
        },
      });
    });
  }

  async getPageData(): Promise<void> {
    try {
      const data = await this.pageBuilderServices.getPage('menu');
      this.pageData.ParseJson(data);

      this.style = this.pageData?.template?.settings?.default_view ?? 'grid';
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'MenuComponent.getPageData' });
      this.style = 'grid';
    }
  }

  // ── Load all menu data (sections + products + tags) ──────────
  async loadMenuData(): Promise<void> {
    try {
      const queryParams = this.route.snapshot.queryParams;
      const branchId = queryParams['branch_id'] || this.invoiceData?.branchId || undefined;
      const sessionId = this.invoiceData?.onlineData?.sessionId || undefined;

      // Clear stale data so child components don't show the previous service's items
      this.allSectionsProducts = [];
      this.sections = [];
      this.productTags = [];

      // ── DineIn: recreate cart with table_id before loading menu ─
      await this.handleDineIn(branchId);

      await this.loadAllSectionsProducts(branchId, sessionId);
      this.loadProductTags(branchId);
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'MenuComponent.loadMenuData' });
    }
  }

  async loadAllSectionsProducts(branchId?: string, sessionId?: string): Promise<void> {
    try {
      const data = await lastValueFrom(this.menuService.getCompanyMenu({ branchId, sessionId }));

      this.sections = [];
      const rawSections: MenuSectionProducts[] = [];

      data.forEach((section: any) => {
        this.sections.push({
          id: section.menuSectionId,
          name: section.sectionName,
          translation: section.translation,
        });

        section.products.forEach((element: any) => {
          element.edited = true;

          const isServiceType = ['menuItem', 'service', 'menuSelection', 'package', 'tailoring']
            .includes(element.type);

          if (isServiceType) {
            element.quantity = null;
          } else {
            element.quantity = branchId
              ? (element.branches?.[0]?.onHand || 0)
              : (Math.max(...(element.branches?.map((b: any) => b.onHand) || [0])) || 0);
          }

          element.price = branchId
            ? (element.price || element.branches?.[0]?.price || element.defaultPrice || 0)
            : (element.price || element.defaultPrice);
        });

        rawSections.push(section);
      });

      // Preserve section order
      const sorted: MenuSectionProducts[] = [];
      this.sections.forEach(sec => {
        const match = rawSections.find(s => s.menuSectionId === sec.id);
        if (match) sorted.push(match);
      });

      this.allSectionsProducts = sorted;
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'MenuComponent.loadAllSectionsProducts' });
    }
  }

  loadProductTags(branchId?: string): void {
    this.menuService.getProductTags(branchId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: ProductTag[]) => { this.productTags = data || []; },
      error: (err: any) =>
        this.logger.error(err?.message, { stack: err?.stack, context: 'MenuComponent.loadProductTags' }),
    });
  }
}