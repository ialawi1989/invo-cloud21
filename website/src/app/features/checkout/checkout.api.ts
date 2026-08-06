import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TenantService } from '../blog/services/tenant.service';
import { ShopperAuthService } from '../blog/services/shopper-auth.service';
import { CartApiService } from '../cart/cart.api';

interface Envelope<T> { success: boolean; msg: string; data: T; }

export interface CheckoutBranch {
  id:   string;
  name: string;
}

export interface CheckoutService {
  id:   string;
  /** `Delivery` | `PickUp` | `DineIn` | `Salon` | `Shipping`. */
  name: string;
}

export interface PlacedOrder {
  id:          string;
  reference:   string;
  total:       number;
  status:      string;
  serviceName: string;
}

/**
 * The v1 payment method.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COUPLED BY STRING to `CartRepo.checkOut` in InvoCloudBack, which branches on
 * `data.payment.name === "Cash"` to skip the payment gateway entirely and mark
 * the order Placed. It is a literal comparison, NOT a lookup against the
 * merchant's PaymentMethods rows — a merchant with no "Cash" method configured
 * still checks out fine, because `getPaymentMethodSettings` returns undefined
 * and the result is only dereferenced on the non-Cash branch.
 *
 * Do not "normalise" this string — no casing change, no trim, no rename, no
 * moving it behind a lookup — without changing the backend comparison in the
 * same commit. Every order placed by this storefront goes through it, and a
 * mismatch would route cash orders into the gateway path and fail them all
 * with no obvious cause.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const CASH_PAYMENT_NAME = 'Cash';

export interface PlaceOrderRequest {
  branchId:    string;
  serviceName: string;
  name:        string;
  phone:       string;
  note?:       string;
}

/**
 * Checkout — cash / pay-later only.
 *
 * No gateway is wired: the six the backend supports (AFS, CrediMax, Benefit,
 * Thawani, Tap, Gatee) are all redirect-and-callback flows and are explicitly
 * out of scope for v1.
 *
 * The order is placed by `cart/checkOut`, which for cash answers with an EMPTY
 * array — it only returns payment data, and cash creates none. The confirmation
 * therefore comes from `cart/getOrder/:sessionId`, which resolves the invoice
 * via `onlineData->>'sessionId'`. Reading the order back also proves it exists
 * rather than trusting a bare success flag.
 */
@Injectable({ providedIn: 'root' })
export class CheckoutApiService {
  private http   = inject(HttpClient);
  private tenant = inject(TenantService);
  private auth   = inject(ShopperAuthService);
  private cart   = inject(CartApiService);

  private url(scope: string, action: string): string {
    return `${environment.apiBase}/v1/ecommerce/${encodeURIComponent(this.tenant.slug())}/${scope}/${action}`;
  }

  private headers(): HttpHeaders {
    const sid = this.auth.sessionId();
    return new HttpHeaders({
      'X-Sub-Domain': this.tenant.slug(),
      ...(sid ? { 'session-id': sid } : {}),
    });
  }

  /** Branches that can take an order — already filtered server-side to live
   *  subscriptions with `onlineAvailability = true`. */
  async branches(): Promise<CheckoutBranch[]> {
    try {
      const env = await firstValueFrom(
        this.http.get<Envelope<any>>(this.url('branch', 'getBranchList'), { headers: this.headers() }),
      );
      const list: any[] = Array.isArray(env?.data) ? env.data : (env?.data?.list ?? []);
      return list.map(b => ({ id: String(b?.id ?? ''), name: String(b?.name ?? '') })).filter(b => b.id);
    } catch {
      return [];
    }
  }

  /**
   * Services this storefront cannot complete an order for yet.
   *
   * Each needs a whole input surface v1 does not have, and every one of them
   * fails at the LAST step — after the shopper has filled the form — so they
   * are hidden rather than offered and then refused:
   *
   *   DineIn   — `checkOut` throws "Table selection is required for DineIn
   *              service"; there is no table picker.
   *   Delivery — `ChangeService` resolves the delivery branch from lat/long +
   *              addressKey, and `checkOut` rejects anything not inside the
   *              branch's covered areas with "Invalid delivery address". That
   *              needs an address form with geolocation. Note every branch on
   *              the reference merchant currently has ZERO covered addresses,
   *              so delivery could not be completed there in any case.
   *   Shipping — same address requirement, plus shipping-rate selection.
   *
   * Removing an entry here is most of the work of enabling it; the rest is the
   * address capture the two delivery modes need.
   */
  private static readonly UNSUPPORTED_SERVICES = ['DineIn', 'Delivery', 'Shipping'];

