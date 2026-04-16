import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { isTokenExpired } from '../../features/login/utils/jwt.util';
import { getItemSync, setItemSync, removeItems } from '../../features/login/utils/storage.util';
import { getDeviceInfo } from '../../features/login/utils/device-info.util';
import { Employee, AuthResponse, Permission, Company } from './auth.models';
import { PermissionService } from './permission.service';
import { CompanyService } from './company.service';
import { PrivilegeService } from './privileges/privilege.service';

interface RefreshResponse {
  data: { accessToken: string };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http              = inject(HttpClient);
  private router            = inject(Router);
  private permissionService = inject(PermissionService);
  private companyService    = inject(CompanyService);
  private privilegeService  = inject(PrivilegeService);
  private readonly baseUrl  = environment.backendUrl;

  private currentEmployee$ = new BehaviorSubject<Employee | null>(this.getStoredEmployee());
  private currentToken$    = new BehaviorSubject<string | null>(this.getStoredToken());

  employee$: Observable<Employee | null> = this.currentEmployee$.asObservable();
  token$:    Observable<string | null>   = this.currentToken$.asObservable();

  isLoggingOut = false;

  constructor() {
    // On page reload, re-hydrate the privilege/permission services from the
    // stored employee. Without this, `storeSession` only fires at login time
    // and every permission check on a refreshed page returns false.
    const stored = this.currentEmployee$.value;
    if (stored) {
      this.permissionService.setPermissions((stored.permissions as Permission[]) ?? []);
      if ((stored as any)['privileges']) {
        this.privilegeService.setPrivileges((stored as any)['privileges']);
      }
    }
  }

  // ─── Getters ──────────────────────────────────────────────────────────────
  get currentEmployee(): Employee | null { return this.currentEmployee$.value; }
  get currentToken(): string | null      { return this.currentToken$.value; }

  // ─── Storage helpers ─────────────────────────────────────────────────────
  private getStoredEmployee(): Employee | null {
    try {
      const s = getItemSync<string>('employee', true);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }
  private getStoredToken(): string | null {
    try { return getItemSync<string>('authintication', true) || null; }
    catch { return null; }
  }

  // ─── Token accessors ─────────────────────────────────────────────────────
  getAccessToken(): string | null { return this.currentToken; }

  setAccessToken(token: string | null): void {
    setItemSync('authintication', token, true);
    this.currentToken$.next(token);
  }

  // ─── Login ────────────────────────────────────────────────────────────────
  async authenticate(email: string, password: string, rememberMe = false): Promise<AuthResponse> {
    const device = getDeviceInfo();
    return firstValueFrom(
      this.http.post<AuthResponse>(`${this.baseUrl}login`, { email, password, rememberMe, device }).pipe(
        map(response => {
          if (response?.data?.accessToken) this.storeSession(response);
          return response;
        }),
        catchError(error => { throw error; })
      )
    );
  }

  /** Stores token + employee and hydrates permission/feature services */
  storeSession(response: AuthResponse): void {
    const data     = response.data;
    const employee = Array.isArray(data.employee) ? data.employee[0] : data.employee;
    const token    = data.accessToken!;

    setItemSync('authintication', token, true);
    setItemSync('employee', JSON.stringify(employee), true);

    this.currentEmployee$.next(employee ?? null);
    this.currentToken$.next(token);

    this.permissionService.setPermissions((employee?.permissions as Permission[]) ?? []);

    // Hydrate privilege tree from employee.privileges
    if (employee?.['privileges']) {
      this.privilegeService.setPrivileges(employee['privileges']);
    }

    // Set company identity from login response (quick, before loadSettings resolves)
    const company: Company | null =
      data['company'] ?? employee?.['company'] ?? employee?.['currentCompany'] ?? null;
    if (company) this.companyService.setCurrentCompany(company);

    // Load full company settings in background — hydrates features[], settings, etc.
    // This is the authoritative source for features (not the login token)
    this.companyService.loadSettings();
  }

  /** Backward-compat alias — old login component calls this */
  storeAccessToken(data: any): void {
    this.storeSession({ success: true, data } as AuthResponse);
  }

  // ─── Terms & Conditions ───────────────────────────────────────────────────
  /**
   * Called after the server returns code: 'TERMS_REQUIRED'.
   * The pendingLoginToken is a short-lived JWT from the server.
   * On success, returns the normal login response with accessToken.
   */
  async acceptTermsAndConditions(pendingLoginToken: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(
        `${this.baseUrl}acceptTermAndConditions`,
        {},
        { headers: new HttpHeaders({ 'pending-token': pendingLoginToken }) }
      ).pipe(catchError(error => { throw error; }))
    );
  }

