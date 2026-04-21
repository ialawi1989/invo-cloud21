import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/http';
import {
  ProductActivity,
  ProductSalesStats,
  ProductSalesPage,
  SalesByServiceRow,
  Last12MonthRow,
  SalesByDayRow,
  PurchaseHistoryPage,
  ProductMovementPage,
} from './product.types';

/**
 * Product Collection Service
 * Handles collections, categories, brands, product details, stats, activity,
 * sales reports, purchase history, product movement.
 */
@Injectable({ providedIn: 'root' })
export class ProductCollectionService {
  private api = inject(ApiService);

  // ─── Collections ───────────────────────────────────────────

  async getCollectionList(param: any = null): Promise<any> {
    const res = await this.api.request(this.api.post('company/getCollectionList', param));
    return res?.data ?? [];
  }

  async getCollectionById(id: string): Promise<any> {
    return this.api.call(this.api.get(`company/getCollectionById/${id}`));
  }

  async saveCollection(data: any): Promise<any> {
    return this.api.request(this.api.post('company/saveCollection', data));
  }

  async getCollectionProducts(param: any): Promise<any> {
    const res = await this.api.request(this.api.post('company/getCollectionProducts', param));
    return res?.data;
  }

  async getSectionData(param: any = null): Promise<any> {
    return this.api.request(this.api.post('company/getSectionData', param));
  }

  // ─── Category & Brand ─────────────────────────────────────

  async saveCategoryProducts(categoryInfo: any): Promise<any> {
    return this.api.request(this.api.post('product/saveCategoryProducts', categoryInfo));
  }

  async saveProductBrand(brandInfo: any): Promise<any> {
    return this.api.request(this.api.post('product/saveNewBrand', brandInfo));
  }

  // ─── Product Details ───────────────────────────────────────

  async getProductDetails(productId: string): Promise<any> {
    return this.api.call(this.api.get(`product/getProductDetails/${productId}`));
  }

  // ─── Activity ──────────────────────────────────────────────

  async getProductActivity(productId: string): Promise<ProductActivity | null> {
    const res = await this.api.request(this.api.get(`product/getProductActivity/${productId}`));
    const raw = res?.data;
    return Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
  }

  // ─── Stats ─────────────────────────────────────────────────

  async getProductStats(productId: string): Promise<ProductSalesStats | null> {
    const res = await this.api.request(this.api.get(`product/getProductStats/${productId}`));
    if (res?.success === false) return null;
    const raw = res?.data;
    const row = Array.isArray(raw) ? raw[0] : raw;
    if (!row) return null;
    const coerced: any = {};
    for (const [key, value] of Object.entries(row)) {
      coerced[key] = value != null ? Number(value) : null;
    }
    return coerced as ProductSalesStats;
  }

  // ─── Sales ─────────────────────────────────────────────────

  async getProductSales(
    params: { page: number; limit: number },
    productId: string,
  ): Promise<ProductSalesPage> {
    const res = await this.api.request(this.api.post(`product/getProductSales/${productId}`, params));
    const rawList = (res as any)?.list ?? res?.data?.list ?? [];
    return {
      list:    Array.isArray(rawList) ? rawList : [],
      hasNext: !!(res?.data?.has_next ?? (res?.data as any)?.hasNext ?? false),
      count:   Number(res?.data?.count ?? rawList.length ?? 0),
    };
  }

  async getProductSalesByService(productId: string): Promise<SalesByServiceRow[]> {
    const res = await this.api.request(this.api.post(`product/getProductSalesByService/${productId}`));
    if (res?.success === false) return [];
    const raw = res?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }

  async getProductLast12MonthSales(productId: string): Promise<Last12MonthRow[]> {
    const res = await this.api.request(this.api.post(`product/getProductLast12MonthSales/${productId}`));
    if (res?.success === false) return [];
    const raw = res?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }

  async getProductSalesByDay(productId: string): Promise<SalesByDayRow[]> {
    const res = await this.api.request(this.api.post(`product/getProductSalesByDay/${productId}`));
    if (res?.success === false) return [];
    const raw = res?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }

  // ─── Purchase History ──────────────────────────────────────

  async getProductPurchaseHistory(params: any): Promise<PurchaseHistoryPage> {
    const res = await this.api.request(this.api.post('accounts/getProductPurchaseHistory', params));
    const data = res?.data ?? {};
    return {
      list:      Array.isArray(data.list) ? data.list : [],
      pageCount: Number(data.pageCount ?? 1),
      count:     Number(data.count ?? 0),
    };
  }

  // ─── Product Movement ──────────────────────────────────────
  /**
   * NOTE: Temporary home. Will move to a dedicated ReportsService once that
   * feature is ported. Endpoint is POST accounts/reports/{route} with
   * pagination fields flattened inside filter.
   */
  async getProductMovement(params: {
    route: string;
    page?: number;
    limit?: number;
    searchTerm?: string;
    sortBy?: any;
    filter?: any;
  }): Promise<ProductMovementPage> {
    const { route, page, limit, searchTerm, sortBy, filter } = params;
    const body: any = { filter: { ...(filter ?? {}) } };
    if (page)       body.filter.page       = page;
    if (limit)      body.filter.limit      = limit;
    if (searchTerm) body.filter.searchTerm = searchTerm;
    if (sortBy)     body.filter.sortBy     = sortBy;

    const res = await this.api.request(this.api.post(`accounts/reports/${route}`, body));
    const data = res?.data ?? {};
    return {
      records:   Array.isArray(data.records) ? data.records : (Array.isArray(data.list) ? data.list : []),
      pageCount: Number(data.pageCount ?? 1),
      count:     Number(data.count ?? 0),
    };
  }
}
