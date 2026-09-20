import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/http';

/**
 * Narrow shape actually returned by `accounts/getOnlineInvoices` — verified
 * against `InvoiceRepo.getOnlineInvoicesList` (InvoCloudBack). Deliberately
 * NOT the full legacy `OnlineInvoice` model, which has fields (paidAmount,
 * balance, isPaid, …) this endpoint's SQL never actually selects.
 */
export interface PendingOrderLine {
  lineId: string;
  productType?: 'serialized' | 'batch' | string;
}

export interface PendingOrder {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  branchId: string;
  branchName: string;
  employeeName: string | null;
  total: number;
  status: string;
  createdAt: string;
  /** Present only when the invoice has serialized/batch lines needing selection before Accept. */
  lines?: PendingOrderLine[];
}

const SOUND_PREF_KEY = 'notif.soundEnabled';

/**
 * Pending online orders (status 'Placed') — backs the topbar notification
 * bell. Root-provided so the badge count on the bell button and the drawer
 * content share one source of truth without prop-drilling.
 */
@Injectable({ providedIn: 'root' })
export class PendingOrdersService {
  private api = inject(ApiService);

  readonly orders = signal<PendingOrder[]>([]);
  readonly count = signal(0);
  readonly loading = signal(false);
  readonly loaded = signal(false);

  readonly soundEnabled = signal(this.readSoundPref());

  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private audio: HTMLAudioElement | null = null;

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.request<{ list: PendingOrder[] }>(
        this.api.post('accounts/getOnlineInvoices', {
          page: 1,
          limit: 50,
          status: 'Placed',
          filter: { branches: [] },
        }),
      );
      const list = res?.data?.list ?? [];
      const hadOrders = this.orders().length > 0;
      this.orders.set(list);
      this.count.set(list.length);
      if (this.soundEnabled() && list.length > 0 && !hadOrders) this.playChime();
    } catch {
      // Keep whatever was loaded before — a transient failure shouldn't blank the bell.
    } finally {
      this.loading.set(false);
      this.loaded.set(true);
    }
  }

  /** Accept/reject a simple order. Orders with serialized/batch lines are handled by the caller (navigate to the invoice instead). */
  async updateStatus(order: PendingOrder, status: 'Accepted' | 'Rejected'): Promise<boolean> {
    const res = await this.api.request<any>(
      this.api.post('accounts/updateInvoiceStatus', {
        invoiceId: order.id,
        branchId: order.branchId,
        status,
        rejectReason: '',
      }),
    );
    if (res?.success !== false) {
      await this.load();
      return true;
    }
    return false;
  }

  toggleSound(): void {
    const next = !this.soundEnabled();
    this.soundEnabled.set(next);
    try { localStorage.setItem(SOUND_PREF_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  startPolling(intervalMs = 30_000): void {
    this.stopPolling();
    this.pollHandle = setInterval(() => this.load(), intervalMs);
  }

  stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private readSoundPref(): boolean {
    try {
      const raw = localStorage.getItem(SOUND_PREF_KEY);
      return raw != null ? JSON.parse(raw) : false;
    } catch {
      return false;
    }
  }

  private playChime(): void {
    if (!this.audio) {
      this.audio = new Audio('assets/audio/notification.wav');
    }
    this.audio.currentTime = 0;
    this.audio.play().catch(() => { /* autoplay may be blocked until first user interaction */ });
  }
}
