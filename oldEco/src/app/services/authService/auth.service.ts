import { HttpClient, HttpHeaders } from "@angular/common/http";
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Injectable, Injector, inject } from "@angular/core";
import { Observable, map, catchError } from "rxjs";
import { AppConfigService } from "../app-config.service";

import ls from 'localstorage-slim';
import { JwtHelperService } from "@auth0/angular-jwt";
import { AlertService } from "../alertService/alert.service";
import { LoadingService } from "../loadingService/loading.service";
import { Router } from "@angular/router";
import { Shopper } from "src/app/models/shopper.module";
import { AppServices } from "../appServices";
import { LoggerService } from "../logger/logger.service";
import { ModalService } from "../modal.service";
import { ConfirmModalComponent } from "src/app/components/confirm-modal/confirm-modal.component";

// Order-related interfaces
export interface Order {
  id: string;
  orderNumber: string;
  invoiceNumber?: string;
  date: string;
  createdAt: string;
  total: number;
  status: string;
  onlineData?: any;
  items: OrderItem[];
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface OrderHistoryResponse {
  orders: Order[];
  hasNext: boolean;
  currentPage: number;
  totalPages: number;
}

@Injectable({
  providedIn: 'root',
})

export class AuthService {

  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);
  auth_token: any;
  private loginSubject = new BehaviorSubject<boolean>(false);
  loginState$ = this.loginSubject.asObservable();
  private phoneVerificationSubject = new BehaviorSubject<any>({
    show: false,
    phoneCode: null,
    phoneNumber: null
  });
  phoneVerificationState$ = this.phoneVerificationSubject.asObservable();
  private emailVerificationSubject = new BehaviorSubject<any>({
    show: false,
    email: ""
  });
  emailVerificationState$ = this.emailVerificationSubject.asObservable();

  public currentToken!: Observable<string>;
  public currentTokenSubject!: BehaviorSubject<string>;

  constructor(
    private http: HttpClient,
    private config: AppConfigService,
    private alertService: AlertService,
    private loadingService: LoadingService,
    private router: Router,
    private injector: Injector,
    private modalService: ModalService
  ) {
    this.currentTokenSubject = new BehaviorSubject<string>(
      ls.get('userAuth', { decrypt: true }) as string
    );
    this.currentToken = this.currentTokenSubject.asObservable();
  }

  // Lazy getter for AppServices to avoid circular dependency
  private getAppService(): AppServices {
    return this.injector.get(AppServices);
  }

  checkLoggedIn() {
    this.auth_token = ls.get('userAuth', { decrypt: true }) as string ?? "";
    setTimeout(() => {
      if (this.auth_token && !this.getAppService().windowLocationReload) {
        this.getLoggedInUser();
      }
    }, 175);
  }

  public get currentTokenValue(): string {
    return this.currentTokenSubject.value;
  }

  storeAccessToken(response: any) {
    ls.set("userAuth", response.data.accessToken, { encrypt: true });
    this.auth_token = response.data.accessToken;
    this.currentTokenSubject.next(this.auth_token);
  }

  async loadToken() {
    const token = ls.get("userAuth", { decrypt: true });
    this.auth_token = token;
  }

