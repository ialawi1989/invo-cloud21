import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TenantService } from '../blog/services/tenant.service';
import { ShopperAuthService } from '../blog/services/shopper-auth.service';

interface Envelope<T> { success: boolean; msg: string; data: T; }

export interface CartLine {
  /** Line id — what add/remove/qty calls address, NOT the product id: the same
   *  product can appear twice with different options. */
  id:        string;
  productId: string;
  name:      string;
  qty:       number;
  unitPrice: number;
  total:     number;
  imageUrl:  string;
  note:      string;
}

export interface CartState {
  sessionId: string;
  lines:     CartLine[];
  subTotal:  number;
  tax:       number;
  delivery:  number;
  discount:  number;
  total:     number;
  currency:  string;
}

const EMPTY: CartState = {
  sessionId: '', lines: [], subTotal: 0, tax: 0,
  delivery: 0, discount: 0, total: 0, currency: '',
};

/**
 * The shopper's cart.
 *
 * Wraps the existing `ecommerce/:sub/cart/*` endpoints. The cart is keyed by a
 * SESSION, not by a logged-in user — an anonymous shopper has one too — so the
 * session id is kept here and mirrored into ShopperAuthService's storage, which
 * is where the rest of the storefront already looks for it.
 *
 * Every mutation returns the whole cart, so the state signal is replaced from
 * the server response rather than patched locally. Local arithmetic on prices
 * is how a total ends up disagreeing with the one the backend will charge.
 */
@Injectable({ providedIn: 'root' })
export class CartApiService {
  private http   = inject(HttpClient);
  private tenant = inject(TenantService);
  private auth   = inject(ShopperAuthService);

  private _state = signal<CartState>(EMPTY);
  state = this._state.asReadonly();

  private url(action: string): string {
    return `${environment.apiBase}/v1/ecommerce/${encodeURIComponent(this.tenant.slug())}/cart/${action}`;
  }

  private headers(): HttpHeaders {
    const sid = this.sessionId();
    return new HttpHeaders({
      'X-Sub-Domain': this.tenant.slug(),
      ...(sid ? { 'session-id': sid } : {}),
    });
  }

  private sessionId(): string {
    return this._state().sessionId || this.auth.sessionId() || '';
  }

  /** Load the cart for the current session. No session = an empty cart, not an
   *  error: a first-time visitor simply hasn't got one yet. */
  async load(): Promise<CartState> {
    const sid = this.sessionId();
    if (!sid) {
      this._state.set(EMPTY);
      return EMPTY;
    }

    try {
      const env = await firstValueFrom(
        this.http.get<Envelope<any>>(this.url(`getCart/${encodeURIComponent(sid)}`), {
          headers: this.headers(),
          withCredentials: true,
        }),
      );
      const state = this.normalise(env?.data, sid);
      this._state.set(state);
      return state;
    } catch {
      this._state.set({ ...EMPTY, sessionId: sid });
      return this._state();
    }
  }

  async changeQty(lineId: string, qty: number): Promise<CartState> {
    return this.mutate('changeItemQty', { sessionId: this.sessionId(), itemId: lineId, qty });
  }

  async remove(lineId: string): Promise<CartState> {
    return this.mutate('removeItem', { sessionId: this.sessionId(), itemId: lineId });
  }

  async clear(): Promise<CartState> {
    return this.mutate('clearCart', { sessionId: this.sessionId() });
  }

  private async mutate(action: string, body: Record<string, unknown>): Promise<CartState> {
    try {
      const env = await firstValueFrom(
        this.http.post<Envelope<any>>(this.url(action), body, {
          headers: this.headers(),
          withCredentials: true,
        }),
      );
      // Some cart actions answer with the cart, others with just a flag; re-read
      // when we can't tell, so the screen never shows a stale total.
      if (env?.data?.items || env?.data?.lines) {
        const state = this.normalise(env.data, this.sessionId());
        this._state.set(state);
        return state;
      }
      return this.load();
    } catch {
      return this.load();
    }
  }

  /**
   * Wire shape → what the page renders.
   *
   * The backend has carried several names for these over time (`items` vs
   * `lines`, `qty` vs `quantity`, `total` vs `grandTotal`), so each is read
   * defensively — a cart that renders a blank row or a zero total is worse than
   * one that guesses the right field.
   */
  private normalise(raw: any, sessionId: string): CartState {
    const src = raw ?? {};
    const rows: any[] = Array.isArray(src.items) ? src.items
      : Array.isArray(src.lines) ? src.lines
      : Array.isArray(src.invoiceItems) ? src.invoiceItems : [];

    const lines: CartLine[] = rows.map(r => ({
      id:        String(r?.id ?? r?.itemId ?? ''),
      productId: String(r?.productId ?? r?.product?.id ?? ''),
      name:      String(r?.name ?? r?.productName ?? r?.product?.name ?? ''),
      qty:       Number(r?.qty ?? r?.quantity ?? 1),
      unitPrice: Number(r?.price ?? r?.unitPrice ?? 0),
      total:     Number(r?.total ?? r?.lineTotal ?? (Number(r?.qty ?? 1) * Number(r?.price ?? 0))),
      imageUrl:  String(r?.mediaUrl?.defaultUrl ?? r?.mediaUrl ?? r?.image ?? ''),
      note:      String(r?.note ?? ''),
    }));

    return {
      sessionId: String(src.sessionId ?? sessionId),
      lines,
      subTotal:  Number(src.subTotal ?? src.subtotal ?? 0),
      tax:       Number(src.tax ?? src.taxAmount ?? 0),
      delivery:  Number(src.deliveryCharge ?? src.delivery ?? 0),
      discount:  Number(src.discount ?? src.discountAmount ?? 0),
      total:     Number(src.total ?? src.grandTotal ?? 0),
      currency:  String(src.currency ?? ''),
    };
  }
}