  /** Services the chosen branch offers and this storefront can actually fulfil. */
  async services(branchId: string): Promise<CheckoutService[]> {
    if (!branchId) return [];
    try {
      const env = await firstValueFrom(
        this.http.get<Envelope<any>>(
          this.url('branch', `getServices/${encodeURIComponent(branchId)}`),
          { headers: this.headers() },
        ),
      );
      const list: any[] = Array.isArray(env?.data) ? env.data : (env?.data?.list ?? []);
      return list
        .map(s => ({ id: String(s?.id ?? ''), name: String(s?.name ?? '') }))
        .filter(s => s.name && !CheckoutApiService.UNSUPPORTED_SERVICES.includes(s.name));
    } catch {
      return [];
    }
  }

  /**
   * Place the order, then read it back.
   *
   * Checkout deletes the Redis cart, so the local session is dropped on
   * success — keeping it would leave every later add reusing a dead id.
   */
  async placeOrder(req: PlaceOrderRequest): Promise<{ ok: boolean; msg?: string; order?: PlacedOrder }> {
    const sessionId = this.cart.state().sessionId;
    if (!sessionId) return { ok: false, msg: 'Your cart has expired. Please add your items again.' };

    try {
      // Set the service ON THE CART first. This is not optional plumbing:
      // checkOut takes a serviceName and uses it to resolve serviceId, but it
      // never assigns cart.serviceName — and the branch check downstream reads
      // cart.serviceName, so a cart created without one fails with
      // "Service Name Is Require" no matter what checkOut was sent. Verified:
      // bare createCart -> addItem -> checkOut fails; inserting this call makes
      // it succeed. ChangeService preserves the lines and keeps the session id.
      const changed = await firstValueFrom(
        this.http.post<Envelope<any>>(this.url('cart', 'ChangeService'), {
          sessionId,
          branchId:    req.branchId,
          serviceName: req.serviceName,
        }, { headers: this.headers(), withCredentials: true }),
      );
      if (changed?.success === false) {
        return { ok: false, msg: changed?.msg || 'That service is not available at this branch' };
      }

      const env = await firstValueFrom(
        this.http.post<Envelope<any>>(this.url('cart', 'checkOut'), {
          sessionId,
          branchId:    req.branchId,
          serviceName: req.serviceName,
          note:        req.note ?? '',
          customer:    { name: req.name, phone: req.phone },
          payment:     { name: CASH_PAYMENT_NAME },
        }, { headers: this.headers(), withCredentials: true }),
      );

      if (env?.success === false) return { ok: false, msg: env?.msg || 'Could not place your order' };

      // Read the order back BEFORE clearing the session — getOrder is keyed by
      // it. Cash checkout returns no data of its own, so this is the only
      // confirmation there is.
      const order = await this.order(sessionId);
      this.cart.clearSession();

      return { ok: true, order: order ?? undefined };
    } catch (e: any) {
      const errs = e?.error?.errors;
      return {
        ok: false,
        msg: Array.isArray(errs) ? errs.map((x: any) => x?.msg).filter(Boolean).join(', ')
          : (e?.error?.msg ?? e?.message ?? 'Could not place your order'),
      };
    }
  }

  /** The placed order, by the cart session it came from. */
  async order(sessionId: string): Promise<PlacedOrder | null> {
    try {
      const env = await firstValueFrom(
        this.http.get<Envelope<any>>(
          this.url('cart', `getOrder/${encodeURIComponent(sessionId)}`),
          { headers: this.headers(), withCredentials: true },
        ),
      );
      const d = env?.data;
      if (!d?.id) return null;
      return {
        id:          String(d.id),
        // Blank until staff ACCEPT the order: InvoiceRepo.saveOpenInvoice
        // assigns the number then (and flips onlineStatus to 'Accepted'), so a
        // freshly placed online order genuinely has no human-facing reference.
        // Falling back to the row id would hand the shopper a UUID and imply it
        // is a number they can quote, which it is not.
        reference:   String(d.invoiceNumber || ''),
        total:       Number(d.total ?? 0),
        status:      String(d.onlineData?.onlineStatus ?? d.status ?? ''),
        serviceName: String(d.serviceName ?? ''),
      };
    } catch {
      return null;
    }
  }
}
