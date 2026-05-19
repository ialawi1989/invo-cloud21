import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cartServices/cart.service';
import { Reservation } from '../../models/reservation.model';
import { PaymentService } from '../../services/paymentServices/payments.service';
import { LoadingService } from '../../services/loadingService/loading.service';
import { CompanyServices } from '../../services/companyServices/company.service';
import { Company } from '../../models/company.model';
import { AlertService } from '../../services/alertService/alert.service';
import { isPlatformBrowser } from '@angular/common';
import { CurrencyService } from '../../services/currencyService/currency.service';
import { TranslateModule } from '@ngx-translate/core';
import { SpinnerComponent } from "../../components/spinner/spinner.component";
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';
import { PageData } from 'src/app/models/page-data/pageData';
import { Location } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-reservation',
  imports: [
    RouterLink,
    TranslateModule,
    SpinnerComponent
  ],
  templateUrl: './reservation.component.html',
  styleUrls: ['./reservation.component.css']
})
export class ReservationComponent implements OnInit, OnDestroy , OnDestroy{
  private destroy$ = new Subject<void>();

  private logger = inject(LoggerService);
  loading: boolean = true;
  reservation: Reservation | any = new Reservation();
  reservationId: any = "";
  payments: any = [];
  selectedPayment: string = "";
  isBenefitPayOpened: boolean = false;
  companyData: Company = new Company();

  currentCurrency: any = {};
  isBrowser: boolean;
  pageData: PageData | any = new PageData();

  private reservationRefreshTimeout: any;
  canGoBack: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cartService: CartService,
    private paymentService: PaymentService,
    private loadingService: LoadingService,
    private companyService: CompanyServices,
    private alertService: AlertService,
    private pageBuilderServices: PageBuilderService,
    private currencyService: CurrencyService,
    private location: Location,
    @Inject(PLATFORM_ID) private platformId: any,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  }

  async ngOnInit() {
    await this.getPageData();
    window.scrollTo({ top: 0 });
    // Subscribe to route parameters
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.reservationId = this.route.snapshot.paramMap.get('id');
    });
    this.refreshReservationData();
    this.getCompanyData();
    // this.getPayments();

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
    if (this.reservationRefreshTimeout) {
      clearTimeout(this.reservationRefreshTimeout);
    }
  }

  refreshReservationData() {
    this.getReservation();
    // update reservation details every 7 seconds
    this.reservationRefreshTimeout = setTimeout(() => {
      this.refreshReservationData();
    }, 7000);
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

  getReservation() {
    this.cartService.getReservationData(this.reservationId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Reservation | null) => {
        if (data) {
          this.reservation = data;
        }
        this.loading = false;
      },
      error: (err: any) => {
        this.logger.error(err?.message, { stack: err?.stack, context: 'ReservationComponent.fetchReservation' });
        this.loading = false;
      },
    });
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
      this.alertService.showAlert({ title: "Failed to pay reservation! Please try again or contact us for more details" });
      return;
    }

    this.payments.forEach((paymnt: any) => {
      if (paymnt.name === this.selectedPayment) {
        this.payment = paymnt;
      }
    });

    this.loadingService.showLoadingSpinner();
    this.paymentService.reCheckout({
      sessionId: this.reservationId,
      payment: {
        name: this.payment.name
      }
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: any) => {
        if (data) {
          if (this.payment.name === 'afs') {
            this.paymentService.AfsPayment(data.config);

          // ─── BENEFITPAY FIX START ──────────────────────────────────────────
          } else if (this.payment.name === 'BenefitPay') {
            this.isBenefitPayOpened = true;
            this.loadingService.hideLoadingSpinner();

            InApp.open(
              data,
              // Success callback — verify server-side; client result alone
              // cannot be trusted
              (success: any) => {
                this.isBenefitPayOpened = false;
                this.paymentService
                  .checkBenefitPayStatus2(data.referenceNumber, this.reservationId)
                  .then((isSuccess: boolean) => {
                    this.router.navigate([isSuccess ? 'order/complete' : 'order/error']);
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
                    .checkBenefitPayStatus2(data.referenceNumber, this.reservationId)
                    .then((isSuccess: boolean) => {
                      this.router.navigate([isSuccess ? 'order/complete' : 'order/error']);
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
                    .checkBenefitPayStatus2(data.referenceNumber, this.reservationId)
                    .then((isSuccess: boolean) => {
                      if (isSuccess) {
                        // Payment actually went through — send to complete
                        this.router.navigate(['order/complete']);
                      }
                      // If not paid, stay on reservation page (no navigation)
                    })
                    .catch(() => {
                      // Stay on page silently — user cancelled, no charge confirmed
                    });
                }
              }
            );
          // ─── BENEFITPAY FIX END ────────────────────────────────────────────

          } else {
            if (data.url || data.data?.url) {
              window.open(data.url || data.data?.url, "_self");
            } else {
              this.router.navigate(['reservation/', this.reservationId]);
            }
          }
        }
        this.loadingService.hideLoadingSpinner();
      },
      error: (err: any) => {
        this.logger.error(err?.message, { stack: err?.stack, context: 'ReservationComponent.payment' });
        this.loadingService.hideLoadingSpinner();
      },
    });
  }

  convertDateFormat(dateStr: string) {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth() + 1; // Months are zero-based
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

  /**
   * Extracts and returns only the date portion in DD/MM/YYYY format
   */
  getDateOnly(dateStr: string): string {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const formattedDay = day < 10 ? `0${day}` : day;
    const formattedMonth = month < 10 ? `0${month}` : month;
    return `${formattedDay}/${formattedMonth}/${year}`;
  }

  /**
   * Extracts and returns only the time portion in HH:MM AM/PM format
   */
  getTimeOnly(dateStr: string): string {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const period = hours >= 12 ? "PM" : "AM";
    const formattedHour = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${formattedHour}:${formattedMinutes} ${period}`;
  }

  async getPageData() {
    let data = await this.pageBuilderServices.getPage('reservation');

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

  goBack() {
    // if (this.canGoBack) {
    //   this.location.back();
    // } else {
    this.router.navigate(['/']);
    // }
  }

  getStatusLable(status: string) {
    let tempStatus = 'placed';
    if (status) {
      tempStatus = status.toLowerCase();
    }
    if (tempStatus == 'accept') {
      return 'accepted';
    } else {
      return tempStatus;
    }
  }
}