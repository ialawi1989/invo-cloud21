import {
  HttpInterceptorFn, HttpRequest, HttpHandlerFn,
  HttpEvent, HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError, defer, of } from 'rxjs';
import { catchError, finalize, switchMap, take, timeout } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { AuthTabSyncService } from '../auth/auth-tab-sync.service';
import { CrossTabRefreshLockService } from '../auth/cross-tab-refresh-lock.service';
import { ModalService } from '../../shared/modal/modal.service';
import { SessionExpiredModalComponent } from '../auth/session-expired-modal.component';

// ─── Module-level singletons (shared across all interceptor calls) ────────────
// Using module scope instead of service state keeps the functional interceptor
// stateful without introducing an extra service.

let refreshInFlight$: Observable<string> | null = null;
let sessionExpiredShown = false;

// Public paths that never need an access token
const PUBLIC_PATHS = [
  '/login', '/resetPassword', '/checkOTP',
  '/setNewPassword', '/acceptTermAndConditions',
];

// Logout needs withCredentials (for the refresh cookie) AND api-auth header —
// so it is NOT in PUBLIC_PATHS. We let it fall through the normal token-attach
// flow, but we never retry it on 401 (session is already gone).
const LOGOUT_PATHS = ['/logout'];

function isPublicCall(url: string): boolean {
  return PUBLIC_PATHS.some(p => url.includes(p));
}
function isLogoutCall(url: string): boolean {
  return LOGOUT_PATHS.some(p => url.includes(p));
}
function isRefreshCall(url: string): boolean {
  return url.includes('/refreshToken') || url.includes('/refresh-token');
}
function withAuth(req: HttpRequest<any>, token: string): HttpRequest<any> {
  return req.clone({ setHeaders: { 'api-auth': token } });
}

// ─── Main interceptor ─────────────────────────────────────────────────────────

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn,
): Observable<HttpEvent<any>> => {

  const auth    = inject(AuthService);
  const tabSync = inject(AuthTabSyncService);
  const lock    = inject(CrossTabRefreshLockService);
  const router  = inject(Router);
  const modal   = inject(ModalService);

  // Always send cookies for refresh-token flow
  let request = req.clone({ withCredentials: true });

  // Pass through public endpoints and refresh calls without any token logic
  if (isPublicCall(request.url))       return next(request);
  if (request.headers.has('api-auth')) return next(request);
  if (isRefreshCall(request.url))      return next(request);

  // Attach current access token to ALL authenticated calls (including logout)
  const token = auth.getAccessToken();
  if (token) request = withAuth(request, token);

  // Logout: send token + cookie but never retry on 401 — session is being torn down
  if (isLogoutCall(request.url)) return next(request);

  // Skip retry logic for any other call during logout flow
  if (auth.isLoggingOut) return next(request);

  return next(request).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);
      if (err.status !== 401)                  return throwError(() => err);
      if (auth.isLoggingOut)                   return throwError(() => err);

      // ── 401 → try to silently refresh ──────────────────────────────────
      return getFreshToken(auth, tabSync, lock).pipe(
        switchMap((newToken) => {
          auth.setAccessToken(newToken);

          const retried = withAuth(req.clone({ withCredentials: true }), newToken);
          return next(retried);
        }),
        catchError((refreshErr) => {
          if (auth.isLoggingOut) return throwError(() => refreshErr);
          handleSessionExpired(auth, tabSync, lock, router, modal);
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};

// ─── Cross-tab token refresh ──────────────────────────────────────────────────

function getFreshToken(
  auth:    AuthService,
  tabSync: AuthTabSyncService,
  lock:    CrossTabRefreshLockService,
): Observable<string> {

  if (auth.isLoggingOut) return throwError(() => new Error('Logging out'));

  // Another call already started a refresh in this tab — share it
  if (refreshInFlight$) return refreshInFlight$;

  const isLeader = lock.tryAcquire(8000);

  if (!isLeader) {
    // This tab lost the election — wait for the leader tab to broadcast
    return tabSync.accessUpdated$.pipe(
      take(1),
      timeout({ first: 8000 }),
    );
  }

  // This tab won the election — do the actual refresh
  refreshInFlight$ = defer(() => {
    if (auth.isLoggingOut) return throwError(() => new Error('Logging out'));
    return auth.refresh();
  }).pipe(
    switchMap((r: any) => {
      if (r?.success === false)
        return throwError(() => new Error('Session expired'));

      const newToken: string | undefined = r?.data?.accessToken;
      if (!newToken)
        return throwError(() => new Error('Refresh did not return accessToken'));

      // Broadcast to every other open tab
      tabSync.notifyAccessUpdated(newToken);
      return of(newToken);
    }),
    finalize(() => {
      refreshInFlight$ = null;
      lock.release();
    }),
  );

  return refreshInFlight$;
}

// ─── Session-expired handler ──────────────────────────────────────────────────

function handleSessionExpired(
  auth:    AuthService,
  tabSync: AuthTabSyncService,
  lock:    CrossTabRefreshLockService,
  router:  Router,
  modal:   ModalService,
): void {
  if (auth.isLoggingOut) return;

  refreshInFlight$ = null;
  lock.release();

  // Capture current path before clearing state
  const currentPath = router.url;
  const isLoginPage = currentPath === '/login' || currentPath.startsWith('/login?');
  const returnUrl   = (!isLoginPage && currentPath && currentPath !== '/')
    ? encodeURIComponent(currentPath)
    : null;

  // Tell other tabs to also logout
  tabSync.notifyLogout();
  auth.logout();

  if (sessionExpiredShown) return;
  sessionExpiredShown = true;

  // Styled in-app modal (replaces the native browser alert). The modal
  // renders a single OK button — close handler routes to /login.
  const ref = modal.open<SessionExpiredModalComponent, void, void>(
    SessionExpiredModalComponent,
    {
      size: 'sm',
      closeable: false,
      closeOnBackdrop: false,
      panelClass: 'session-expired-modal',
    },
  );

  ref.afterClosed().then(() => {
    sessionExpiredShown = false;
    router.navigate(
      ['/login'],
      returnUrl ? { queryParams: { returnUrl } } : {}
    );
  });
}
