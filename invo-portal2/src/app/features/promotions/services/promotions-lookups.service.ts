import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';

import { ProductInfo } from '../models/coupons.model';
import { ServiceManagementService } from '../../settings/service-management/services/service.service';
import { PageInfo, PromotionsApiService } from './promotions-api.service';

export interface LookupItem { id: string; name: string }

/**
 * Lists the coupon / campaign forms pick from. Same calls the legacy pages made:
 * `branch/getBranches` (all branches), `branch/getServicList` (all services) and
 * `promotions/promotions-campaigns/products` (product search, 5 per page).
 */
@Injectable({ providedIn: 'root' })
export class PromotionsLookupsService {
  private api = inject(ApiService);
  private promoApi = inject(PromotionsApiService);
  private services = inject(ServiceManagementService);

  private branches?: LookupItem[];

  async getBranches(): Promise<LookupItem[]> {
    if (this.branches) return this.branches;
    const res = await this.api.request<{ list?: any[] }>(
      this.api.post('branch/getBranches/', { page: 1, limit: 1000, searchTerm: '', sortBy: {} }),
    );
    const list = res?.data?.list ?? [];
    this.branches = list.map((b: any) => ({ id: b.id, name: b.name }));
    return this.branches;
  }

  async getServices(): Promise<LookupItem[]> {
    const res = await this.services.getList({ page: 1, limit: 1000, searchTerm: '' } as any);
    return (res.list ?? []).map((s: any) => ({ id: s.id, name: s.name }));
  }

  getProducts(productName?: string | null, pageInfo?: PageInfo): Promise<ProductInfo[]> {
    let url = `promotions/promotions-campaigns/products?A`;
    if (productName && productName.trim() !== '') url += `&productName=${encodeURIComponent(productName)}`;
    return this.promoApi.get<ProductInfo[]>(url, { pageInfo });
  }
}