  // ─── 2FA ─────────────────────────────────────────────────────────────────
  async validate2FaCode(token: string, code: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}validate2FaCode`, { code },
        { headers: new HttpHeaders({ 'api-auth': token }) }
      ).pipe(catchError(error => Promise.resolve(error)))
    );
  }
  async validateOTP(token: string, OTP: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}validateOTP`, { OTP },
        { headers: new HttpHeaders({ 'api-auth': token }) }
      ).pipe(catchError(error => Promise.resolve(error)))
    );
  }
  async set2FA(token: string, apply2fa: any, code: any = null): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}set2FA`, { apply2fa, code },
        { headers: new HttpHeaders({ 'api-auth': token }) }
      ).pipe(catchError(error => { throw error; }))
    );
  }
  async reset2fa(token: string): Promise<any> {
    return firstValueFrom(
      this.http.get<any>(`${this.baseUrl}reset2fa`,
        { headers: new HttpHeaders({ 'api-auth': token }) }
      ).pipe(catchError(error => { throw error; }))
    );
  }

  // ─── Password reset ───────────────────────────────────────────────────────
  async resetPassword(email: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}resetPassword`, { email })
        .pipe(catchError(error => { throw error; }))
    );
  }
  async checkOTP(OTP: string, sessionId: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}checkOTP`, { sessionId, OTP })
        .pipe(catchError(error => { throw error; }))
    );
  }
  async setNewPassword(sessionId: string, OTP: string, password: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}setNewPassword`, { sessionId, OTP, password })
        .pipe(catchError(error => { throw error; }))
    );
  }

  // ─── Refresh token ────────────────────────────────────────────────────────
  refresh(): Observable<RefreshResponse> {
    return this.http
      .post<RefreshResponse>(`${this.baseUrl}refreshToken`, {}, { withCredentials: true })
      .pipe(tap(r => this.setAccessToken(r.data.accessToken)));
  }

  // ─── Session management ───────────────────────────────────────────────────
  async getSessionList(): Promise<any> {
    return firstValueFrom(
      this.http.get<any>(`${this.baseUrl}sessions/sessionList`)
        .pipe(map(r => r?.data ?? []), catchError(error => { throw error; }))
    );
  }
  async revokeSession(deviceId: string): Promise<any> {
    return firstValueFrom(
      this.http.put<any>(`${this.baseUrl}sessions/revokeSession/${deviceId}`, {})
        .pipe(catchError(error => { throw error; }))
    );
  }

  // ─── Logout ───────────────────────────────────────────────────────────────
  async logout(): Promise<void> {
    this.isLoggingOut = true;

    // Capture the current path BEFORE clearing state so we can restore it after re-login
    const currentPath = this.router.url;
    const isLoginPage = currentPath === '/login' || currentPath.startsWith('/login?');
    const returnUrl   = (!isLoginPage && currentPath && currentPath !== '/')
      ? encodeURIComponent(currentPath)
      : null;

    try {
      await firstValueFrom(
        this.http.put<any>(`${this.baseUrl}logout`, {}, { withCredentials: true }).pipe(
          catchError(error => {
            if (error?.status === 401) return of({ success: true }); // already expired
            throw error;
          })
        )
      );
    } catch {
      // swallow — still clear local state
    } finally {
      this.isLoggingOut = false;
      this.clearLocalSession();
      this.router.navigate(
        ['/login'],
        returnUrl ? { queryParams: { returnUrl } } : {}
      );
    }
  }

  private clearLocalSession(): void {
    removeItems('authintication', 'employee', 'selected-branch', 'company', 'dashboard_filter', 'company_settings');
    this.currentEmployee$.next(null);
    this.currentToken$.next(null);
    this.permissionService.clearPermissions();
    this.companyService.clearCompany();    // also clears features
    this.privilegeService.clearPrivileges();
  }

  // ─── Token check ─────────────────────────────────────────────────────────
  isAuthenticated(): boolean {
    return !isTokenExpired(getItemSync<string>('authintication', true) || null);
  }
}
