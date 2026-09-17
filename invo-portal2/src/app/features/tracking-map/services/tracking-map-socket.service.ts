import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Observable, share } from 'rxjs';
import { Socket, io } from 'socket.io-client';
import { environment } from '../../../../environments/environment';
import { AuthService } from '@core/auth/auth.service';
import {
  RawDeliveryOrderStatusUpdate,
  RawDriverLocationUpdate,
  RawDriverShiftStatusUpdate,
} from './tracking-map.types';

const SOCKET_NAMESPACE = '/tracking';

/**
 * Wraps the `/tracking` socket.io namespace.
 *
 * Verified against InvoCloudBack (`src/socket.ts`, `registerTrackingNamespace`):
 * the namespace is scoped **per company**, not per branch — the server joins
 * every authenticated client to room `tracking:<companyId>` and never reads a
 * `branchId` query param. Branch-level filtering therefore happens entirely
 * client-side (see `TrackingMapService`), and one socket connection covers
 * every branch — no reconnect-on-branch-change logic needed here.
 */
@Injectable({ providedIn: 'root' })
export class TrackingMapSocketService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;

  /** True once the underlying socket.io transport is connected — surface as a "live" indicator. */
  readonly connected = signal(false);
  readonly lastConnectionError = signal<string | null>(null);

  onDriverLocationUpdate(): Observable<RawDriverLocationUpdate> {
    return this.listen<RawDriverLocationUpdate>('newLoction');
  }

  onDriverShiftStatusUpdate(): Observable<RawDriverShiftStatusUpdate> {
    return this.listen<RawDriverShiftStatusUpdate>('driverShiftStatus');
  }

  onDeliveryOrderStatusUpdate(): Observable<RawDeliveryOrderStatusUpdate> {
    return this.listen<RawDeliveryOrderStatusUpdate>('deliveryOrderStatus');
  }

  connect(): Socket {
    if (this.socket) {
      if (!this.socket.connected) this.socket.connect();
      return this.socket;
    }

    this.socket = io(`${environment.socketUrl}${SOCKET_NAMESPACE}`, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      auth: { token: this.auth.getAccessToken() ?? '' },
    });

    this.socket.on('connect', () => {
      this.connected.set(true);
      this.lastConnectionError.set(null);
    });
    this.socket.on('disconnect', () => this.connected.set(false));
    this.socket.on('connect_error', (err: Error) => this.lastConnectionError.set(err.message));

    return this.socket;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.connected.set(false);
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  /**
   * Wraps `socket.on(event, ...)` as a shared Observable. The server sends
   * `JSON.stringify(payload)` — a STRING — so every handler JSON.parses it.
   */
  private listen<T>(event: string): Observable<T> {
    return new Observable<T>(subscriber => {
      const socket = this.connect();
      const handler = (payload: string | T) => {
        try {
          subscriber.next(typeof payload === 'string' ? (JSON.parse(payload) as T) : payload);
        } catch (err) {
          console.error(`[tracking-map] failed to parse "${event}" payload`, payload, err);
        }
      };
      socket.on(event, handler);
      return () => socket.off(event, handler);
    }).pipe(share());
  }
}
