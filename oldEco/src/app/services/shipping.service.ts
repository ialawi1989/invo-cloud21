import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AppServices } from './appServices';
import { AppConfigService } from './app-config.service';
import { ShippingOptions } from '../models/shipping-options.model';
import { LoggerService } from './logger/logger.service';



@Injectable({
  providedIn: 'root'
})

export class ShippingService {

  private logger = inject(LoggerService);

  constructor(
    private http: HttpClient,
    private config: AppConfigService,
    private appService: AppServices
  ) {

  }

  // Get the list of branches
  getShippingOptions(cartId:any): Observable<ShippingOptions[] | null> {
    const url = `${this.config.baseUrl}shipping/getShippingOptions/${cartId}`;
    return this.http.get<any>(url, { headers: this.appService.getHeaders() }).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data.map((option: any) => { const _inst = new ShippingOptions(); _inst.ParseJson(option); return _inst; });
        }
        return null;
      }),
      catchError(error => {
        this.logger.error(error, { context: 'ShippingService.getShippingOptions' });
        throw new Error('Failed to load branches');
      })
    );
  }

    // Get the list of branches
  getShippingSettings(): Observable<any[]> {
    const url = `${this.config.baseUrl}shipping/getShippingSetting`;
    return this.http.get<any>(url, { headers: this.appService.getHeaders() }).pipe(
      map(response => {
        
        if (response.success && response.data) {
          return response.data.CountriesPrices
        }
        return [];
      }),
      catchError(error => {
        this.logger.error(error, { context: 'ShippingService.getShippingSettings' });
        throw new Error('Failed to load branches');
      })
    );
  }

   setShipping(cartId: string, id: string): Observable<any> {
      return this.http
        .post<{ success: boolean; data: any }>(`${this.config.baseUrl}shipping/setShippingPrice`, {cartId, id})
        .pipe(
          map(response => {
            if (response.success) {
              return response;
            }
            throw new Error('Error');
          })
        );
    }

}