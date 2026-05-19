import { Component, Inject, OnInit, PLATFORM_ID, OnDestroy} from '@angular/core';
import { Product } from '../../models/product.model';
import { Router, RouterLink } from '@angular/router';
import { CompanyServices } from '../../services/companyServices/company.service';
import { Company } from '../../models/company.model';
import { isPlatformBrowser } from '@angular/common';
import { CurrencyService } from '../../services/currencyService/currency.service';
import { Order } from '../../models/order.model';
import { CartService } from '../../services/cartServices/cart.service';
import { response } from 'express';
import { LoadingService } from '../../services/loadingService/loading.service';
import { TranslateModule } from '@ngx-translate/core';
import { Reservation } from '../../models/reservation.model';
import { SpinnerComponent } from "../../components/spinner/spinner.component";
import { PageData } from 'src/app/models/page-data/pageData';
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';
import { Location } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-reservation-list',
  imports: [RouterLink, TranslateModule, SpinnerComponent],
  templateUrl: './reservation-list.component.html',
  styleUrl: './reservation-list.component.css'
})
export class ReservationListComponent implements OnInit , OnDestroy{
  private destroy$ = new Subject<void>();

  isBrowser: boolean;
  companyData: Company = new Company();
  reservations: Reservation[] | any = [];
  loading: boolean = true;
  pageData: PageData | any = new PageData();
  canGoBack: boolean = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private companyService: CompanyServices,
    private currencyService: CurrencyService,
    private cartService: CartService,
    private pageBuilderServices: PageBuilderService,
    private location: Location,
    private router: Router,
    private loadingService: LoadingService,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  }

  async ngOnInit() {
    await this.getPageData();
    window.scrollTo({ top: 0 });
    this.loading = true;

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
    await this.getReservations();
    //sort reservations by createdAt
    this.reservations.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // Sort in descending order
    });
    this.loading = false;
  }

  currentCurrency: any = { rate: 1, symbol: 'USD' };

  getCompanyData() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => {
        this.companyData = data;
        this.currentCurrency = { afterDecimal: this.companyData.settings['afterDecimal'], rate: 1, symbol: this.companyData.settings['currencySymbol'] }
      },
    });
  }

  getConvertedPrice(price: number) {
    var price = (price / (this.currentCurrency.rate || 0)) || 0
    return price.toFixed(this.companyData.settings['afterDecimal']);
  }

  async getReservations() {
    return new Promise(async (response) => {
      if (this.isBrowser) {
        const sessions = JSON.parse(localStorage.getItem('reservations') || '[]');
        const nowDate = this.convertNowDateFormat(new Date());

        if (sessions?.length) {
          const reservationPromises = sessions.map(async (session: any) => {
            let reservation: any = { sessionId: session.id };
            const data = await this.getReservationData(reservation);
            if (data) {
              if (!reservation.id || this.isReservationOld(this.convertDateFormat(reservation.reservationDate), nowDate)) {
                this.removeItemFromReservations(reservation.sessionId);
              } else {
                this.reservations.push(reservation);
              }
            } else {
              this.removeItemFromReservations(reservation.sessionId);
            }
          });

          await Promise.all(reservationPromises);
        }
        response(true);
      } else {
        response(false);
      }
    });
  }

  isReservationOld(createdAtStr: any, nowDateStr: any) {
    // Function to parse the date string and return a Date object
    function parseDate(dateStr: any) {
      const [datePart, timePart] = dateStr.split(', ');
      const [day, month, year] = datePart.split('/').map(Number);
      const [time, modifier] = timePart.split(' ');
      let [hour, minute] = time.split(':').map(Number);

      // Convert to 24-hour format
      if (modifier === 'PM' && hour < 12) hour += 12;
      if (modifier === 'AM' && hour === 12) hour = 0;

      return new Date(year, month - 1, day, hour, minute);
    }
    // Parse the date strings into Date objects
    const createdAt: any = parseDate(createdAtStr);
    const nowDate: any = parseDate(nowDateStr);
    // Check if dates are valid
    if (isNaN(createdAt) || isNaN(nowDate)) {
      return false;
    }
    // Calculate the difference in milliseconds
    const differenceInMilliseconds = nowDate - createdAt;
    // Convert the difference into hours
    const differenceInHours = Math.floor(differenceInMilliseconds / (1000 * 60 * 60));
    // Return true if the reservation is older than 24 hours
    return differenceInHours > 24;
  }

  getReservationData(reservation: any) {
    return new Promise(response => {
      this.cartService.getReservationData(reservation.sessionId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: Reservation | null) => {
          if (data) {
            Object.assign(reservation, data); // Update reservation object with fetched data
            response(true);
          } else {
            response(false);
          }
        }, error(err) {
          response(false);
        },
      });
    });
  }

  // Setup listener for changes in localStorage
  setupStorageListener() {
    if (this.isBrowser) {
      window.addEventListener('storage', async (event) => {
        if (event.key === 'reservations') {
          await this.getReservations();
        }
      });
    }
  }

  // Remove a product from the reservations
  removeItemFromReservations(id: string) {
    if (this.isBrowser) {
      // Get the current reservations from localStorage
      const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
      // Filter out the product to be removed
      const updatedReservations = reservations.filter((item: any) => item.id !== id);
      // Save the updated reservations to localStorage
      localStorage.setItem('reservations', JSON.stringify(updatedReservations));
    }
  }

  convertDateFormat(dateStr: any) {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth() + 1; // Months are zero-based, so we add 1
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    // Format the components with leading zeros if necessary
    const formattedDay = day < 10 ? `0${day}` : day;
    const formattedMonth = month < 10 ? `0${month}` : month;
    const formattedYear = year;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    // Determine if it's AM or PM
    const period = hours >= 12 ? "PM" : "AM";
    // Adjust the hour to 12-hour format
    const formattedHour = hours > 12 ? hours - 12 : hours;
    const formattedDate = `${formattedDay}/${formattedMonth}/${formattedYear}, ${formattedHour}:${formattedMinutes} ${period}`;
    return formattedDate;
  }

  convertNowDateFormat(dateStr: any) {
    const options = { hour: 'numeric', minute: 'numeric', hour12: true };
    const day = String(dateStr.getDate()).padStart(2, '0');
    const month = String(dateStr.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const year = dateStr.getFullYear();
    const time = dateStr.toLocaleString('en-US', options);
    return `${day}/${month}/${year}, ${time}`;
  }

  goBack() {
    if (this.canGoBack) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }

  async getPageData() {
    let data = await this.pageBuilderServices.getPage('my-reservations');

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


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
