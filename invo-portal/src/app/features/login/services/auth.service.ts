import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom, catchError, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { isTokenExpired, decodeToken } from '../utils/jwt.util';
import { getItemSync, setItemSync, removeItems } from '../utils/storage.util';

// ==================== Models ====================

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  companyId?: string;
  branchId?: string;
  permissions?: string[];
  [key: string]: any;
}

export interface AuthResponse {
  success: boolean;
  msg?: string;
  data: {
    accessToken?: string;
    temporaryAccessToken?: string;
    employee?: Employee | Employee[];
    apply2fa?: boolean;
    sessionId?: string;
    [key: string]: any;
  };
}

// ==================== Service ====================

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private baseUrl = `${environment.backendUrl}`;

  auth_token: string | null = null;
  employee: Employee | null = null;

  private currentEmployeeSubject = new BehaviorSubject<Employee | null>(this.getStoredEmployee());
  public currentEmployee$: Observable<Employee | null> = this.currentEmployeeSubject.asObservable();

  private currentTokenSubject = new BehaviorSubject<string | null>(this.getStoredToken());
  public currentToken$: Observable<string | null> = this.currentTokenSubject.asObservable();

  constructor() {
    this.auth_token = this.getStoredToken();
    this.employee = this.getStoredEmployee();
  }

  // ==================== Public Getters ====================

  get currentEmployeeValue(): Employee | null {
    return this.currentEmployeeSubject.value;
  }

  get currentTokenValue(): string | null {
    return this.currentTokenSubject.value;
  }

  // ==================== Storage Helpers ====================

  private getStoredEmployee(): Employee | null {
    try {
      const stored = getItemSync<string>('employee', true);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private getStoredToken(): string | null {
    try {
      return getItemSync<string>('authintication', true) || null;
    } catch {
      return null;
    }
  }

  // ==================== Authentication ====================

  async authenticate(email: string, password: string): Promise<AuthResponse> {
    return firstValueFrom(
      this.http.post<AuthResponse>(`${this.baseUrl}login`, { email, password }).pipe(
        map(response => {
          if (response?.data?.accessToken) {
            this.storeAccessToken(response.data);
          }
          return response;
        }),
        catchError(error => { throw error; })
      )
    );
  }

  storeAccessToken(response: any): void {
    const employee = Array.isArray(response.employee) && response.employee.length > 0
      ? response.employee[0]
      : response.employee;

    this.storeEmployeeData(response.accessToken, employee);
    this.auth_token = response.accessToken;
    this.currentEmployeeSubject.next(this.employee);
    this.currentTokenSubject.next(this.auth_token);
  }

  // ==================== 2FA ====================

  async validate2FaCode(temporaryAccessToken: string, code: string): Promise<any> {
    const headers = new HttpHeaders({ 'api-auth': temporaryAccessToken });
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}validate2FaCode`, { code }, { headers }).pipe(
        catchError(error => Promise.resolve(error))
      )
    );
  }

  async validateOTP(temporaryAccessToken: string, OTP: string): Promise<any> {
    const headers = new HttpHeaders({ 'api-auth': temporaryAccessToken });
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}validateOTP`, { OTP }, { headers }).pipe(
        catchError(error => Promise.resolve(error))
      )
    );
  }

  async set2FA(temporaryAccessToken: string, apply2fa: any, code: any = null): Promise<any> {
    const headers = new HttpHeaders({ 'api-auth': temporaryAccessToken });
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}set2FA`, { apply2fa, code }, { headers }).pipe(
        catchError(error => { throw error; })
      )
    );
  }

  async reset2fa(temporaryAccessToken: string): Promise<any> {
    const headers = new HttpHeaders({ 'api-auth': temporaryAccessToken });
    return firstValueFrom(
      this.http.get<any>(`${this.baseUrl}reset2fa`, { headers }).pipe(
        catchError(error => { throw error; })
      )
    );
  }

  // ==================== Password Reset ====================

  async resetPassword(email: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}resetPassword`, { email }).pipe(
        catchError(error => { throw error; })
      )
    );
  }

  async checkOTP(OTP: string, sessionId: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}checkOTP`, { sessionId, OTP }).pipe(
        catchError(error => { throw error; })
      )
    );
  }

  async setNewPassword(sessionId: string, OTP: string, password: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}setNewPassword`, { sessionId, OTP, password }).pipe(
        catchError(error => { throw error; })
      )
    );
  }

  // ==================== Token Check ====================

  async checkLoggedInToken(): Promise<boolean> {
    if (!this.auth_token || !this.isAuthenticated()) return false;
    const headers = new HttpHeaders({ 'api-auth': this.auth_token });
    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.baseUrl}/checkLoggedInToken`, { headers })
      );
      return response?.success ?? false;
    } catch {
      return false;
    }
  }

  // ==================== Logout ====================

  logout(): void {
    removeItems(
      'authintication',
      'employee',
      'selected-branch',
      'company',
      'dashboard_filter'
    );

    this.auth_token = null;
    this.employee = null;
    this.currentEmployeeSubject.next(null);
    this.currentTokenSubject.next(null);
  }

  // ==================== Helpers ====================

  isAuthenticated(): boolean {
    this.loadToken();
    return !isTokenExpired(this.auth_token);
  }

  storeEmployeeData(token: string, employee: any): void {
    setItemSync('authintication', token, true);
    setItemSync('employee', JSON.stringify(employee), true);
    this.auth_token = token;
    this.employee = employee;
  }

  loadToken(): void {
    this.auth_token = getItemSync<string>('authintication', true) || null;
  }

  loggedIn(): string | false {
    const token = getItemSync<string>('authintication', true);
    return token || false;
  }
}