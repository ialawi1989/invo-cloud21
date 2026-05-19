import { Component, Inject, Input, OnInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { Router, RouterLink } from '@angular/router';
import { CompanyServices } from '../../services/companyServices/company.service';
import { Company } from '../../models/company.model';
import { isPlatformBrowser } from '@angular/common';
import { CurrencyService } from '../../services/currencyService/currency.service';
import { Order } from '../../models/order.model';
import { CartService } from '../../services/cartServices/cart.service';
import { LoadingService } from '../../services/loadingService/loading.service';
import { TranslateModule } from '@ngx-translate/core';
import { SpinnerComponent } from "../../components/spinner/spinner.component";
import { PageData } from 'src/app/models/page-data/pageData';
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';
import { Location } from '@angular/common';
import { AppServices } from 'src/app/services/appServices';
import { AuthService } from 'src/app/services/authService/auth.service';
import { Subject, takeUntil } from 'rxjs';
import { LoginPopComponent } from 'src/app/components/auth/login-pop/login-pop.component';
import { ModalService } from 'src/app/services/modal.service';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-order-list',
  imports: [RouterLink, TranslateModule, SpinnerComponent],
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.css'
})
export class OrderListComponent implements OnInit, OnDestroy , OnDestroy{
  private logger = inject(LoggerService);

  @Input() hideTitle = false;
  isBrowser: boolean;
  companyData: Company = new Company();
  orders: Order[] | any = [];
  loading: boolean = true;
  pageData: PageData | any = new PageData();
  canGoBack: boolean = false;
  isUserAuthenticated: boolean = false;

  // Pagination properties for API orders
  currentOrderPage: number = 1;
  ordersLimit: number = 10;
  hasNextOrderPage: boolean = false;
  hasPreviousOrderPage: boolean = false;

