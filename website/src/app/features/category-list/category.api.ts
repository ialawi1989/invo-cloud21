import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TenantService } from '../blog/services/tenant.service';

interface Envelope<T> { success: boolean; msg: string; data: T; }

export interface CategoryTile {
  id:        string;
  name:      string;
  mediaUrl?: string;
}

/** A department and the categories under it — the shape the API returns. */
export interface CategoryGroup {
  id:         string;
  name:       string;
  categories: CategoryTile[];
}

/**
 * Categories for the `category-list` page type.
 *
 * `shop/getCompanyCategories` returns departments each carrying their
 * categories, which is also how the page presents them — so nothing is
 * flattened and re-grouped on the way through.
 */
@Injectable({ providedIn: 'root' })
export class CategoryApiService {
  private http   = inject(HttpClient);
  private tenant = inject(TenantService);

  async load(branchId?: string): Promise<CategoryGroup[]> {
    try {
      const env = await firstValueFrom(
        this.http.post<Envelope<any[]>>(
          `${environment.apiBase}/v1/ecommerce/${encodeURIComponent(this.tenant.slug())}/shop/getCompanyCategories`,
          { branchId },
          {
            headers: new HttpHeaders({ 'X-Sub-Domain': this.tenant.slug() }),
            withCredentials: true,
          },
        ),
      );
      const list = Array.isArray(env?.data) ? env.data : [];
      return list
        .map((group: any) => ({
          id:   String(group?.id ?? ''),
          name: String(group?.name ?? ''),
          categories: (Array.isArray(group?.categories) ? group.categories : []).map((c: any) => ({
            id:       String(c?.id ?? ''),
            name:     String(c?.name ?? ''),
            mediaUrl: typeof c?.mediaUrl === 'string' ? c.mediaUrl : (c?.mediaUrl?.defaultUrl ?? ''),
          })),
        }))
        .filter(group => group.categories.length > 0);
    } catch {
      return [];
    }
  }
}
