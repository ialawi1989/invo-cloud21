import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  BehaviorSubject, Observable, Subscription, defer, firstValueFrom, catchError, finalize, map, of,
  shareReplay, switchMap, take, tap, throwError, timeout,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthTabSyncService } from './auth-tab-sync.service';
import { CrossTabRefreshLockService } from './cross-tab-refresh-lock.service';
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

/**
 * An access token with less than this many seconds left is treated as stale and refreshed BEFORE a
 * protected request is sent, so the request never goes out carrying a token that expires in flight.
 */
export const ACCESS_TOKEN_REFRESH_MARGIN_SECONDS = 30;

/** Name of the cross-tab Web Lock that serialises refresh requests. */
const REFRESH_WEB_LOCK_NAME = 'invo_auth_refresh';

/** Upper bound for ONE refresh HTTP request; a hung leader would otherwise hold the lock forever. */
const REFRESH_REQUEST_TIMEOUT_MS = 30000;

/**
 * True when a refresh failed for a reason that says nothing about the session: no connection, a
 * timeout, rate limiting, or a gateway/server fault. The refresh cookie may still be valid, so the
 * user must not be logged out for it. Anything else (401/403, success:false, malformed reply) means
 * the session is over.
 */
export function isTransientRefreshError(err: unknown): boolean {
  if (err instanceof HttpErrorResponse) {
    return err.status === 0 || err.status === 408 || err.status === 429 || err.status >= 500;
  }
  return (err as any)?.name === 'TimeoutError';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http              = inject(HttpClient);
  private router            = inject(Router);
  private permissionService = inject(PermissionService);
  private companyService    = inject(CompanyService);
  private privilegeService  = inject(PrivilegeService);
  private tabSync          = inject(AuthTabSyncService);
  private refreshLock       = inject(CrossTabRefreshLockService);
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
      this.privilegeService.setSuperAdmin(stored['superAdmin'] === true);
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

  /** When the privilege tree was last loaded (login or server refresh). */
  private privilegesLoadedAt = Date.now();

  /**
   * True when the loaded privileges are older than `maxAgeMs`. Time-limited
   * access grants expire server-side; this is how the portal notices.
   */
  privilegesStale(maxAgeMs = 60_000): boolean {
    return Date.now() - this.privilegesLoadedAt > maxAgeMs;
  }

  /**
   * Re-load the signed-in employee's privilege tree from the server, so a role
   * change or an approved access request applies without signing in again.
   * Returns true when a tree was applied. Failures are swallowed: the caller
   * keeps whatever privileges it already had.
   */
  async refreshPrivileges(): Promise<boolean> {
    try {
      const res = await firstValueFrom(this.http.get<any>(`${this.baseUrl}employee/getMyPrivileges`));
      const privileges = res?.data?.privileges;
      this.privilegesLoadedAt = Date.now(); // answered: do not re-ask every navigation
      // The login payload historically omitted these, so a session that was
      // already open (or an older backend) learns them here. Only ever applied
      // when the server actually sent them — absent must not demote anyone.
      const flags: Record<string, boolean> = {};
      if (typeof res?.data?.admin === 'boolean') flags['admin'] = res.data.admin;
      if (typeof res?.data?.superAdmin === 'boolean') flags['superAdmin'] = res.data.superAdmin;
      if (flags['superAdmin'] !== undefined) this.privilegeService.setSuperAdmin(flags['superAdmin']);
      if (!privileges) return false;
      this.privilegeService.setPrivileges(privileges);
      const stored = this.currentEmployee$.value;
      if (stored) {
        const next = { ...stored, ...flags, privileges } as Employee;
        setItemSync('employee', JSON.stringify(next), true);
        this.currentEmployee$.next(next);
      }
      return true;
    } catch {
      return false;
    }
  }

  /** Merges fields into the signed-in employee (e.g. a new picture or name) and keeps the stored copy in step. */
  patchEmployee(patch: Partial<Employee>): void {
    const stored = this.currentEmployee$.value;
    if (!stored) return;
    const next = { ...stored, ...patch } as Employee;
    setItemSync('employee', JSON.stringify(next), true);
    this.currentEmployee$.next(next);
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

    // A super admin is never subject to privilege checks, whatever tree came back.
    this.privilegeService.setSuperAdmin(employee?.['superAdmin'] === true);

    // Hydrate privilege tree from employee.privileges
    if (employee?.['privileges']) {
      this.privilegeService.setPrivileges(employee['privileges']);
      this.privilegesLoadedAt = Date.now();
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
      .pipe(tap(r => { if (r?.data?.accessToken) this.setAccessToken(r.data.accessToken); }));
  }

  private refreshInFlight$: Observable<string> | null = null;

  /** The last token this tab received from a refresh (see isUsable). */
  private lastRefreshedToken: string | null = null;

  /**
   * True when `token` can be sent now: unexpired and outside the refresh margin. A token we were JUST
   * issued is accepted while unexpired, otherwise a short-lived token (or a client clock ahead of the
   * server) would look stale right after a refresh and every request would refresh again.
   */
  private isUsable(token: string | null): token is string {
    if (!token) return false;
    if (isTokenExpired(token)) return false;
    if (token === this.lastRefreshedToken) return true;
    return !isTokenExpired(token, ACCESS_TOKEN_REFRESH_MARGIN_SECONDS);
  }

  /**
   * Re-reads the token from shared storage (another tab may have refreshed) and publishes it to
   * in-memory consumers if it changed. Storage is the source of truth across tabs.
   */
  private syncTokenFromStorage(): string | null {
    const stored = this.getStoredToken();
    if (stored !== this.currentToken$.value) this.currentToken$.next(stored);
    return stored;
  }

  /** Whether any access token is stored (re-read from shared storage). */
  hasStoredToken(): boolean {
    return !!this.syncTokenFromStorage();
  }

  /**
   * Resolves with an access token that is safe to send NOW, refreshing first when needed. Every
   * protected request goes through here: the HTTP interceptor and the route guard.
   *
   * `rejectedToken` is the token a request carried when the server answered 401. If storage already
   * holds a different, usable token (another request's refresh finished meanwhile) it is returned
   * and no second refresh is made.
   */
  getValidAccessToken(rejectedToken: string | null = null): Observable<string> {
    if (this.isLoggingOut) return throwError(() => new Error('Logging out'));

    const current = this.syncTokenFromStorage();
    if (this.isUsable(current) && current !== rejectedToken) return of(current);

    return this.getFreshAccessTokenCrossTab();
  }

  /**
   * The single place a refresh is performed. Within this tab every caller shares ONE observable
   * (one HTTP request however many callers arrive). Across tabs the refresh runs under an exclusive
   * Web Lock, and a tab that gets the lock after another tab refreshed uses that tab's token.
   */
  getFreshAccessTokenCrossTab(): Observable<string> {
    if (this.isLoggingOut) return throwError(() => new Error('Logging out'));
    if (this.refreshInFlight$) return this.refreshInFlight$;

    // What this tab held when it decided it needed a new token. If storage holds something else by
    // the time we own the lock, another tab already refreshed and we must not refresh again.
    const tokenBefore = this.currentToken$.value;

    const shared$: Observable<string> = defer(() => {
      if (this.isLoggingOut) return throwError(() => new Error('Logging out'));
      return this.withCrossTabLock(tokenBefore);
    }).pipe(
      finalize(() => {
        if (this.refreshInFlight$ === shared$) this.refreshInFlight$ = null;
        this.refreshLock.release();
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.refreshInFlight$ = shared$;
    return shared$;
  }

  /**
   * Runs the refresh as the only refresher across all tabs. Preferred: the Web Locks API, which the
   * browser releases the moment the holding tab finishes, closes or crashes (no TTL to guess).
   * Fallback (no Web Locks): the localStorage lease in CrossTabRefreshLockService.
   */
  private withCrossTabLock(tokenBefore: string | null): Observable<string> {
    const locks: any = typeof navigator !== 'undefined' ? (navigator as any).locks : null;

    if (!locks?.request) {
      if (this.refreshLock.tryAcquire(8000)) return this.refreshAsLeader();
      return this.waitForLeader();
    }

    return new Observable<string>((subscriber) => {
      const abort = new AbortController();
      let inner: Subscription | undefined;
      let releaseLock!: () => void;
      const held = new Promise<void>((resolve) => (releaseLock = resolve));

      locks
        .request(REFRESH_WEB_LOCK_NAME, { signal: abort.signal }, () => {
          // We own the refresh now. Another tab may have completed one while we queued: re-read
          // shared storage BEFORE touching the network.
          inner = defer(() => {
            if (this.isLoggingOut) return throwError(() => new Error('Logging out'));
            const stored = this.syncTokenFromStorage();
            if (stored && stored !== tokenBefore && this.isUsable(stored)) {
              this.lastRefreshedToken = stored;
              return of(stored);
            }
            return this.refreshAsLeader();
          }).subscribe({
            next: (v) => subscriber.next(v),
            error: (e) => { subscriber.error(e); releaseLock(); },
            complete: () => { subscriber.complete(); releaseLock(); },
          });
          return held;
        })
        .catch((e: any) => {
          if (e?.name !== 'AbortError') subscriber.error(e);
        });

      return () => {
        abort.abort();
        inner?.unsubscribe();
        releaseLock();
      };
    });
  }

  private refreshAsLeader(): Observable<string> {
    return this.refresh().pipe(
      timeout({ first: REFRESH_REQUEST_TIMEOUT_MS }),
      switchMap((r: any) => {
        if (r && r.success === false) return throwError(() => new Error('Session expired'));

        const newToken: string | undefined = r?.data?.accessToken;
        if (!newToken) return throwError(() => new Error('Refresh did not return accessToken'));

        this.lastRefreshedToken = newToken;
        this.tabSync.notifyAccessUpdated(newToken);
        return of(newToken);
      }),
    );
  }

  /** Fallback only (no Web Locks): another tab is refreshing; take its result from shared storage. */
  private waitForLeader(): Observable<string> {
    // The leader writes storage, broadcasts, and only then releases the lock, so it may already be
    // done: look before waiting for a broadcast that has already been sent.
    const already = this.syncTokenFromStorage();
    if (this.isUsable(already)) return of(already);

    return this.tabSync.accessUpdated$.pipe(
      take(1),
      timeout({ first: 8000 }),
      map((broadcastToken) => {
        const stored = this.syncTokenFromStorage();
        const token = this.isUsable(stored) ? stored : broadcastToken;
        this.lastRefreshedToken = token;
        return token;
      }),
      // The leader died or stalled and its lock expired: take over, unless a usable token appeared.
      catchError((err) => {
        const stored = this.syncTokenFromStorage();
        if (this.isUsable(stored)) return of(stored);
        if (this.refreshLock.tryAcquire(8000)) return this.refreshAsLeader();
        return throwError(() => err);
      }),
    );
  }

  /**
   * Guard-facing check: gives navigation the same chance as an API call to silently refresh first
   * (guards make no API call themselves, so they would bounce to /login the moment the short-lived
   * access token expired even though the refresh cookie was still valid).
   */
  async ensureValidSession(): Promise<boolean> {
    if (!this.syncTokenFromStorage()) return false;
    try {
      return !!(await firstValueFrom(this.getValidAccessToken()));
    } catch (err) {
      // No connection / timeout / gateway fault says nothing about the session: let the navigation
      // through rather than bouncing a signed-in user to /login.
      if (isTransientRefreshError(err)) return true;
      // Otherwise a failed refresh only ends the session if the token is really dead.
      return this.isAuthenticated();
    }
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
