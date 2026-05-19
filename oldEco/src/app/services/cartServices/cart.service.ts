import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, from, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { AppConfigService } from '../app-config.service';
import { Order } from '../../models/order.model';
import { Invoice } from '../../models/invoice-model';
import { Reservation } from '../../models/reservation.model';
import { AlertService } from '../alertService/alert.service';
import { AuthService } from '../authService/auth.service';
import { AppServices } from '../appServices';
import { LoggerService } from '../logger/logger.service';

@Injectable({
  providedIn: 'root', // This makes the service available application-wide
})
export class CartService {
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);
  auth_token = "";
  constructor(
    private http: HttpClient,
    private config: AppConfigService,
    private alertService: AlertService,
    auth: AuthService,
    private appService: AppServices
  ) {
    auth.currentToken.subscribe(v => {
      this.auth_token = v;
    });
  }



  createCart(body: any): Observable<Invoice | null> {
    return this.http
      .post<any>(`${this.config.baseUrl}cart/createCart`, body, {
        headers: this.appService.getHeaders(),
      })
      .pipe(
        catchError(this.handleError),
        switchMap(async (response) => {
          if (response.success) {
            await this.checkBranchStatus(response.data?.branchId, response.data?.serviceName);
            const _inst = new Invoice(); _inst.ParseJson(response.data); return _inst;
          }
          return null;
        }),
        // Convert to an observable
        switchMap(result => from(Promise.resolve(result)))
      );
  }

  createAppointmentCart(body: any): Observable<Invoice | null> {
    const url = `${this.config.baseUrl}cart/createCart`;
    return this.http
      .post<any>(url, body, {
        headers: this.appService.getHeaders(),
      })
      .pipe(
        map((response) => {
          if (response.success) {
            return response.data;
          }
          return [];
        }),
        catchError((error) => {
          this.logger.error(error, { context: 'CartService.createAppointmentCart' });
          throw new Error('Failed to load services');
        })
      );
  }

  getCart(sessionId: string): Observable<Invoice | null> {
    // FIX (perf): no longer fires checkBranchStatus inline. Cart mutations
    // (addItem/removeItem/changeQty/changeService) now use the inline invoiceData
    // returned in their own response.data, so getCart is only called from
    // page-entry sites (app.component init, checkout). Those sites call
    // checkBranchStatus explicitly so we don't piggyback an extra request
    // through every cart fetch.
    return this.http
      .get<any>(`${this.config.baseUrl}cart/getCart/${sessionId}`, {
        headers: this.appService.getHeaders(),
      })
      .pipe(
        catchError(this.handleError),
        map((response) => {
          if (response.success) {
            const _inst = new Invoice(); _inst.ParseJson(response.data); return _inst;
          }
          return null;
        })
      );
  }

  /**
   * Shared helper invoked by every cart mutation. Stores the new invoiceData and
   * the sessionId/branchId into the BehaviorSubjects that header, cart
   * dropdown, etc. listen on. Centralised so all four mutation paths
   * stay consistent.
   */
  private applyCartUpdate(invoiceData: Invoice, fallbackSessionId: string): void {
    const resolvedSessionId = invoiceData.onlineData?.sessionId ?? fallbackSessionId;
    invoiceData.onlineData.sessionId = resolvedSessionId;
    this.setCartInvoiceData(invoiceData);
    // Keep localStorage in sync so a page refresh reads the same sessionId
    // the in-memory cartData$ is using. Without this, mutations that rotate
    // the sessionId (or any sessionId set by the backend) leave localStorage
    // pointing at a stale/missing Redis key, so the next page-entry getCart
    // returns null and createCartSession spins up an empty cart, which
    // ultimately causes "Cart is not created" at /cart/checkOut.
    if (typeof localStorage !== 'undefined' && resolvedSessionId) {
      localStorage.setItem('sessionId', resolvedSessionId);
    }
  }

  private invoiceData = new BehaviorSubject<Invoice>(new Invoice());
  invoiceDataSub$ = this.invoiceData.asObservable();
  setCartInvoiceData(data: Invoice): void {
    this.invoiceData.next(data);
  }

  /** Fallback: fetches cart by sessionId and pushes result into invoiceDataSub$. */
  private fetchAndUpdateCart(sessionId: string): Observable<Invoice | null> {
    return this.getCart(sessionId).pipe(
      tap((invoiceData) => {
        if (invoiceData) {
          this.applyCartUpdate(invoiceData, sessionId);
        }
      })
    );
  }

  checkBranchStatus(branchId: string, serviceName?: any) {

    return new Promise((resolve) => {
      if (branchId) {
        this.getBranchStatus(branchId).pipe(takeUntil(this.destroy$)).subscribe({
          next: (responseData: any) => {
            if (responseData) {
              this.appService.serviceName = serviceName || "";
              this.appService.deliveryStatus = responseData.deliveryStatus;
              this.appService.deliveryIsBusy = responseData.deliveryIsBusy;
              this.appService.pickUpStatus = responseData.pickUpStatus;
              this.appService.pickUpIsBusy = responseData.pickUpIsBusy;
              resolve(true);
            } else {
              resolve(false);
            }

          },
          error: (error) => {
            resolve(false);
          },
        });
      } else {
        resolve(false);
      }
    });
  }


  getBranchStatus(branchId: string): Observable<Invoice | null> {
    return this.http.get<any>(`${this.config.baseUrl}branch/getBranchStatus/${branchId}`, {
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


  addItemToCart(param: any): Observable<Invoice | null> {
    const sessionId = param?.sessionId;
    return this.http
      .post<any>(`${this.config.baseUrl}cart/addItem`, param, {
        headers: this.appService.getHeaders(),
      })
      .pipe(
        catchError(this.handleError),
        map((response) => {
          // FIX (perf): backend returns the updated cart inline. We use it
          // directly instead of firing a follow-up GET /cart/getCart, which
          // also pulled GET /branch/getBranchStatus — collapsing 3 requests
          // per cart action down to 1.
          if (response.success && response.data) {
            const invoiceData = new Invoice(); invoiceData.ParseJson(response.data);
            this.applyCartUpdate(invoiceData, sessionId);
            return invoiceData;
          }
          if (response.msg) {
            this.alertService.showAlert({ title: response.msg });
          }
          return null;
        })
      );
  }
   redeemCartCoupon(param: {
    couponId: string;
    sessionId: string;
  }): Observable<Invoice | null> {
    const { couponId, sessionId } = param;
    const body = {
      couponId,
      sessionId,
    };
    return this.http
      .post<any>(`${this.config.baseUrl}cart/redeemCartCoupon`, body, {
        headers: this.appService.getHeaders(),
      })
      .pipe(
        catchError(this.handleError),
        map((response) => {

          if (response.success) {
            const _inst = new Invoice(); _inst.ParseJson(response.data); return _inst;
          } else {
            if (response.msg) {
              this.alertService.showAlert({ title: response.msg });
            }
          }
          return null;
        }),
      );
  }
 
    unRedeemCartCoupon(param: {
    couponId: string;
    sessionId: string;
  }): Observable<Invoice | null> {
    const { couponId, sessionId } = param;
    const body = {
      couponId,
      sessionId,
    };
    return this.http
      .post<any>(`${this.config.baseUrl}cart/unRedeemCartCoupon`, body, {
        headers: this.appService.getHeaders(),
      })
      .pipe(
        catchError(this.handleError),
        map((response) => {

          if (response.success) {
            const _inst = new Invoice(); _inst.ParseJson(response.data); return _inst;
          } else {
            if (response.msg) {
              this.alertService.showAlert({ title: response.msg });
            }
          }
          return null;
        }),
      );
  }


  addItemToAppointmentCart(body: any): Observable<Invoice | null> {
    return this.http
      .post<any>(`${this.config.baseUrl}cart/addItem`, body, {
        headers: this.appService.getHeaders(),
      })
      .pipe(
        catchError(this.handleError),
        map((response) => {
          if (response.success) {
            const _inst = new Invoice(); _inst.ParseJson(response.data); return _inst;
          }
          return null;
        })
      );
  }

  removeItemFromCart(param: any): Observable<Invoice | null> {
    const sessionId = param?.sessionId;
    return this.http
      .post<any>(`${this.config.baseUrl}cart/removeItem`, param, {
        headers: this.appService.getHeaders(),
      })
      .pipe(
        catchError(this.handleError),
        map((response) => {
          // Inline cart from response — see addItemToCart for rationale.
          if (response.success && response.data) {
            const invoiceData = new Invoice(); invoiceData.ParseJson(response.data);
            this.applyCartUpdate(invoiceData, sessionId);
            return invoiceData;
          }
          return null;
        })
      );
  }

  changeItemQty(param: any): Observable<Invoice | null> {
    const sessionId = param?.sessionId;
    return this.http
      .post<any>(`${this.config.baseUrl}cart/changeItemQty`, param, {
        headers: this.appService.getHeaders(),
      })
      .pipe(
        catchError(this.handleError),
        map((response) => {
          // Inline cart from response — see addItemToCart for rationale.
          if (response.success && response.data) {
            const invoiceData = new Invoice(); invoiceData.ParseJson(response.data);
            this.applyCartUpdate(invoiceData, sessionId);
            return invoiceData;
          }
          if (response.msg && response.msg.includes('qty is not available')) {
            this.alertService.showAlert({ title: "No more quantity in the stock" });
          }
          return null;
        })
      );
  }

  getOrderData(sessionId: string): Observable<Order | null> {
    return this.http
      .get<any>(`${this.config.baseUrl}cart/getOrder/${sessionId}`, {
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

  /**
   * Fetches the latest driver location for the given order session.
   * Used by TrackOrderMapPopComponent on a 10s polling interval.
   *
   * Expected response shape (resilient to either shape):
   *   { success: true, data: { lng: number, lat: number, ... } }
   *   or { success: true, data: { longitude: number, latitude: number, ... } }
   *
   * Returns null when the backend reports no location (e.g. driver not
   * yet assigned) so the caller can keep polling without erroring out.
   */
  getDriverLocation(sessionId: string): Observable<{ lng: number; lat: number } | null> {
    return this.http
      .get<any>(`${this.config.baseUrl}cart/driverLocation/${sessionId}`, {
        headers: this.appService.getHeaders(),
      })
      .pipe(
        catchError(this.handleError),
        map((response) => {
          if (response?.success && response.data) {
            const d:any = response.data;
            const lng = d.location?.lng ?? d.location?.longitude;
            const lat = d.location?.lat ?? d.location?.latitude;
            if (typeof lng === 'number' && typeof lat === 'number') {
              return { lng, lat };
            }
          }
          return null;
        })
      );
  }

  getReservationData(sessionId: string): Observable<Reservation | null> {
    return this.http
      .get<any>(`${this.config.baseUrl}reservation/getReservation/${sessionId}`, {
        headers: this.appService.getHeaders(),
      })
      .pipe(
        catchError(this.handleError),
        map((response) => {
          if (response.success) {
            return response.data;
            // return Reservation.ParseJson(response.data);
          }
          return null;
        })
      );
  }

  private handleError = (error: any): Observable<never> => {
    this.logger.error(error, { context: 'CartService.handleError' });
    throw error; // or use a more appropriate error handling mechanism
  }

  changeService(body: any): Observable<Invoice | null> {
    return this.http
      .post<any>(`${this.config.baseUrl}cart/ChangeService`, body, {
        headers: this.appService.getHeaders(),
      })
      .pipe(
        catchError(this.handleError),
        // FIX (perf): use the inline cart from response.data — no follow-up
        // GET /cart/getCart needed. Branch status IS still refreshed here
        // because changing service is the one mutation where freshness of
        // the destination branch's open/busy state actually matters; that's
        // a single intentional GET /branch/getBranchStatus, not a per-cart-
        // action piggyback.
        switchMap(async (response) => {
          if (response.success && response.data) {
            const invoiceData = new Invoice(); invoiceData.ParseJson(response.data);
            const newSessionId = invoiceData.onlineData?.sessionId ?? body.sessionId;
            this.applyCartUpdate(invoiceData, newSessionId);
            await this.checkBranchStatus(invoiceData.branchId, invoiceData.serviceName);
            return invoiceData;
          }
          return null;
        })
      );
  }

  changeService2(body: any) {
    if (body.sessionId) {
      return new Promise(response => {
        this.changeService(body).pipe(takeUntil(this.destroy$)).subscribe({
          next: (responseData) => {
            if (responseData) {
              this.setCartInvoiceData(responseData as Invoice);
              response(true);
            } else {
              response(false);
            }
          }
        });
      })
    } else {

      return new Promise((resolve, reject) => {
        this.createCart({ serviceName: body.serviceName, sessionId: body.sessionId ?? undefined, userSessionId: body.userSessionId, tableName: body.tableName, tableId: body.tableId, branchId: body.branchId }).pipe(takeUntil(this.destroy$)).subscribe({
          next: (responseData: any) => {
            this.setCartInvoiceData(responseData);
            localStorage.removeItem('sessionId');
            localStorage.setItem('sessionId', responseData.onlineData.sessionId);
            resolve(true);
          },
          error: (err) => {
            this.logger.error(err, { context: 'CartService.changeService2.createCart' });
            reject(err);
          }
        });
      });
    }

  }


}