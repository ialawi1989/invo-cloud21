import { Injectable } from '@angular/core';

/**
 * Prevents multiple tabs from simultaneously calling /refreshToken.
 *
 * Uses localStorage as a mutex (the lowest common denominator for
 * cross-tab synchronisation that works without a service worker).
 *
 * How it works:
 *  - tryAcquire() writes a timestamped lock key if no lock exists.
 *    Returns true  → this tab is the "leader" and should call refresh.
 *    Returns false → another tab already holds the lock; wait on
 *                    AuthTabSyncService.accessUpdated$ instead.
 *  - release() removes the lock key so other tabs can acquire it next time.
 *  - A TTL (default 8 s) prevents a crashed tab from permanently
 *    blocking token refresh.
 */
@Injectable({ providedIn: 'root' })
export class CrossTabRefreshLockService {
  private readonly LOCK_KEY = 'invo_refresh_lock';

  /**
   * Attempt to acquire the refresh lock.
   * @param ttlMs  Lock time-to-live in ms (default 8000).
   * @returns true if this tab now holds the lock, false otherwise.
   */
  tryAcquire(ttlMs = 8000): boolean {
    const existing = localStorage.getItem(this.LOCK_KEY);

    if (existing) {
      const expiresAt = Number(existing);
      if (Date.now() < expiresAt) {
        // Lock is live — another tab is refreshing
        return false;
      }
      // Lock expired (tab crashed) — take it over
    }

    localStorage.setItem(this.LOCK_KEY, String(Date.now() + ttlMs));
    return true;
  }

  /** Release the lock after a successful (or failed) refresh. */
  release(): void {
    localStorage.removeItem(this.LOCK_KEY);
  }
}
