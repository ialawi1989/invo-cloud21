import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AppConfigService } from '../app-config.service';
import { AuthService } from '../authService/auth.service';
import { AppServices } from '../appServices';
import { Order } from 'src/app/models/order.model';
import { LoggerService } from '../logger/logger.service';

@Injectable({
  providedIn: 'root'
})
export class FeedbacksService {
  private logger = inject(LoggerService);
  auth_token = '';

  constructor(
    private http: HttpClient,
    private config: AppConfigService,
    auth: AuthService,
    private appService: AppServices
  ) {
    auth.currentToken.subscribe(v => {
      this.auth_token = v;
    });
  }

  saveFeedback(param: any): Observable<any> {
    return this.http
      .post<any>(`${this.config.baseUrl}shop/saveFeedback`, param, {
        headers: this.appService.getHeaders(),
      })
      .pipe(
        catchError(this.handleError),
        map((response) => {
          if (response.success) {
            return response.data;
          }
          return null;
        })
      );
  }

  
    getFeedbackOrderData(id: string): Observable<Order | null> {
      return this.http
        .get<any>(`${this.config.baseUrl}shop/Feedback/order/${id}`, {
          headers: this.appService.getHeaders(),
        })
        .pipe(
          catchError(this.handleError),
          map((response) => {
            if (response.success) {
              const _inst = new Order(); _inst.ParseJson(response.data); return _inst;
            }
            return null;
          })
        );
    }

  private handleError = (error: any): Observable<never> => {
    this.logger.error(error, { context: 'FeedbacksService.handleError' });
    throw error;
  }
}