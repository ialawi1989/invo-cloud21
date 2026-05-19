import { isPlatformBrowser } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Inject, Injectable, PLATFORM_ID, inject } from "@angular/core";
import { Observable,catchError, map } from "rxjs";
import { AppConfigService } from "../app-config.service";
import { Menu } from "../../models/menu.model";
import { Reservation } from "../../models/reservation.model";
import { AppServices } from "../appServices";
import { LoggerService } from "../logger/logger.service";

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private logger = inject(LoggerService);
  isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private http: HttpClient,
    private config: AppConfigService,
    private appService: AppServices
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  saveReservation(body:any): Observable<Reservation | null> {
    return this.http
      .post<any>(`${this.config.baseUrl}reservation/saveReservation`, body, {
        headers: this.appService.getHeaders(),
      })
      .pipe(
        catchError(this.handleError),
        map((response) => {
          if (response.success) {
            // return Reservation.ParseJson(response.data);
            return response.data;
          }
          return null;
        })
      );
  }

  private handleError = (error: any): Observable<never> => {
    this.logger.error(error, { context: 'ReservationService.handleError' });
    throw error; // or use a more appropriate error handling mechanism
  }


}