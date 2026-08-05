import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TenantService } from '../blog/services/tenant.service';

/** Subset of the `shop/getProduct` payload this page renders. Everything
 *  else on the record (variants, taxes, kit contents…) is ignored for now. */
export interface StorefrontProduct {
  id:            string;
  name:          string;
  description?:  string;
  defaultPrice?: number;
  comparePriceAt?: number | null;
  barcode?:      string;
  sku?:          string;
  brandName?:    string;
  mediaUrl?:     string;
  medias?:       Array<{ url?: string; defaultUrl?: string } | string>;
  UOM?:          string;
  warning?:      string;
  productAttributes?: Array<{ name?: string; value?: string; [k: string]: any }>;
  /** `{ name: { en, ar }, body: { … } }` — per-language overrides. */
  translation?:  Record<string, Record<string, string>>;
  [k: string]: any;
}

interface ApiEnvelope<T> {
  success: boolean;
  msg:     string;
  data:    T;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Same rule the dashboard uses to derive a default URL slug from a name,
 *  so `Credit Notes` ⇄ `credit-notes` round-trips. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Client for the public product endpoint.
 *
 * Mirrors `PublicBlogApiService`: POSTs to
 * `/v1/ecommerce/<slug>/shop/<action>`, sends `X-Sub-Domain` in lockstep
 * with the path slug, and unwraps the `{ success, msg, data }` envelope.
 *
 * `getProduct` accepts a product id or an SEO slug; see the note on that
 * method for how a slug is resolved while the backend still keys on UUID.
 */
@Injectable({ providedIn: 'root' })
export class ProductApiService {
  private http   = inject(HttpClient);
  private tenant = inject(TenantService);

  private base = environment.apiBase;

  private company(): string {
    return this.tenant.slug();
  }

  private url(action: string): string {
    return `${this.base}/v1/ecommerce/${encodeURIComponent(this.company())}/shop/${action}`;
  }

  /**
   * Fetch one product by id **or** SEO slug.
   *
   * `shop/getProduct` only understands a UUID (it hands the value straight to
   * a uuid column), so a slug is resolved here first: `generalSearch` on the
   * de-slugified words, then match on the slugified product name — which is
   * exactly how the dashboard derives a default slug. Costs one extra request,
   * and only for slug URLs.
   *
   * This is a temporary bridge. Once `ShopRepo.getProduct` resolves slugs, drop
   * `resolveSlug` and pass the key straight through. It also can't find a
   * product whose SEO slug was hand-edited to something unlike its name —
   * that genuinely needs the backend lookup.
   */
  async getProduct(key: string): Promise<StorefrontProduct | null> {
    if (!key) return null;

    // Preferred: the backend resolves uuid-or-slug in one indexed query.
    if (!this.byKeyUnavailable) {
      const direct = await this.fetchByKey(key);
      if (direct) return direct;
    }

    // Fallback for deployments without that endpoint: search, then fetch.
    const id = UUID_RE.test(key) ? key : await this.resolveSlug(key);
    return id ? this.fetchById(id) : null;
  }

  /** Set once `website/getProductByKey` proves absent, so we stop paying for a
   *  round-trip that will never succeed on this deployment. */
  private byKeyUnavailable = false;

  private async fetchByKey(key: string): Promise<StorefrontProduct | null> {
    try {
      const env = await firstValueFrom(
        this.http.post<ApiEnvelope<StorefrontProduct>>(
          `${this.base}/v1/ecommerce/${encodeURIComponent(this.company())}/website/getProductByKey`,
          { key },
          { headers: new HttpHeaders({ 'X-Sub-Domain': this.company() }), withCredentials: true },
        ),
      );
      // `success:false` here means "no such product" — a real answer, not a
      // missing endpoint, so don't disable the fast path for it.
      if (env?.success && env.data?.name) return env.data;
      if (env?.success === false) return null;
      return null;
    } catch (e) {
      if (e instanceof HttpErrorResponse && (e.status === 404 || e.status === 501)) {
        this.byKeyUnavailable = true;
      }
      return null;
    }
  }

  /** Slug → product id via the public search endpoint. */
  private async resolveSlug(slug: string): Promise<string | null> {
    const searchTerm = slug.replace(/-+/g, ' ').trim();
    if (!searchTerm) return null;
    try {
      const env = await firstValueFrom(
        this.http.post<ApiEnvelope<{ list?: Array<{ id?: string; name?: string }> }>>(
          this.url('generalSearch'),
          { searchTerm, page: 1, limit: 20 },
          { headers: new HttpHeaders({ 'X-Sub-Domain': this.company() }), withCredentials: true },
        ),
      );
      const list = env?.data?.list ?? [];
      const hit = list.find(item => slugify(String(item?.name ?? '')) === slug.toLowerCase());
      return hit?.id ?? null;
    } catch {
      return null;
    }
  }

  private async fetchById(key: string): Promise<StorefrontProduct | null> {
    try {
      const env = await firstValueFrom(
        this.http.post<ApiEnvelope<StorefrontProduct>>(
          this.url('getProduct'),
          { productId: key },
          { headers: new HttpHeaders({ 'X-Sub-Domain': this.company() }), withCredentials: true },
        ),
      );
      if (!env || env.success === false || !env.data?.name) return null;
      return env.data;
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status >= 400 && e.status < 500) return null;
      throw e;
    }
  }
}
