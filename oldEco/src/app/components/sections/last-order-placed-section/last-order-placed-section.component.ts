import { Component, Inject, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { Order } from '../../../models/order.model';
import { isPlatformBrowser } from '@angular/common';
import { CartService } from '../../../services/cartServices/cart.service';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../services/authService/auth.service';
import { AppServices } from '../../../services/appServices';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-last-order-placed-section',
  imports: [
    RouterLink,
    TranslateModule
  ],
  templateUrl: './last-order-placed-section.component.html',
  styleUrl: './last-order-placed-section.component.css'
})
export class LastOrderPlacedSectionComponent implements OnDestroy {

  private logger = inject(LoggerService);
  isBrowser: boolean;
  lastOrderData!: Order | any;
  isUserAuthenticated: boolean = false;
  private destroy$ = new Subject<void>();

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private cartService: CartService,
    private authService: AuthService,
    public appService: AppServices
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.checkAuthentication();
    this.getLastOrderData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Check if user is authenticated
   */
  private checkAuthentication(): void {
    this.isUserAuthenticated = !!(this.appService.auth_token && this.appService.auth_token.trim() !== '');
  }

  onViewLastOrderClick() {
    this.lastOrderData = null;
  }

  /**
   * Main method to get last order data
   * Priority: API (authenticated) > LocalStorage (guest)
   */
  async getLastOrderData() {
    if (!this.isBrowser) {
      return;
    }

    // If user is authenticated, fetch from API
    if (this.isUserAuthenticated) {
      this.getLastOrderFromAPI();
    } else {
      // Otherwise, use localStorage for guest users
      this.getLastOrderFromLocalStorage();
    }
  }

  /**
   * Fetch last order from API for authenticated users
   * Gets the first page with limit 1 to retrieve only the latest order
   */
  private getLastOrderFromAPI(): void {
    this.authService.getOrderHistory(1, 1)
      .pipe(takeUntil(this.destroy$))
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (response: any) => {
          if (response.orders && response.orders.length > 0) {
            const order = response.orders[0];
            order.sessionId = order.id; // Use order ID as sessionId for consistency with localStorage logic
            
            // Check if order is not older than 24 hours
            const nowDate = this.convertNowDateFormat(new Date());
            const orderCreatedDate = this.convertDateFormat(order.createdAt);
            
            if (!this.isOrderOld(orderCreatedDate, nowDate)) {
              this.lastOrderData = order;
            } else {
              this.lastOrderData = null;
            }
          } else {
            this.lastOrderData = null;
          }
        },
        error: (err: any) => {
          this.logger.error(err?.message, { stack: err?.stack, context: 'LastOrderPlacedSectionComponent.fetchLastOrder' });
          this.lastOrderData = null;
        }
      });
  }

  /**
   * Fetch last order from localStorage for guest users
   * Falls back to the original localStorage logic
   */
  private getLastOrderFromLocalStorage(): void {
    let sessions: any = JSON.parse(localStorage.getItem('orders') || '[]');
    
    if (sessions?.length > 0) {
      let order: any = {
        sessionId: sessions[sessions.length - 1].id
      };
      
      this.getOrderData(order).then(() => {
        if (order.lines?.length > 0) {
          const nowDate = this.convertNowDateFormat(new Date());
          if (!this.isOrderOld(this.convertDateFormat(order.createdAt), nowDate)) {
            this.lastOrderData = order;
          } else {
            localStorage.removeItem('orders');
          }
        } else {
          // Remove invalid order and try next one
          sessions.splice((sessions.length - 1), 1);
          localStorage.setItem('orders', JSON.stringify(sessions));
          if (sessions?.length > 0) {
            this.getLastOrderData();
          }
        }
      });
    }
  }

  /**
   * Fetch order data from CartService by sessionId
   * Used only for guest/session-based orders from localStorage
   */
  getOrderData(order: any) {
    return new Promise(response => {
      this.cartService.getOrderData(order.sessionId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: Order | null) => {
          if (data) {
            Object.assign(order, data); // Update order object with fetched data
          }
          response(true);
        }, 
        error(err) {
          response(false);
        },
      });
    });
  }

  convertNowDateFormat(dateStr: any) {
    const options = { hour: 'numeric', minute: 'numeric', hour12: true };
    const day = String(dateStr.getDate()).padStart(2, '0');
    const month = String(dateStr.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const year = dateStr.getFullYear();
    const time = dateStr.toLocaleString('en-US', options);
    return `${day}/${month}/${year}, ${time}`;
  }

  isOrderOld(orderDateStr: any, nowDateStr: any) {
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
    const orderDate: any = parseDate(orderDateStr);
    const nowDate: any = parseDate(nowDateStr);
    
    // Check if dates are valid
    if (isNaN(orderDate) || isNaN(nowDate)) {
      return false;
    }
    
    // Calculate the difference in milliseconds
    const differenceInMilliseconds = nowDate - orderDate;
    
    // Convert the difference into hours
    const differenceInHours = Math.floor(differenceInMilliseconds / (1000 * 60 * 60));
    
    // Return true if the order is older than 24 hours
    return differenceInHours > 24;
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
    const formattedHours = hours < 10 ? `0${hours}` : hours;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    
    // Determine if it's AM or PM
    const period = hours >= 12 ? "PM" : "AM";
    
    // Adjust the hour to 12-hour format
    const formattedHour = hours > 12 ? hours - 12 : hours;
    const formattedDate = `${formattedDay}/${formattedMonth}/${formattedYear}, ${formattedHour}:${formattedMinutes} ${period}`;
    
    return formattedDate;
  }

}