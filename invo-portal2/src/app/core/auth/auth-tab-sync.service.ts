import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';

/**
 * Cross-tab coordination via BroadcastChannel.
 *
 * When tab A successfully refreshes the access token it calls
 * accessUpdated(newToken) — every other tab waiting on accessUpdated$
 * receives it and retries their failed request without hitting the
 * refresh endpoint again.
 *
 * When any tab logs out it calls logout() so all other tabs navigate
 * to /login automatically.
 */
@Injectable({ providedIn: 'root' })
export class AuthTabSyncService implements OnDestroy {
  private readonly CHANNEL_NAME = 'invo_auth_sync';
  private channel: BroadcastChannel | null = null;

  private accessUpdated = new Subject<string>();
  private logoutEvent   = new Subject<void>();

  /** Emit here when another tab broadcasts a fresh access token. */
  readonly accessUpdated$: Observable<string> = this.accessUpdated.asObservable();

  /** Emit here when another tab broadcasts a logout. */
  readonly logout$: Observable<void> = this.logoutEvent.asObservable();

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(this.CHANNEL_NAME);
      this.channel.onmessage = (event) => this.handleMessage(event.data);
    }
  }

  ngOnDestroy(): void {
    this.channel?.close();
  }

  /** Broadcast a newly obtained access token to all other tabs. */
  notifyAccessUpdated(token: string): void {
    this.channel?.postMessage({ type: 'ACCESS_UPDATED', token });
  }

  /** Broadcast a logout event to all other tabs. */
  notifyLogout(): void {
    this.channel?.postMessage({ type: 'LOGOUT' });
  }

  private handleMessage(data: { type: string; token?: string }): void {
    if (data.type === 'ACCESS_UPDATED' && data.token) {
      this.accessUpdated.next(data.token);
    } else if (data.type === 'LOGOUT') {
      this.logoutEvent.next();
    }
  }
}