  isCustomerAuthenticated() {
    this.loadToken();
    let jwtHelper: JwtHelperService = new JwtHelperService();
    return !jwtHelper.isTokenExpired(this.auth_token);
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

  showLogin() {
    this.loginSubject.next(true);
    document.body.style.overflow = 'hidden';
  }

  hideLogin() {
    this.loginSubject.next(false);
    document.body.style.overflow = 'auto';
  }

  showPhoneVerification(phoneCode?: any, phoneNumber?: any) {
    this.phoneVerificationSubject.next({
      show: true,
      phoneCode: phoneCode || null,
      phoneNumber: phoneNumber || null
    });
    document.body.style.overflow = 'hidden';
  }

  showEmailVerification(email?: any) {
    this.emailVerificationSubject.next({
      show: true,
      email: email || null,
    });
    document.body.style.overflow = 'hidden';
  }

  hidePhoneVerification() {
    this.phoneVerificationSubject.next({
      show: false,
      phoneCode: null,
      phoneNumber: null,
    });
    document.body.style.overflow = 'auto';
  }

  hideEmailVerification() {
    this.emailVerificationSubject.next({
      show: false,
      email: null,
    });
    document.body.style.overflow = 'auto';
  }

  verificationResult = new Subject<boolean>();
  onVerificationCompleted(isVerified: boolean): void {
    if (isVerified) {
      this.verificationResult.next(true);
    } else {
      this.verificationResult.next(false);
    }
  }

  loginWithOtp(body: any): Observable<any> {
    const url = `${this.config.baseUrl}shop/loginWithOtp`;
    return this.http
      .post<any>(url, body, {
        headers: this.getHeaders(),
      })
      .pipe(
        map((response) => {
          if (response.success) {
            return response.data;
          } else {
            this.alertService.showAlert({ title: response.msg });
          }
        }),
        catchError((error) => {
          this.logger.error(error, { context: 'AuthService.loginWithOtp' });
          throw new Error('Failed to load login response');
        })
      );
  }

  checkOTP(body: any): Observable<any> {
    return this.http
      .post<any>(`${this.config.baseUrl}shop/checkOTP`, body, {
        headers: this.getHeaders(),
      })
      .pipe(
        map((response) => {
          return response;
        }),
        catchError((error) => {
          this.logger.error(error, { context: 'AuthService.checkOTP' });
          throw new Error('Failed to load checkOTP response');
        })
      );
  }

  async getLoggedInUser(): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(
          `${this.config.baseUrl}shopper/getLoggedInUser/`,
          {},
          { headers: this.getHeaders() }
        )
        .pipe()
        .subscribe(
          {
            next: (responseData: any) => {
              if (responseData.success) {
                if (responseData.data) {
                  this.setUserData(responseData.data);
                  resolve(responseData.data);
                } else {
                  ls.remove('userAuth');
                  resolve(false);
                }
              } else {
                // this.alertService.showAlert({ title: response.msg });
                ls.remove('userAuth');
                resolve(false);
              }
            },
            error: (error) => {
              if (error.status == 401) {
                resolve(false);
              }
            }
          }
        );
    });
  }

  /**
   * Get user's compare list from server
   */
  async getUserCompareList(): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .get(
          `${this.config.baseUrl}shopper/compare-list/`,
          { headers: this.getHeaders() }
        )
        .pipe()
        .subscribe(
          {
            next: (responseData: any) => { },
            error: (error) => {
              if (error.status == 401) {
                resolve(false);
              }
            }
          }
        );
    });
  }

  /**
   * Save user's complete compare list to server
   */
  async saveUserCompareList(compareItems: any[]): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(
          `${this.config.baseUrl}shopper/save-compare-list/`,
          compareItems,
          { headers: this.getHeaders() }
        )
        .pipe()
        .subscribe(
          {
            next: (responseData: any) => { },
            error: (error) => {
              if (error.status == 401) {
                resolve(false);
              }
            }
          }
        );
    });
  }

  /**
   * Add single product to user's compare list
   */
  async addToUserCompareList(compareItem: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(
          `${this.config.baseUrl}shopper/save-compare-list/`,
          compareItem,
          { headers: this.getHeaders() }
        )
        .pipe()
        .subscribe(
          {
            next: (responseData: any) => { },
            error: (error) => {
              if (error.status == 401) {
                resolve(false);
              }
            }
          }
        );
    });
  }

  /**
   * Remove single product from user's compare list
   */
  async removeFromUserCompareList(compareItem: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(
          `${this.config.baseUrl}shopper/remove-compare-list/`,
          compareItem,
          { headers: this.getHeaders() }
        )
        .pipe()
        .subscribe(
          {
            next: (responseData: any) => { },
            error: (error) => {
              if (error.status == 401) {
                resolve(false);
              }
            }
          }
        );
    });
  }

  /**
   * Clear user's entire compare list
   */
  async clearUserCompareList(compareItem: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(
          `${this.config.baseUrl}shopper/remove-compare-list/`,
          compareItem,
          { headers: this.getHeaders() }
        )
        .pipe()
        .subscribe(
          {
            next: (responseData: any) => { },
            error: (error) => {
              if (error.status == 401) {
                resolve(false);
              }
            }
          }
        );
    });
  }

  /**
   * Get compare statistics (for analytics)
   */
  async getCompareStatistics(compareItem: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(
          `${this.config.baseUrl}shopper/compare-statistics`,
          compareItem,
          { headers: this.getHeaders() }
        )
        .pipe()
        .subscribe(
          {
            next: (responseData: any) => { },
            error: (error) => {
              if (error.status == 401) {
                resolve(false);
              }
            }
          }
        );
    });
  }

  signUp(body: any): Observable<any> {
    const url = `${this.config.baseUrl}shopper/signUp`;
    return this.http
      .post<any>(url, body, {
        headers: this.getHeaders(),
      })
      .pipe(
        map((response) => {
          return response;
        }),
        catchError((error) => {
          this.logger.error(error, { context: 'AuthService.signUp' });
          throw new Error('Failed to load response');
        })
      );
  }

  login(body: any): Observable<any> {
    const url = `${this.config.baseUrl}shopper/logIn`;
    return this.http
      .post<any>(url, body, {
        headers: this.getHeaders(),
      })
      .pipe(
        map((response) => {
          return response;
        }),
        catchError((error) => {
          this.logger.error(error, { context: 'AuthService.login' });
          throw new Error('Failed to load response');
        })
      );
  }

  updateShopper(body: any): Observable<any> {
    const url = `${this.config.baseUrl}shopper/updateShopper`;
    return this.http
      .post<any>(url, body, {
        headers: this.getHeaders(),
      })
      .pipe(
        map((response) => {
          return response.data;
        }),
        catchError((error) => {
          this.logger.error(error, { context: 'AuthService.updateShopper' });
          throw new Error('Failed to load response');
        })
      );
  }

  /**
   * Update shopper phone or email after OTP verification.
   * Only the sessionId is sent — the server resolves the new value from the session.
   * POST shopper/updateShopperEmailPhone
   * Body: { sessionId }
   */
  updateShopperEmailPhone(sessionId: string): Observable<any> {
    const url = `${this.config.baseUrl}shopper/updateShopperEmailPhone`;
    return this.http
      .post<any>(url, { sessionId }, {
        headers: this.getHeaders(),
      })
      .pipe(
        map((response) => {
          return response.data ?? response;
        }),
        catchError((error) => {
          this.logger.error(error, { context: 'AuthService.updateShopperEmailPhone' });
          throw error;
        })
      );
  }

  /**
   * Change password using current (old) password + new password.
   * POST shopper/setPassword
   * Body: { oldPassword: string, password: string }
   */
  setPassword(oldPassword: string, password: string): Observable<any> {
    const url = `${this.config.baseUrl}shopper/setPassword`;
    return this.http
      .post<any>(url, { oldPassword, password }, {
        headers: this.getHeaders(),
      })
      .pipe(
        map((response) => {
          return response;
        }),
        catchError((error) => {
          this.logger.error(error, { context: 'AuthService.setPassword' });
          throw error;
        })
      );
  }

  getOtp(body: any): Observable<any> {
    const url = `${this.config.baseUrl}shopper/getOTP`;
    return this.http
      .post<any>(url, body, {
        headers: this.getHeaders(),
      })
      .pipe(
        map((response) => {
          return response;
        }),
        catchError((error) => {
          this.logger.error(error, { context: 'AuthService.getOtp' });
          throw new Error('Failed to load response');
        })
      );
  }

  validateOtp(body: any): Observable<any> {
    const url = `${this.config.baseUrl}shopper/validateOtp`;
    return this.http
      .post<any>(url, body, {
        headers: this.getHeaders(),
      })
      .pipe(
        map((response) => {
          return response;
        }),
        catchError((error) => {
          this.logger.error(error, { context: 'AuthService.validateOtp' });
          throw new Error('Failed to load response');
        })
      );
  }

  resetPassword(body: any): Observable<any> {
    const url = `${this.config.baseUrl}shopper/resetPassword`;
    return this.http
      .post<any>(url, body, {
        headers: this.getHeaders(),
      })
      .pipe(
        map((response) => {
          return response;
        }),
        catchError((error) => {
          this.logger.error(error, { context: 'AuthService.resetPassword' });
          throw new Error('Failed to load response');
        })
      );
  }

  logout(): Observable<any> {
    const url = `${this.config.baseUrl}shopper/logOut`;
    return this.http
      .post<any>(url, {
        headers: this.getHeaders(),
      })
      .pipe(
        map((response) => {
          if (response.success) {
            return response;
          } else {
            this.alertService.showAlert({ title: response.msg });
          }
        }),
        catchError((error) => {
          this.logger.error(error, { context: 'AuthService.logout' });
          throw new Error('Failed to load response');
        })
      );
  }

  confLogout() {
    const modalRef = this.modalService.openWithData(
      ConfirmModalComponent,
      { title: "Are you sure you want to logout ?" },
      { centered: true, windowClass: "app-confirm-modal" }
    );
    modalRef.result.then((confirmed: boolean) => {
      if (confirmed) {
        this.loadingService.showLoadingSpinner()
        setTimeout(() => {
          this.logout().pipe(takeUntil(this.destroy$)).subscribe({
            next: (responseData: any) => {
              this.loadingService.hideLoadingSpinner();
              if (responseData.success) {
                let data: any = {};
                this.setUserData(data);
                ls.remove("userAuth");
                this.auth_token = null;
                this.getAppService().auth_token = '';
                window.location.reload();
              } else {
                this.alertService.showAlert({ title: responseData.msg });
              }
            },
            error: (err: any) => {
              this.loadingService.hideLoadingSpinner();
              this.logger.error(err, { context: 'AuthService.confLogout' });
            },
          });
        }, 250);
      }
    }).catch(() => {
      // Modal was dismissed (ESC / backdrop / back button) — treat as cancel.
    });
  }

  // ==================== ORDER HISTORY METHODS ====================

  /**
   * Fetch order history with pagination
   * @param page - Page number (1-indexed)
   * @param limit - Number of orders per page (default: 10)
   */
  getOrderHistory(page: number = 1, limit: number = 10): Observable<OrderHistoryResponse> {
    const url = `${this.config.baseUrl}shopper/orderHistory`;
    const body = { page, limit };

    return this.http.post<any>(url, body, {
      headers: this.getHeaders()
    }).pipe(
      map((response) => {
        if (response.success) {
          return {
            orders: response.data.list || [],
            hasNext: response.data.hasNext || false,
            currentPage: response.data.currentPage || page,
            totalPages: response.data.totalPages || 1
          };
        } else {
          console.warn('Order history fetch failed:', response.msg);
          return {
            orders: [],
            hasNext: false,
            currentPage: 0,
            totalPages: 0
          };
        }
      }),
      catchError((error) => {
        this.logger.error(error, { context: 'AuthService.getOrderHistory' });
        throw error;
      })
    );
  }

  /**
   * Fetch specific order details by ID
   * @param orderId - The order ID to fetch
   */
  getOrderById(orderId: string): Observable<Order> {
    const url = `${this.config.baseUrl}shopper/order/${orderId}`;
    return this.http.get<any>(url, {
      headers: this.getHeaders()
    }).pipe(
      map((response) => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.msg || 'Failed to load order');
        }
      }),
      catchError((error) => {
        this.logger.error(error, { context: 'AuthService.getOrderById' });
        throw error;
      })
    );
  }

  private userDataSubject = new BehaviorSubject<Shopper | null>(null);
  userData$ = this.userDataSubject.asObservable();

  setUserData(user: Shopper): void {
    this.userDataSubject.next(user);
  }
}