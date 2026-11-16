import {
  HttpInterceptorFn, HttpRequest, HttpHandlerFn,
  HttpEvent, HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService, isTransientRefreshError } from '../auth/auth.service';
import { AuthTabSyncService } from '../auth/auth-tab-sync.service';
import { CrossTabRefreshLockService } from '../auth/cross-tab-refresh-lock.service';
import { ModalService } from '../../shared/modal/modal.service';
import { SessionExpiredModalComponent } from '../auth/session-expired-modal.component';

// ─── Module-level singletons (shared across all interceptor calls) ────────────
// Using module scope instead of service state keeps the functional interceptor
// stateful without introducing an extra service.

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

/**
 * Pages that render without a session (shared e-invoice payment / signature links). A failed refresh
 * there must not pop the "Session Expired" dialog over the invoice or redirect to /login. Read from
 * location rather than router.url so it is answerable before the first navigation settles.
 */
const PUBLIC_PAGES = /^\/(einvoice|invoiceSign)\//i;

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
  const request = req.clone({ withCredentials: true });

  // Pass through public endpoints and refresh calls without any token logic
  if (isPublicCall(request.url))       return next(request);
  if (request.headers.has('api-auth')) return next(request);
  if (isRefreshCall(request.url))      return next(request);

  // Logout: send token + cookie but never retry on 401 — session is being torn down
  if (isLogoutCall(request.url)) {
    const t = auth.getAccessToken();
    return next(t ? withAuth(request, t) : request);
  }

  // Skip retry logic for any other call during logout flow
  if (auth.isLoggingOut) {
    const t = auth.getAccessToken();
    return next(t ? withAuth(request, t) : request);
  }

  const onRefreshFailed = (err: unknown): void => {
    if (auth.isLoggingOut) return;
    // A lost connection / timeout / gateway fault says nothing about the session: fail this request only.
    if (isTransientRefreshError(err)) return;
    handleSessionExpired(auth, tabSync, lock, router, modal);
  };

  /** Dispatches one request with `token`; on a 401 it is retried AT MOST ONCE with a newer token. */
  const send = (token: string | null): Observable<HttpEvent<any>> => {
    const prepared = token ? withAuth(request, token) : request;

    return next(prepared).pipe(
      catchError((err: unknown) => {
        if (!(err instanceof HttpErrorResponse) || err.status !== 401 || auth.isLoggingOut) {
          return throwError(() => err);
        }

        // A FormData body cannot be replayed (the first attempt already consumed its stream, so the
        // retry would reach the API empty and report success while saving nothing). Refresh the token
        // so the session stays usable, then surface the original 401; the user repeats the upload.
        if (request.body instanceof FormData) {
          return auth.getValidAccessToken(token).pipe(
            switchMap(() => throwError(() => err)),
            catchError((refreshErr) => {
              if (refreshErr === err) return throwError(() => err);
              onRefreshFailed(refreshErr);
              return throwError(() => refreshErr);
            }),
          );
        }

        // Returns an already-stored newer token without a second refresh, else joins the single
        // shared refresh.
        return auth.getValidAccessToken(token).pipe(
          catchError((refreshErr) => {
            onRefreshFailed(refreshErr);
            return throwError(() => refreshErr);
          }),
          switchMap((newToken) =>
            // The only retry. A 401 here means the session really is over.
            next(withAuth(request, newToken)).pipe(
              catchError((retryErr) => {
                if (retryErr instanceof HttpErrorResponse && retryErr.status === 401 && !auth.isLoggingOut) {
                  handleSessionExpired(auth, tabSync, lock, router, modal);
                }
                return throwError(() => retryErr);
              }),
            ),
          ),
        );
      }),
    );
  };

  // No stored session at all: send as-is (a 401 still gets one refresh attempt via the cookie).
  if (!auth.hasStoredToken()) return send(null);

  // Wait for a usable token BEFORE dispatching: if the stored one is expired or inside the refresh
  // margin this performs (or joins) the single shared refresh, so a request never goes out stale.
  return auth.getValidAccessToken().pipe(
    catchError((refreshErr) => {
      onRefreshFailed(refreshErr);
      return throwError(() => refreshErr);
    }),
    switchMap((token) => send(token)),
  );
};

// ─── Session-expired handler ──────────────────────────────────────────────────

function handleSessionExpired(
  auth:    AuthService,
  tabSync: AuthTabSyncService,
  lock:    CrossTabRefreshLockService,
  router:  Router,
  modal:   ModalService,
): void {
  if (auth.isLoggingOut) return;
  if (PUBLIC_PAGES.test(window.location.pathname)) return;

  // Latch first: every request waiting on the same failed refresh lands here, only the first may
  // log out / show the dialog.
  if (sessionExpiredShown) return;
  sessionExpiredShown = true;

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
