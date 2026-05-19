//ecommerce payments service ts

import { Inject, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppConfigService } from '../app-config.service';
import { Currency } from '../../models/currency.model';
import { PaymentMethods } from '../../models/payment-methods.model';
import { map, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Router } from '@angular/router';
import { LoadingService } from '../loadingService/loading.service';
import { isPlatformBrowser } from '@angular/common';
import { Order } from '../../models/order.model';
import { AlertService } from '../alertService/alert.service';
import { AppServices } from '../appServices';
import { LoggerService } from '../logger/logger.service';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);
  isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private http: HttpClient,
    private config: AppConfigService,
    private router: Router,
    private loadingService: LoadingService,
    private alertService: AlertService,
    private appService: AppServices
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  getCurrenciesList(): Observable<Currency[]> {
    return this.http
      .get<{ success: boolean; data: any[] }>(`${this.config.baseUrl}payments/getCurrencyList`, { headers: this.appService.getHeaders() })
      .pipe(
        map(response => {
          if (response.success) {
            return response.data.map(item => { const _inst = new Currency(); _inst.ParseJson(item); return _inst; }); // Use fromJson for Currency model
          }
          return [];
        })
      );
  }

  getPaymentsMethods(): Observable<PaymentMethods[]> {
    return this.http
      .get<{ success: boolean; data: any[] }>(`${this.config.baseUrl}payments/getPaymentMethods`, { headers: this.appService.getHeaders() })
      .pipe(
        map(response => {
          if (response.success) {
            return response.data.map(item => { const _inst = new PaymentMethods(); _inst.ParseJson(item); return _inst; }); // Use fromJson for PaymentMethods model
          }
          return [];
        })
      );
  }

  checkoutCart(body: any): Observable<null> {
    return this.http
      .post<{ success: boolean }>(`${this.config.baseUrl}cart/checkOut`, body, { headers: this.appService.getHeaders() })
      .pipe(
        map((response: any) => {
          return response;
        })
      );
  }

  reCheckout(body: any): Observable<null> {
    return this.http
      .post<{ success: boolean }>(`${this.config.baseUrl}payments/payInvoice`, body, { headers: this.appService.getHeaders() })
      .pipe(
        map((response: any) => {
          if (response.success) {
            return response.data;
          }
          return null;
        })
      );
  }

  async AfsPayment(data: any) {
    if (this.isBrowser) {
      const script = document.createElement('script');
      script.src = 'https://afs.gateway.mastercard.com/static/checkout/checkout.min.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.AfsScriptLoaded(data);
      };
      document.body.appendChild(script);
    } else {
      this.loadingService.hideLoadingSpinner();
      this.logger.error(new Error('Document is not defined. Ensure this code runs in a browser environment.'), { context: 'PaymentService.AfsPayment' });
    }
  }
  AfsScriptLoaded(data: any) {
    if (typeof Checkout !== 'undefined') {
      let config = data;

      Checkout.configure({
        session: {
          id:data.sessionId
        }
      });
      Checkout.showPaymentPage();
    } else {
      this.loadingService.hideLoadingSpinner()
      this.logger.error(new Error('Checkout is not defined. The script may not have loaded correctly.'), { context: 'PaymentService.AfsScriptLoaded' });
    }
  }

  async CrediMaxPayment(data: any) {
    if (this.isBrowser) {
      const script = document.createElement('script');
      script.src = 'https://credimax.gateway.mastercard.com/static/checkout/checkout.min.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.CrediMaxScriptLoaded({
          session: {
            id: data.sessionId
          }
        });
      };
      document.body.appendChild(script);
    } else {
      this.loadingService.hideLoadingSpinner();
      this.logger.error(new Error('Document is not defined. Ensure this code runs in a browser environment.'), { context: 'PaymentService.CrediMaxPayment' });
    }
  }
  CrediMaxScriptLoaded(data: any) {
    if (typeof Checkout !== 'undefined') {
      Checkout.configure(data);
      Checkout.showPaymentPage();
    } else {
      this.loadingService.hideLoadingSpinner()
      this.logger.error(new Error('Checkout is not defined. The script may not have loaded correctly.'), { context: 'PaymentService.CrediMaxScriptLoaded' });
    }
  }


  // ─── BENEFITPAY FIX START ──────────────────────────────────────────────────

  /**
   * checkBenefitPayStatus
   *
   * REMOVED — this method returned an Observable that was never subscribed to
   * in the component, meaning it silently did nothing on error/cancel callbacks.
   * All callers have been migrated to checkBenefitPayStatus2 below.
   *
   * If you need an Observable-based variant elsewhere, use:
   *   this.http.post(...).pipe(...)
   * and make sure to .subscribe() at the call site.
   */

  /**
   * checkBenefitPayStatus2
   *
   * Verifies BenefitPay transaction status with the server.
   *
   * Changes from original:
   * - Removed unused `isBenefitPayOpened` param (was passed by value; mutations
   *   inside had no effect on the caller's variable).
   * - Removed unused `sessionId` param.
   * - Replaced deprecated `.toPromise()` with `new Promise + .subscribe()`.
   * - Moved `InApp.close()` here so it always fires once we have a result,
   *   wrapped in try/catch in case the widget is already closed.
   * - Returns a clean `Promise<boolean>` — true = paid, false = not paid.
   */
  checkBenefitPayStatus2(
    referenceNumber: string,
    sessionId?: string        // kept in signature for backwards compatibility; not used
  ): Promise<boolean> {
    const body = { referenceId: referenceNumber };

    return new Promise<boolean>((resolve, reject) => {
      this.http
        .post<{ success: boolean; data?: any }>(
          `${this.config.baseUrl}payments/checkBenefitPayStatus`,
          body,
          { headers: this.appService.getHeaders() }
        )
        .pipe(takeUntil(this.destroy$)).subscribe({
          next: (responseData: any) => {
            // Always attempt to close the InApp widget once we have a result
            try { InApp.close(); } catch (e) { /* widget may already be closed */ }
            resolve(!!(responseData?.success && responseData?.data));
          },
          error: (err) => {
            // Close widget even on HTTP error
            try { InApp.close(); } catch (e) { }
            this.logger.error(err, { context: 'PaymentService.checkBenefitPayStatus2' });
            reject(err);
          },
        });
    });
  }

  // ─── BENEFITPAY FIX END ────────────────────────────────────────────────────


  async initInApp() {
    return new Promise(response => {
      this.loadExternalScript('https://code.jquery.com/jquery-3.5.1.min.js', 'jquery').then(() => {
        this.loadExternalScript('./assets/js/InApp.min.js', 'InApp').then(() => {
          response(true);
        });
      });
    })
  }

  loadExternalScript(scriptUrl: any, id: any) {
    return new Promise((resolve) => {
      try {
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
          if (document.getElementById(id) != null) {
            resolve(false);
          } else {
            const scriptElement = document.createElement('script');
            scriptElement.src = scriptUrl;
            scriptElement.onload = () => resolve(true);
            scriptElement.id = id;
            document.body.appendChild(scriptElement);
          }
        } else {
          resolve(false); // Not in a browser
        }
      } catch (error) {
        resolve(false);
      }
    });
  }

}