  private destroy$ = new Subject<void>();
  private isComponentActive = true;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private companyService: CompanyServices,
    private currencyService: CurrencyService,
    private cartService: CartService,
    private router: Router,
    private location: Location,
    private pageBuilderServices: PageBuilderService,
    public appService: AppServices,
    private modalService: ModalService,
    private authService: AuthService,
    private loadingService: LoadingService,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  }

  async ngOnInit() {
    if (!this.isComponentActive) return;

    // Check authentication status first
    this.isUserAuthenticated = this.checkUserAuthentication();

    await this.getPageData();
    window.scrollTo({ top: 0 });

    // If not authenticated, stop initialization and show login message
    if (!this.isUserAuthenticated) {
      this.loading = false;
      return;
    }

    if (this.isBrowser) {
      const savedCurrency = localStorage.getItem('selectedCurrency');
      if (savedCurrency) {
        const currency = JSON.parse(savedCurrency);
        this.currentCurrency = currency;
      }
    }

    this.currencyService.currentCurrency.pipe(takeUntil(this.destroy$)).subscribe(currency => {
      this.currentCurrency = currency;
    });

    this.getCompanyData();

    // Load orders from API for authenticated users
    await this.loadOrdersFromAPI(1);

    this.loading = false;
  }

  ngOnDestroy() {
    this.isComponentActive = false;
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Check if user is authenticated by checking AppService auth_token
   */
  private checkUserAuthentication(): boolean {
    return !!(this.appService.auth_token && this.appService.auth_token.trim() !== '');
  }

  /**
   * Load orders from API for authenticated users with pagination
   */
  async loadOrdersFromAPI(page: number = 1) {
    if (!this.isComponentActive || !this.isUserAuthenticated) return;

    this.loading = true;

    this.authService.getOrderHistory(page, this.ordersLimit)
      .pipe(takeUntil(this.destroy$))
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (response: any) => {
          if (!this.isComponentActive) return;

          this.orders = response.orders.map((order: any) => ({
            id: order.id,
            orderNumber: order.orderNumber || order.invoiceNumber || `#${order.id?.substring(0, 8) || 'N/A'}`,
            invoiceNumber: order.invoiceNumber,
            createdAt: order.createdAt || order.date || new Date().toISOString(),
            date: order.date,
            total: order.total || 0,
            status: order.status || 'Pending',
            onlineStatus: order.onlineStatus,
            onlineData: order.onlineData || { onlineStatus: order.status },
            items: order.items || []
          }));

          this.currentOrderPage = response.currentPage;
          this.hasNextOrderPage = response.hasNext;
          this.hasPreviousOrderPage = this.currentOrderPage > 1;

          // Sort orders by createdAt in descending order
          this.orders.sort((a: any, b: any) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
          });

          this.loading = false;
        },
        error: (error) => {
          if (!this.isComponentActive) return;

          this.logger.error(error?.message, { stack: error?.stack, context: 'OrderListComponent.loadOrdersFromAPI' });
          this.loading = false;
        }
      });
  }

  currentCurrency: any = { rate: 1, symbol: 'USD' };

  getCompanyData() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => {
        this.companyData = data;
        this.currentCurrency = {
          afterDecimal: this.companyData.settings['afterDecimal'],
          rate: 1,
          symbol: this.companyData.settings['currencySymbol']
        }
      },
    });
  }

  getConvertedPrice(price: number) {
    const convertedPrice = (price / (this.currentCurrency.rate || 1)) || 0;
    return convertedPrice.toFixed(this.companyData.settings['afterDecimal']);
  }

  convertDateFormat(dateStr: any) {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();

    const formattedDay = day < 10 ? `0${day}` : day;
    const formattedMonth = month < 10 ? `0${month}` : month;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;

    const period = hours >= 12 ? "PM" : "AM";
    let formattedHour = hours % 12;
    formattedHour = formattedHour === 0 ? 12 : formattedHour;
    const formattedHourStr = formattedHour < 10 ? `0${formattedHour}` : formattedHour;

    const formattedDate = `${formattedDay}/${formattedMonth}/${year}, ${formattedHourStr}:${formattedMinutes} ${period}`;
    return formattedDate;
  }

  /**
   * Navigate to next page of orders
   */
  nextOrderPage() {
    if (!this.isComponentActive || !this.isUserAuthenticated) return;

    if (this.hasNextOrderPage) {
      this.loadOrdersFromAPI(this.currentOrderPage + 1);
    }
  }

  /**
   * Navigate to previous page of orders
   */
  previousOrderPage() {
    if (!this.isComponentActive || !this.isUserAuthenticated) return;

    if (this.currentOrderPage > 1) {
      this.loadOrdersFromAPI(this.currentOrderPage - 1);
    }
  }

  goBack() {
    if (this.canGoBack) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }

  async getPageData() {
    let data = await this.pageBuilderServices.getPage('my-orders');
    if (data) {
      this.pageData = data;
    }
  }

  getHeaderBackground(subheader_settings: any) {
    if (subheader_settings) {
      if (subheader_settings.style == 'Color' && subheader_settings.defaultColor) {
        return subheader_settings.defaultColor || "gray";
      }
      else if (subheader_settings.style == 'Pattern' && subheader_settings.defaultPattern) {
        return `url(assets/images/page-builder/patterns/ ${subheader_settings.defaultPattern} .png)`;
      }
      else if (subheader_settings.style == 'Image' && subheader_settings.defaultImage && subheader_settings.defaultImage.defaultUrl) {
        return `url( ${subheader_settings.defaultImage.defaultUrl})`;
      }
      return "gray";
    } else {
      return "gray";
    }
  }

  openLoginPop() {
    if (!this.isBrowser) return;

    try {
      // Check if modal service is available
      if (!this.modalService) {
        this.logger.error('Modal service not available', { context: 'OrderListComponent.openLoginModal' });
        return;
      }

      // Open the modal using the ModalService
      const modalRef = this.modalService.openWithData(
        LoginPopComponent,
        {},
        {
          centered: true,
          windowClass: 'modal-md modal-fullscreen-md-down',
          backdrop: 'static', // Prevent closing on backdrop click
          keyboard: false, // Prevent closing on escape
        }
      );

      // Handle modal result
      this.handleModalResult(modalRef);
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'OrderListComponent.openLoginModal' });
    }
  }

  // Helper method to handle modal results
  private handleModalResult(modalRef: NgbModalRef): void {
    modalRef.result
      .then(
        (data: any) => {
          if (data && data.success) {
            // Handle success
          }
        },
        (reason: any) => {
          // Handle dismissal
        }
      )
      .catch((error: any) => {
        this.logger.error(error?.message, { stack: error?.stack, context: 'OrderListComponent.handleModalResult' });
      });
  }

}