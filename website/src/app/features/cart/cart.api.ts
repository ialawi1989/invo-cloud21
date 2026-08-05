import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TenantService } from '../blog/services/tenant.service';
import { ShopperAuthService } from '../blog/services/shopper-auth.service';

interface Envelope<T> { success: boolean; msg: string; data: T; }

export interface CartLine {
  /** `InvoiceLine.id`. This is what the cart endpoints call `transactionId`,
   *  and it is NOT the product id: the same product can appear on several
   *  lines with different options. */
  id:        string;
  productId: string;
  name:      string;
  qty:       number;
  unitPrice: number;
  total:     number;
  imageUrl:  string;
  note:      string;
  /** Package / menu-selection children, shown indented under the parent. */
  subItems:  { id: string; name: string; qty: number }[];
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

/** Where the cart session id lives between page views. */
const CART_SESSION_KEY = 'cartSession';

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
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

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

  /**
   * The CART session id.
   *
   * This is NOT the shopper session. `createCart` mints its own GUID and keeps
   * it at `cart.onlineData.sessionId`; the shopper session travels separately
   * as `userSessionId` (the `session-id` header) and is only used to resolve
   * who the shopper is for coupons and checkout. Falling back to the shopper
   * session here asks Redis for a cart under a key that was never written, and
   * the page shows an empty cart forever instead of an error.
   *
   * Whatever adds the first item is responsible for storing the id it gets
   * back — see {@link setSessionId}.
   */
  private sessionId(): string {
    if (this._state().sessionId) return this._state().sessionId;
    if (!isPlatformBrowser(this.platformId)) return '';
    try {
      return window.localStorage.getItem(CART_SESSION_KEY) ?? '';
    } catch {
      return '';
    }
  }

  /** Persist the cart session id minted by createCart / addItem. */
  setSessionId(sessionId: string): void {
    this._state.update(s => ({ ...s, sessionId }));
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      window.localStorage.setItem(CART_SESSION_KEY, sessionId);
    } catch { /* storage disabled — the cart lives for this page view only */ }
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

  /**
   * The API names the line id `transactionId`, and its validator requires it to
   * be a UUID — sending `itemId` fails validation before the cart is ever read.
   */
  async changeQty(lineId: string, qty: number): Promise<CartState> {
    return this.mutate('changeItemQty', { sessionId: this.sessionId(), transactionId: lineId, qty });
  }

  async remove(lineId: string): Promise<CartState> {
    return this.mutate('removeItem', { sessionId: this.sessionId(), transactionId: lineId });
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
      // Every cart action answers with the whole Invoice, but a validation
      // failure answers with something else entirely — re-read rather than
      // leave a stale total on screen.
      if (Array.isArray(env?.data?.lines)) {
        const state = this.normalise(env.data, this.sessionId());
        this._state.set(state);
        return state;
      }
      return this.load();
    } catch {
      return this.load();
    }
  }

  /** Translated product name, falling back to the untranslated one. */
  private lineName(r: any): string {
    const lang = this.lang();
    return String(r?.translation?.name?.[lang] || r?.productName || '');
  }

  private lang(): string {
    const first = this.router.url.split('?')[0].split('/').filter(Boolean)[0] ?? '';
    return first && first.length <= 5 ? first : 'en';
  }

  /**
   * Wire shape → what the page renders.
   *
   * The cart IS an `Invoice` (src/models/account/Invoice.ts): items live on
   * `lines` as `InvoiceLine`, and the totals carry accounting names —
   * `invoiceTaxTotal`, `deliveryCharge`, `discountTotal` — not the generic ones
   * a cart API would suggest. These are read straight rather than defensively:
   * a guessed alias that silently yields 0 hides a broken total, and the model
   * is right here to check against.
   */
  private normalise(raw: any, sessionId: string): CartState {
    const src = raw ?? {};
    const rows: any[] = Array.isArray(src.lines) ? src.lines : [];

    const lines: CartLine[] = rows
      // Package/menu children are attached to their parent below, and voided
      // lines are history rather than something the shopper still pays for.
      .filter(r => !r?.parentId && !r?.isVoided)
      .map(r => ({
        id:        String(r?.id ?? ''),
        productId: String(r?.productId ?? ''),
        name:      this.lineName(r),
        qty:       Number(r?.qty ?? 0),
        unitPrice: Number(r?.price ?? 0),
        total:     Number(r?.total ?? 0),
        imageUrl:  String(r?.mediaUrl ?? ''),
        note:      String(r?.note ?? ''),
        subItems:  (Array.isArray(r?.subItems) ? r.subItems : []).map((s: any) => ({
          id:   String(s?.id ?? ''),
          name: this.lineName(s),
          qty:  Number(s?.qty ?? 0),
        })),
      }));

    return {
      sessionId: String(sessionId),
      lines,
      subTotal:  Number(src.subTotal ?? 0),
      tax:       Number(src.invoiceTaxTotal ?? 0),
      delivery:  Number(src.deliveryCharge ?? 0),
      discount:  Number(src.discountTotal ?? 0),
      total:     Number(src.total ?? 0),
      // The Invoice carries no currency; the storefront formats with the site's.
      currency:  '',
    };
  }
}
