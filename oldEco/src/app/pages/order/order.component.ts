import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cartServices/cart.service';
import { Order } from '../../models/order.model';
import { PaymentService } from '../../services/paymentServices/payments.service';
import { LoadingService } from '../../services/loadingService/loading.service';
import { CompanyServices } from '../../services/companyServices/company.service';
import { Company } from '../../models/company.model';
import { AlertService } from '../../services/alertService/alert.service';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { CurrencyService } from '../../services/currencyService/currency.service';
import { TranslateModule } from '@ngx-translate/core';
import { SpinnerComponent } from "../../components/spinner/spinner.component";
import { AppServices } from '../../services/appServices';
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';
import { PageData } from 'src/app/models/page-data/pageData';
import { Location } from '@angular/common';
import { ModalService } from 'src/app/services/modal.service';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

import { FeedbackPopComponent } from '../feedback/feedback-pop/feedback-pop.component';
import { AuthService } from 'src/app/services/authService/auth.service';
import { TrackOrderMapPopComponent } from 'src/app/components/track-order-map-pop/track-order-map-pop.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-order',
  imports: [
    RouterLink,
    TranslateModule,
    SpinnerComponent,
    CommonModule
  ],
  templateUrl: './order.component.html',
  styleUrls: ['./order.component.css']
})
export class OrderComponent implements OnInit, OnDestroy , OnDestroy{
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);

  loading: boolean = true;
  discountedByCoupon: boolean = false;
  order!: Order;
  sessionId: any = "";
  payments: any = [];
  selectedPayment: string = "";
  isBenefitPayOpened: boolean = false;
  companyData: Company = new Company();

  currentCurrency: any = {};
  isBrowser: boolean;
  private orderRefreshTimeout: any;
  pageData: PageData | any = new PageData();
  canGoBack: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cartService: CartService,
    private paymentService: PaymentService,
    private loadingService: LoadingService,
    private companyService: CompanyServices,
    private alertService: AlertService,
    private currencyService: CurrencyService,
    public appService: AppServices,
    private location: Location,
    private pageBuilderServices: PageBuilderService,
    private authService: AuthService,
    private modalService: ModalService,
    @Inject(PLATFORM_ID) private platformId: any,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  }

  async ngOnInit() {
    await this.getPageData();
    window.scrollTo({ top: 0 });

    // Subscribe to route parameters
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(async () => {
      this.sessionId = this.route.snapshot.paramMap.get('id');
      // Fetch order only when sessionId is set
      if (this.sessionId) {
        this.getOrder();
      }
    });

    this.getCompanyData();
    this.getPayments();

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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Clear the timeout when the component is destroyed
    if (this.orderRefreshTimeout) {
      clearTimeout(this.orderRefreshTimeout);
    }
  }

  /**
   * Schedules the next refresh based on order status
   * Only refreshes if order is in a pending state
   */
  private scheduleNextRefresh() {
    if (!this.order?.onlineData?.onlineStatus) {
      return;
    }

    const status = this.order.onlineData.onlineStatus.toLowerCase();
    const isFinalStatus = status === 'rejected' || status === 'completed' || status === 'arrived';

    if (!isFinalStatus) {
      // Clear any existing timeout first to avoid multiple timers
      if (this.orderRefreshTimeout) {
        clearTimeout(this.orderRefreshTimeout);
      }
      // Schedule next refresh after 20 seconds
      this.orderRefreshTimeout = setTimeout(() => {
        this.getOrder();
      }, 20000);
    }
  }

  getCompanyData() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => {
        this.companyData = data;
      },
    });
  }

  getConvertedPrice(totalPrice: number) {
    const price = (totalPrice / (this.currentCurrency.rate || 0)) || 0;
    return price.toFixed(this.currentCurrency.afterDecimal);
  }

  /**
   * Fetches order data from the server with fallback mechanism
   * First tries getOrderData (guest/session-based order)
   * If that fails or returns no data, tries getOrderById (authenticated user order)
   * Only shows loading spinner on initial load, not on refresh
   */
  getOrder() {
    // Only show loading on initial load, not on refresh
    if (!this.order?.id) {
      this.loading = true;
    }


    // First attempt: Try to get order by sessionId (guest checkout or session-based)
    this.cartService.getOrderData(this.sessionId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Order | any) => {
        if (data && data.id) {
          // Successfully loaded order from getOrderData
          this.order = data;
          this.extractOrderDetails();
          this.scheduleNextRefresh();
          this.discountedByCoupon = this.order.lines?.some(line => line.discountedByCoupon);
          this.loading = false;
        } else {
          // No data returned, try fallback method for authenticated users
          this.getOrderFallback();
        }
      },
      error: (err: any) => {
        // On error, try fallback method for authenticated users
        this.getOrderFallback();
      },
    });
  }

  /**
   * Fallback method to fetch order using AuthService.getOrderById
   * Used when getOrderData fails or returns no data
   * This method works for authenticated users
   */
  private getOrderFallback() {
    if (!this.authService || !this.appService.auth_token) {
      this.loading = false;
      return;
    }

    this.authService.getOrderById(this.sessionId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Order | any) => {
        if (data && data.id) {
          this.order = data;
          this.extractOrderDetails();
          this.scheduleNextRefresh();
        } else {
          console.warn('No order data available from fallback method');
        }
        this.loading = false; // ← ADD THIS (was missing in both branches)
      },
      error: (err: any) => {
        this.logger.error(err?.message, { stack: err?.stack, context: 'OrderComponent.getOrderById.fallback' });
        this.loading = false;
        this.scheduleNextRefresh();
      },
    });
  }

  /**
   * Extracts and processes order details from the loaded order object
   * This logic was previously inline in getOrder() and is now reusable
   */
  private extractOrderDetails() {
    if (!this.order) return;

    // Extract employee name and service time from the first line if available
    if (this.order.lines && this.order.lines.length > 0) {
      this.order.employeeName = this.order.lines[0].employeeName || "Any";
      this.order.serviceDate = this.order.lines[0].serviceDate;
    }
  }

  getPayments() {
    this.paymentService.getPaymentsMethods().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        if (data) {
          data.forEach((element: any) => {
            if (element.icon == "Debit Card") {
              element.image = "/assets/images/payments/debit-card.svg";
            } else if (element.icon == "Credit Card") {
              element.image = "/assets/images/payments/credit-card.svg";
            } else {
              switch (element.name.toLowerCase()) {
                case "afs":
                  element.image = "/assets/images/payments/afs.png";
                  break;
                case "benefitpay":
                  element.image = "/assets/images/payments/benefitpay.png";
                  break;
                case "thawanipayment":
                  element.image = "/assets/images/payments/thawanipayment.png";
                  break;
                case "tappayment":
                  element.image = "/assets/images/payments/tappayment.png";
                  break;
                case "benefit":
                  element.image = "/assets/images/payments/benefit.png";
                  break;
                case "gatee":
                  element.image = "/assets/images/payments/gatee.png";
                  break;
                case "credimax ecr":
                  element.image = "/assets/images/payments/credimax.png";
                  break;
                case "aps ecr":
                  element.image = "/assets/images/payments/aps.png";
                  break;
              }
            }
            this.payments.push(element);
          });
        }
      }
    });
  }

  payment: any = {};

  pay() {
    if (this.payments.length) {
      if (!this.selectedPayment) {
        this.alertService.showAlert({ title: "Please select the payment method" });
        return;
      }
    } else {
      this.alertService.showAlert({ title: "Failed to pay order! Please try again or contact us for more details" });
      return;
    }

    this.payments.forEach((paymnt: any) => {
      if (paymnt.name === this.selectedPayment) {
        this.payment = paymnt;
      }
    });

    this.loadingService.showLoadingSpinner();
    this.paymentService.reCheckout({
      sessionId: this.sessionId,
      payment: {
        name: this.payment.name
      }
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: any) => {
        if (data) {
          localStorage.removeItem('lastPage');
          localStorage.setItem('lastPage', window.location.pathname);

          if (this.payment.name === 'afs') {
            this.paymentService.AfsPayment(data.config);
          } else if (this.payment.name == 'CrediMax') {
            this.paymentService.CrediMaxPayment(data);

            // ─── BENEFITPAY FIX START ────────────────────────────────────────
          } else if (this.payment.name == 'BenefitPay') {
            this.isBenefitPayOpened = true;
            this.loadingService.hideLoadingSpinner();

            InApp.open(
              data,
              // Success callback — always verify server-side regardless of
              // transactionStatus; client result alone cannot be trusted
              (success: any) => {
                this.isBenefitPayOpened = false;
                this.paymentService
                  .checkBenefitPayStatus2(data.referenceNumber, this.sessionId)
                  .then((isSuccess: boolean) => {
                    this.router.navigate([isSuccess ? 'order/' + this.sessionId : 'order/error']);
                  })
                  .catch(() => {
                    this.router.navigate(['order/error']);
                  });
              },
              // Error callback — payment gateway reported an error; still
              // verify server-side as charge may have gone through
              (error: any) => {
                if (this.isBenefitPayOpened) {
                  this.isBenefitPayOpened = false;
                  this.paymentService
                    .checkBenefitPayStatus2(data.referenceNumber, this.sessionId)
                    .then((isSuccess: boolean) => {
                      this.router.navigate([isSuccess ? 'order/' + this.sessionId : 'order/error']);
                    })
                    .catch(() => {
                      this.router.navigate(['order/error']);
                    });
                }
              },
              // Cancel callback — user dismissed the InApp dialog; still check
              // status because payment may have completed before cancel
              (cancel: any) => {
                if (this.isBenefitPayOpened) {
                  this.isBenefitPayOpened = false;
                  this.paymentService
                    .checkBenefitPayStatus2(data.referenceNumber, this.sessionId)
                    .then((isSuccess: boolean) => {
                      if (isSuccess) {
                        // Payment actually went through — send to order page
                        this.router.navigate(['order/' + this.sessionId]);
                      }
                      // If not paid, stay on order page (no navigation)
                    })
                    .catch(() => {
                      // Stay on page silently — user cancelled, no charge confirmed
                    });
                }
              }
            );
            // ─── BENEFITPAY FIX END ──────────────────────────────────────────

          } else {
            if (data.url || data.data?.url) {
              window.open(data.url || data.data?.url, "_self");
            } else {
              this.loadingService.hideLoadingSpinner();
              this.router.navigate(['order/', this.sessionId]);
            }
          }
        }
      },
      error: (err: any) => {
        this.logger.error(err?.message, { stack: err?.stack, context: 'OrderComponent.payment' });
        this.loadingService.hideLoadingSpinner();
      },
    });
  }

  convertDateFormat(dateStr: string) {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const formattedDay = day < 10 ? `0${day}` : day;
    const formattedMonth = month < 10 ? `0${month}` : month;
    const formattedYear = year;
    const formattedHours = hours < 10 ? `0${hours}` : hours;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const period = hours >= 12 ? "PM" : "AM";
    const formattedHour = hours > 12 ? hours - 12 : hours;
    return `${formattedDay}/${formattedMonth}/${formattedYear}, ${formattedHour}:${formattedMinutes} ${period}`;
  }

  convertDateFormat2(dateStr: string) {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();

    const formattedDay = day < 10 ? `0${day}` : day;
    const formattedMonth = month < 10 ? `0${month}` : month;
    const formattedYear = year;
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const period = hours >= 12 ? "PM" : "AM";

    return `${formattedDay}/${formattedMonth}/${formattedYear}, ${formattedHours}:${formattedMinutes} ${period}`;
  }

  async getPageData() {
    let data = await this.pageBuilderServices.getPage('order');
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

  goBack() {
    this.router.navigate(['/']);
  }

  isPaymentRequired(): boolean {
    // No payments at all
    if (!this.order.invoicePayments?.length) return true;

    // Check if only Points payment exists and doesn't cover the full total
    const hasOnlyPoints = this.order.invoicePayments.every(p => p.name === 'Points');
    if (hasOnlyPoints) {
      const pointsPaid = this.order.invoicePayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
      return pointsPaid < this.order.total;
    }

    return false;
  }

  goToHome() {
    this.router.navigate(['/']);
  }

  openRateService() {
    if (!this.isBrowser) return;

    try {
      if (!this.modalService) {
        this.logger.error('Modal service not available', { context: 'OrderComponent.openPickupModal' });
        return;
      }

      let data = {
        orderData: this.order
      };
      const modalRef = this.modalService.openWithData(FeedbackPopComponent, data, {
        centered: true,
        windowClass: "modal-md modal-fullscreen-md-down",
        backdrop: 'static',
        keyboard: false,
      });

      this.handleModalResult(modalRef);
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'OrderComponent.openPickupModal' });
    }
  }

  private handleModalResult(modalRef: NgbModalRef): void {
    modalRef.result.then(
      (data: any) => {
        if (data && data.success) {
        }
      },
      (reason: any) => {
        // Handle dismissal - user canceled
      }
    ).catch((error: any) => {
      this.logger.error(error?.message, { stack: error?.stack, context: 'OrderComponent.handleModalResult' });
    });
  }


  openTrackOrderMap() {
    if (!this.isBrowser) return;

    try {
      if (!this.modalService) {
        this.logger.error('Modal service not available', { context: 'OrderComponent.openTrackOrderMap' });
        return;
      }

      let data = {
        orderData: this.order
      };
      const modalRef = this.modalService.openWithData(TrackOrderMapPopComponent, data, {
        centered: true,
        windowClass: "modal-xl modal-fullscreen-md-down",
        backdrop: 'static',
        keyboard: false,
      });

      this.handleModalTrackOrderMap(modalRef);
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'OrderComponent.handleModalTrackOrderMap' });
    }
  }

  private handleModalTrackOrderMap(modalRef: NgbModalRef): void {
    modalRef.result.then(
      (data: any) => {
        if (data && data.success) {
        }
      },
      (reason: any) => {
        // Handle dismissal - user canceled
      }
    ).catch((error: any) => {
      this.logger.error(error?.message, { stack: error?.stack, context: 'OrderComponent.handleModalTrackOrderMap' });
    });
  }
  


}
