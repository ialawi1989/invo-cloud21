import { Component, Inject, OnDestroy, PLATFORM_ID } from '@angular/core';
import { Reservation } from '../../../models/reservation.model';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { CartService } from '../../../services/cartServices/cart.service';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-last-reservation-placed-section',
  imports: [
    RouterLink,
    TranslateModule,
    CommonModule
  ],
  templateUrl: './last-reservation-placed-section.component.html',
  styleUrl: './last-reservation-placed-section.component.css'
})
export class LastReservationPlacedSectionComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  isBrowser: boolean;
  lastReservationData!: Reservation | any;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private cartService: CartService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.getLastReservationData();
  }

  onViewLastReservationClick() {
    this.lastReservationData = null
  }

  async getLastReservationData() {
    if (this.isBrowser) {
      let sessions: any = JSON.parse(localStorage.getItem('reservations') || '[]');
      if (sessions?.length > 0) {
        let reservation: any = {
          sessionId: sessions[sessions.length - 1].id
        };
        await this.getReservationData(reservation);
        if (reservation.reservationDate) {
          const nowDate = this.convertNowDateFormat(new Date());
          if (!this.isReservationOld(this.convertDateFormat(reservation.reservationDate), nowDate)) {
            this.lastReservationData = reservation;
          }
          else {
            sessions.splice((sessions.length - 1), 1);
            localStorage.setItem('reservations', JSON.stringify(sessions));
            if (sessions?.length > 0) {
              this.getLastReservationData();
            }
          }
        } else {
          sessions.splice((sessions.length - 1), 1);
          localStorage.setItem('reservations', JSON.stringify(sessions));
          if (sessions?.length > 0) {
            this.getLastReservationData();
          }
        }
      } else {
        return;
      }
    }
  }

  getReservationData(reservation: any) {
    return new Promise(response => {
      this.cartService.getReservationData(reservation.sessionId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: Reservation | null) => {
          if (data) {
            Object.assign(reservation, data); // Update reservation object with fetched data
          }
          response(true);
        }, error(err) {
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

  isReservationOld(reservationDateStr: any, nowDateStr: any) {
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
    const reservationDate: any = parseDate(reservationDateStr);
    const nowDate: any = parseDate(nowDateStr);
    // Check if dates are valid
    if (isNaN(reservationDate) || isNaN(nowDate)) {
      return false;
    }
    // Calculate the difference in milliseconds
    const differenceInMilliseconds = nowDate - reservationDate;
    // Convert the difference into hours
    const differenceInHours = Math.floor(differenceInMilliseconds / (1000 * 60 * 60));
    // Return true if the reservation is older than 24 hours
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


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
