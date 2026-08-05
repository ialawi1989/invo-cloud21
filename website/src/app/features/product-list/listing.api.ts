import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TenantService } from '../blog/services/tenant.service';
import { ListingSource } from '../../core/page-types/page-type.types';

interface Envelope<T> { success: boolean; msg: string; data: T; }

export interface ListingProduct {
  id:              string;
  name:            string;
  description?:    string;
  defaultPrice?:   number;
  comparePriceAt?: number | null;
  mediaUrl?:       any;
  medias?:         any[];
  [k: string]:     any;
}

export interface ListingGroup {
  id:       string;
  title:    string;
  products: ListingProduct[];
}

export interface ListingResult {
  groups: ListingGroup[];
  count:  number;
  /** Paging signal for every source. A page count is meaningless for a menu
   *  (returned whole) and unreliable for search, so lists page off this. */
  hasNext: boolean;
}

/**
 * One client for every listing source.
 *
 * Prefers `website/getListing`, which returns one normalised shape for all four
 * sources. That endpoint is additive and may not be mounted yet, so the first
 * failure falls back — permanently, for this session — to the per-source switch
 * across the legacy endpoints:
 *
 *   menu       → shop/menu/getCompanyMenu   (grouped by menu section)
 *   catalog    → shop/getCategoriesProducts (flat, paged)
 *   collection → shop/getCategoriesProducts filtered by collection
 *   search     → shop/generalSearch
 *
 * Callers see the same result either way. Once getListing is deployed
 * everywhere, delete `loadLegacy` and the flag.
 */
@Injectable({ providedIn: 'root' })
export class ListingApiService {
  private http   = inject(HttpClient);
  private tenant = inject(TenantService);

  /** Set once the unified endpoint answers 404/501, so we stop paying for a
   *  round-trip that will never succeed on this deployment. */
  private unifiedUnavailable = false;

  private url(action: string, scope: 'shop' | 'website' = 'shop'): string {
    return `${environment.apiBase}/v1/ecommerce/${encodeURIComponent(this.tenant.slug())}/${scope}/${action}`;
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ 'X-Sub-Domain': this.tenant.slug() });
  }

  private async post<T>(
    action: string,
    body: Record<string, unknown>,
    scope: 'shop' | 'website' = 'shop',
  ): Promise<T | null> {
    try {
      const env = await firstValueFrom(
        this.http.post<Envelope<T>>(this.url(action, scope), body, {
          headers: this.headers(), withCredentials: true,
        }),
      );
      return env?.success ? env.data : null;
    } catch {
      return null;
    }
  }

  async load(
    source: ListingSource,
    opts: { page?: number; limit?: number; branchId?: string; search?: string } = {},
  ): Promise<ListingResult> {
    if (!this.unifiedUnavailable) {
      const data = await this.post<any>('getListing', {
        source,
        page:       opts.page  ?? 1,
        limit:      opts.limit ?? 24,
        branchId:   opts.branchId,
        searchTerm: opts.search ?? '',
      }, 'website');

      if (data?.groups) {
        return {
          groups:  data.groups,
          count:   Number(data.count ?? 0),
          hasNext: !!data.hasNext,
        };
      }
      this.unifiedUnavailable = true;
    }
    return this.loadLegacy(source, opts);
  }

  /** Pre-getListing path — one call shape per source. */
  private async loadLegacy(
    source: ListingSource,
    opts: { page?: number; limit?: number; branchId?: string; search?: string } = {},
  ): Promise<ListingResult> {
    const page  = opts.page  ?? 1;
    const limit = opts.limit ?? 24;

    switch (source.kind) {
      case 'menu': {
        // Already grouped by menu section — the grouping IS the page.
        const data = await this.post<any[]>('menu/getCompanyMenu', {
          branchId: opts.branchId,
          menuId:   source.menuId,
        });
        const sections = Array.isArray(data) ? data : [];
        const groups: ListingGroup[] = sections.map(s => ({
          id:       String(s?.menuSectionId ?? ''),
          title:    String(s?.sectionName ?? ''),
          products: Array.isArray(s?.products) ? s.products : [],
        })).filter(g => g.products.length);
        // A menu comes back whole - there is no page 2.
        return { groups, count: groups.reduce((n, g) => n + g.products.length, 0), hasNext: false };
      }

      case 'search': {
        const data = await this.post<any>('generalSearch', { searchTerm: opts.search ?? '', page, limit });
        return this.flat(data, page, limit);
      }

      case 'collection':
      case 'catalog':
      default: {
        const data = await this.post<any>('getCategoriesProducts', {
          page,
          limit,
          branchId:     opts.branchId,
          collectionId: source.collectionId,
          categoryIds:  source.categoryIds ?? [],
        });
        return this.flat(data, page, limit);
      }
    }
  }

  /** `{list, count, pageCount}` → a single untitled group + hasNext. */
  private flat(data: any, page: number, limit: number): ListingResult {
    const list: ListingProduct[] = Array.isArray(data?.list) ? data.list : [];
    const count = Number(data?.count ?? list.length);
    const pageCount = Number(data?.pageCount ?? 0);
    // Trust the upstream's paging when it reports it; otherwise a full page is
    // the only honest signal that more may exist.
    const hasNext = pageCount > 0
      ? page < pageCount
      : (count > 0 ? page * limit < count : list.length >= limit);
    return {
      groups: list.length ? [{ id: 'all', title: '', products: list }] : [],
      count,
      hasNext,
    };
  }
}
