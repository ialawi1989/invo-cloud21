import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { AppConfigService } from '../app-config.service';
import { map, catchError } from 'rxjs/operators';
import { Injectable, inject } from '@angular/core';
import { AuthService } from '../authService/auth.service';
import { LoggerService } from '../logger/logger.service';


@Injectable({
  providedIn: 'root',
})

export class ServiceRequestService {

  private logger = inject(LoggerService);
  auth_token: any;

  private serviceRequestPop = new BehaviorSubject<boolean>(false);
  serviceRequestPopState$ = this.serviceRequestPop.asObservable();

  constructor(
    private http: HttpClient,
    private config: AppConfigService,
    auth: AuthService
  ) {
    auth.currentToken.subscribe(v => {
      this.auth_token = v;
    });
  }

  getHeaders() {
    let params: any = {
      'Content-Type': 'application/json'
    }
    if (this.auth_token) {
      params["Auth-Token"] = this.auth_token
    }
    return new HttpHeaders(params);
  }

  showServiceRequestPop() {
    this.serviceRequestPop.next(true);
    document.body.style.overflow = 'hidden';
  }

  hideServiceRequestPop() {
    this.serviceRequestPop.next(false);
    document.body.style.overflow = 'auto';
  }

  getNotificationTemplateList(): Observable<any[] | null> {
    const url = `${this.config.baseUrl}notification/getNotificationTemplateList`;

    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        return null;
      }),
      catchError(error => {
        this.logger.error(error, { context: 'ServiceRequestService.getNotificationTemplateList' });
        throw new Error('Failed to load branches');
      })
    );
  }

  sendNotificationByBranch(serviceId: any, branchId: any, tableId: string | null, tableNumber: number | any): Observable<any[] | null> {
    const url = `${this.config.baseUrl}notification/sendNotificationByBranch/${serviceId}/${branchId}`;

    return this.http.post<any>(url, { tableId, tableNumber }, { headers: this.getHeaders() }).pipe(
      map(response => {
        if (response.success) {
          return response
        }
        return null;
      }),
      catchError(error => {
        this.logger.error(error, { context: 'ServiceRequestService.sendNotificationByBranch' });
        throw new Error('Failed to load branches');
      })
    );
  }

}

