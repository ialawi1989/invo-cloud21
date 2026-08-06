import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TenantService } from '../blog/services/tenant.service';
import { ShopperAuthService } from '../blog/services/shopper-auth.service';

interface Envelope<T> { success: boolean; msg: string; data: T; }

/** Exactly the columns `getShopperOrdersHistory` selects — nothing more is
 *  available without a second call to `shopper/order/:orderId`. */
export interface AccountOrder {
  id:          string;
  reference:   string;
  status:      string;
  total:       number;
  createdAt:   string;
  serviceName: string;
}

export interface AccountProfile {
  name:   string;
  email:  string;
  mobile: string;
}

/**
 * Shopper-facing account data.
 *
 * Uses the existing `ecommerce/:sub/shopper/*` endpoints. The session comes
 * from {@link ShopperAuthService}, which the storefront already maintains — no
 * second auth mechanism is introduced here.
 */
@Injectable({ providedIn: 'root' })
export class AccountApiService {
  private http   = inject(HttpClient);
  private tenant = inject(TenantService);
  private auth   = inject(ShopperAuthService);

  private url(action: string): string {
    return `${environment.apiBase}/v1/ecommerce/${encodeURIComponent(this.tenant.slug())}/shopper/${action}`;
  }

  private headers(): HttpHeaders {
    const sid = this.auth.sessionId();
    return new HttpHeaders({
      'X-Sub-Domain': this.tenant.slug(),
      ...(sid ? { 'session-id': sid } : {}),
    });
  }

  private async post<T>(action: string, body: Record<string, unknown> = {}): Promise<T | null> {
    try {
      const env = await firstValueFrom(
        this.http.post<Envelope<T>>(this.url(action), body, {
          headers: this.headers(),
          withCredentials: true,
        }),
      );
      return env?.success ? env.data : null;
    } catch {
      return null;
    }
  }

  /**
   * Past orders for the signed-in shopper.
   *
   * Answers `{hasNext, list}`. The shopper is identified from the session on
   * the server side, so `sessionId` in the body is ignored — it is the
   * `session-id` header that matters.
   *
   * Note the server's own paging quirk: it fetches `limit + 1` rows to decide
   * `hasNext` and slices back down, so `list.length` is the real page size.
   */
  async orders(page = 1, limit = 20): Promise<{ list: AccountOrder[]; hasNext: boolean }> {
    const data = await this.post<any>('orderHistory', { page, limit });
    const rows: any[] = Array.isArray(data?.list) ? data.list : [];
    return {
      hasNext: !!data?.hasNext,
      list: rows.map(o => ({
        id:          String(o?.id ?? ''),
        // Blank until the store accepts the order — the number is issued by
        // InvoiceRepo.saveOpenInvoice, not at placement. The id is not a
        // substitute; it's a UUID the shopper can do nothing with.
        reference:   String(o?.invoiceNumber ?? ''),
        // Selected as `onlineData->>'onlineStatus'`, so it can legitimately be null.
        status:      String(o?.status ?? ''),
        total:       Number(o?.total ?? 0),
        createdAt:   String(o?.createdAt ?? ''),
        serviceName: String(o?.serviceName ?? ''),
      })),
    };
  }

  /**
   * Profile of the signed-in shopper.
   *
   * Returns the Shopper record, whose phone field is `phone` — there is no
   * `mobile` or `phoneNumber` on it.
   */
  async profile(): Promise<AccountProfile | null> {
    const data = await this.post<any>('getLoggedInUser', {});
    if (!data) return null;
    return {
      name:   String(data?.name ?? ''),
      email:  String(data?.email ?? ''),
      mobile: String(data?.phone ?? ''),
    };
  }
}
