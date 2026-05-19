import { Inject, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Service } from '../models/service-type.model';
import { AppConfigService } from './app-config.service';
import { isPlatformBrowser } from '@angular/common';
import { LoggerService } from './logger/logger.service';

@Injectable({
  providedIn: 'root'
})
export class ServiceType {

  private logger = inject(LoggerService);
  isBrowser: boolean;
  constructor(private http: HttpClient, private config: AppConfigService, @Inject(PLATFORM_ID) private platformId: any) {

    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  // Fetch list of services
  getServices(): Observable<Service[]> {
    let token =""
    if (this.isBrowser) {
      token = localStorage.getItem('token') ?? ''; // Get token from local storage or another source
    }
    const url = `${this.config.baseUrl}menu/getServices`;

    const headers = new HttpHeaders({
      "Api-Auth": token
    });

    return this.http.get<any>(url, { headers }).pipe(
      map(response => {
        if (response.success && response.data?.list) {
          return response.data.list.map((item: any) => Service.fromMap(item));
        }
        return []; // Return empty array if no valid data
      }),
      catchError(error => {
        this.logger.error(error, { context: 'ServiceType.getServices' });
        throw new Error('Failed to load services');
      })
    );
  }
}
