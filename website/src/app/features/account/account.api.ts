import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TenantService } from '../blog/services/tenant.service';
import { ShopperAuthService } from '../blog/services/shopper-auth.service';

interface Envelope<T> { success: boolean; msg: string; data: T; }

export interface AccountOrder {
  id:        string;
  reference: string;
  status:    string;
  total:     number;
  createdAt: string;
  itemCount: number;
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

  /** Past orders for the signed-in shopper. */
  async orders(page = 1, limit = 20): Promise<AccountOrder[]> {
    const data = await this.post<any>('orderHistory', {
      page, limit, sessionId: this.auth.sessionId(),
    });
    const list: any[] = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
    return list.map(o => ({
      id:        String(o?.id ?? ''),
      // The backend has used several names for the human-facing number over
      // time; take whichever is present rather than showing a blank row.
      reference: String(o?.reference ?? o?.invoiceNumber ?? o?.orderNumber ?? o?.id ?? ''),
      status:    String(o?.status ?? o?.orderStatus ?? ''),
      total:     Number(o?.total ?? o?.grandTotal ?? 0),
      createdAt: String(o?.createdAt ?? o?.date ?? ''),
      itemCount: Number(o?.itemCount ?? o?.items?.length ?? 0),
    }));
  }

  /** Profile of the signed-in shopper, refreshed from the server. */
  async profile(): Promise<AccountProfile | null> {
    const data = await this.post<any>('getLoggedInUser', { sessionId: this.auth.sessionId() });
    if (!data) return null;
    return {
      name:   String(data?.name ?? data?.fullName ?? ''),
      email:  String(data?.email ?? ''),
      mobile: String(data?.mobile ?? data?.phoneNumber ?? ''),
    };
  }
}
