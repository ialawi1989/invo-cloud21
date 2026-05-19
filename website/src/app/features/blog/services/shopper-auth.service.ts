import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { CurrentShopper } from '../models/blog.types';

/**
 * Shopper auth surface for the public blog.
 *
 * The public blog migration ONLY covers `/v1/ecommerce/blog/*` — the
 * shopper login / register / `me` endpoints aren't part of that
 * contract. So this service no longer issues network calls of its
 * own; it's a thin observable wrapper around three pieces of state
 * that the host shopper-auth flow is expected to push in:
 *
 *   • `current` — the logged-in shopper (null when anonymous).
 *   • `sessionId` — the token to send on comment-write calls as
 *     `X-Shopper-Session` and as `userSessionId` in the request
 *     body.
 *   • `loaded` — flips true once the shell has had a chance to
 *     hydrate from cookies / storage.
 *
 * On the browser tick we hydrate from `localStorage` keys
 * (`shopperSession` + `shopperProfile`). The shopper login UI is
 * responsible for setting / clearing those keys; if your shell
 * keeps the session elsewhere, call `setSession()` from your auth
 * boundary instead and ignore the storage layer.
 */
@Injectable({ providedIn: 'root' })
export class ShopperAuthService {
  private platformId = inject(PLATFORM_ID);

  private _current   = signal<CurrentShopper | null>(null);
  private _sessionId = signal<string | null>(null);
  private _loaded    = signal<boolean>(false);

  current   = this._current.asReadonly();
  sessionId = this._sessionId.asReadonly();
  loaded    = this._loaded.asReadonly();

  private readonly SESSION_KEY = 'shopperSession';
  private readonly PROFILE_KEY = 'shopperProfile';

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const sid = window.localStorage.getItem(this.SESSION_KEY);
        const raw = window.localStorage.getItem(this.PROFILE_KEY);
        if (sid) this._sessionId.set(sid);
        if (raw) this._current.set(JSON.parse(raw) as CurrentShopper);
      } catch {
        // localStorage disabled / SSR / corrupt JSON — anonymous visitor.
      }
      this._loaded.set(true);
    }
  }

  /** Push a fresh session in from the shopper login flow.
   *  Pass null to clear (sign-out). */
  setSession(shopper: CurrentShopper | null, sessionId: string | null): void {
    this._current.set(shopper);
    this._sessionId.set(sessionId);
    this._loaded.set(true);
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      if (shopper && sessionId) {
        window.localStorage.setItem(this.SESSION_KEY, sessionId);
        window.localStorage.setItem(this.PROFILE_KEY, JSON.stringify(shopper));
      } else {
        window.localStorage.removeItem(this.SESSION_KEY);
        window.localStorage.removeItem(this.PROFILE_KEY);
      }
    } catch { /* ignore quota / disabled storage */ }
  }

  /** Convenience for the UI when the user clicks "sign out" inside
   *  the blog. The actual logout HTTP call (if any) is the shell's
   *  responsibility — see the README for why this module no longer
   *  owns shopper-auth endpoints. */
  clear(): void { this.setSession(null, null); }
}
