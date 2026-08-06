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

/**
 * Where the cart session id lives between page views.
 *
 * Must stay `sessionId` — the key NewWebsite uses — so a shopper who has a cart
 * on the old storefront still has it after cutover. It does not collide with
 * the shopper session, which lives under `shopperSession` here (and `auth` in
 * NewWebsite); the two are different values and always were.
 */
const CART_SESSION_KEY = 'sessionId';

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

  /**
   * Forget the cart session.
   *
   * Checkout DESTROYS the Redis cart — `getCart` on a checked-out session
   * answers `success:false / "cart not created"`. Holding on to that id would
   * make every later `addItem` reuse a dead session and fail forever, so the
   * shopper could never start a second order. Clearing it means the next add
   * mints a fresh cart, which is what a returning shopper expects.
   */
  clearSession(): void {
    this._state.set(EMPTY);
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      window.localStorage.removeItem(CART_SESSION_KEY);
    } catch { /* storage disabled — nothing to forget */ }
  }

  /** Persist the cart session id minted by createCart / addItem. */
  setSessionId(sessionId: string): void {
    this._state.update(s => ({ ...s, sessionId }));
    this.persistSessionId(sessionId);
  }

  /** Storage half of setSessionId, without touching state — used from
   *  normalise(), which is building the new state itself. */
  private persistSessionId(sessionId: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      window.localStorage.setItem(CART_SESSION_KEY, sessionId);
    } catch { /* storage disabled — the cart lives for this page view only */ }
  }

  /**
   * The cart session id, creating the cart first if this visitor hasn't got one.
   *
   * `addItem` validates `sessionId` as a UUID, so there is no "add and let the
   * server create it" path — the cart has to exist first. `createCart` mints the
   * GUID and returns it at `onlineData.sessionId`.
   */
  private async ensureSession(): Promise<string> {
    const existing = this.sessionId();
    if (existing) return existing;

    const env = await firstValueFrom(
      this.http.post<Envelope<any>>(this.url('createCart'), {}, {
        headers: this.headers(),
        withCredentials: true,
      }),
    );
    const sid = String(env?.data?.onlineData?.sessionId ?? '');
    if (!sid) throw new Error(env?.msg || 'Could not start a cart');
    this.setSessionId(sid);
    return sid;
  }

  /**
   * Add a product to the cart.
   *
   * `options` / `selectedItems` carry variant and package choices; a product
   * with required option groups will be rejected by the server if they're
   * missing, and that message is passed back rather than swallowed — there is
   * no option picker in this storefront yet.
   */
  async addItem(
    productId: string,
    qty = 1,
    extras: { options?: unknown[]; selectedItems?: unknown[]; note?: string; menuId?: string } = {},
  ): Promise<{ ok: boolean; msg?: string }> {
    try {
      const sessionId = await this.ensureSession();
      const env = await firstValueFrom(
        this.http.post<Envelope<any>>(this.url('addItem'), {
          sessionId,
          productId,
          qty,
          ...extras,
        }, { headers: this.headers(), withCredentials: true }),
      );

      if (Array.isArray(env?.data?.lines)) {
        this._state.set(this.normalise(env.data, sessionId));
      } else {
        await this.load();
      }
      if (env?.success === false) return { ok: false, msg: env?.msg };
      return { ok: true };
    } catch (e: any) {
      // Out of stock, max-qty-per-ticket and missing-options all arrive here
      // with a message worth showing.
      const errs = e?.error?.errors;
      return {
        ok: false,
        msg: Array.isArray(errs) ? errs.map((x: any) => x?.msg).filter(Boolean).join(', ')
          : (e?.error?.msg ?? e?.message ?? 'Could not add to cart'),
      };
    }
  }

  /** Total item count, for a header badge. */
  count(): number {
    return this._state().lines.reduce((n, l) => n + l.qty, 0);
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
      // A session that no longer has a cart behind it — the usual cause is that
      // it was checked out, which deletes it. Forget it, or every later add
      // reuses a dead id and the shopper can never start a second order.
      if (env?.success === false || !env?.data) {
        this.clearSession();
        return EMPTY;
      }
      const state = this.normalise(env.data, sid);
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

    // The session id can ROTATE. createCart mints a fresh GUID whenever the
    // service, branch or table changes, and the new one only ever comes back
    // on the response. Keeping the old one leaves us pointing at a Redis key
    // that no longer exists — the cart reads as empty and checkout fails with
    // "Cart is not created". So the response always wins.
    const live = String(src?.onlineData?.sessionId || sessionId || '');
    if (live && live !== sessionId) this.persistSessionId(live);

    return {
      sessionId: live,
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
