import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/http';
import { ProductListParams, ProductListResponse, DropdownPage } from './product.types';

/**
 * Product List Service
 * Handles product listing, children, tags, departments, categories, custom fields.
 */
@Injectable({ providedIn: 'root' })
export class ProductListService {
  private api = inject(ApiService);

  async getProductList(params: ProductListParams): Promise<ProductListResponse> {
    const res = await this.api.request(this.api.post('product/getProductList', params));
    return {
      list: res?.data?.list || [],
      count: res?.data?.count || 0,
      pageCount: res?.data?.pageCount || 0,
    };
  }

  async productChildsList(params: any): Promise<ProductListResponse> {
    const res = await this.api.request(this.api.post('product/productChildsList', params));
    return {
      list: res?.data?.list || [],
      count: res?.data?.count || 0,
      pageCount: res?.data?.pageCount || 0,
    };
  }

  async getProductTags(
    params: { page: number; pageSize: number; search: string } = { page: 1, pageSize: 20, search: '' },
  ): Promise<DropdownPage> {
    const res = await this.api.request(
      this.api.post('product/getProductTags', { page: params.page, limit: params.pageSize, searchTerm: params.search }),
    );
    const data = res?.data;
    const list = data?.list || data || [];
    const count = data?.count || list.length;
    const items = list.map((t: any) => ({
      label: t.tag || t.name || t,
      value: t.tag || t.id || t._id || t.name || t,
    }));
    return { items, hasMore: params.page * params.pageSize < count };
  }

  async getDepartments(
    params: { page: number; pageSize: number; search: string } = { page: 1, pageSize: 20, search: '' },
  ): Promise<DropdownPage> {
    const res = await this.api.request(
      this.api.post('product/getDepartmentList', { page: params.page, limit: params.pageSize, searchTerm: params.search }),
    );
    const data = res?.data;
    const list = data?.list || data || [];
    const count = data?.count || list.length;
    const items = list.map((d: any) => ({ label: d.name, value: d.id || d._id }));
    return { items, hasMore: params.page * params.pageSize < count };
  }

  async getCategories(
    params: { page: number; pageSize: number; search: string; departmentId?: string | null } =
      { page: 1, pageSize: 20, search: '' },
  ): Promise<DropdownPage> {
    const body: any = {
      page: params.page,
      limit: params.pageSize,
      searchTerm: params.search,
      sortBy: {},
    };
    if (params.departmentId) body.departmentId = params.departmentId;
    const res = await this.api.request(this.api.post('product/getCategoryList', body));
    const data = res?.data;
    const list = data?.list || data || [];
    const count = data?.count || list.length;
    const items = list.map((c: any) => ({ label: c.name, value: c.id || c._id }));
    return { items, hasMore: params.page * params.pageSize < count };
  }

  // ─── Brands (dropdown) ─────────────────────────────────────
  async getBrands(
    params: { page: number; pageSize: number; search: string } = { page: 1, pageSize: 20, search: '' },
  ): Promise<DropdownPage> {
    const res = await this.api.request(
      this.api.post('product/getBrandList', {
        page: params.page,
        limit: params.pageSize,
        searchTerm: params.search,
        sortBy: {},
      }),
    );
    const data = res?.data;
    const list = data?.list || data || [];
    const count = data?.count || list.length;
    const items = list.map((b: any) => ({ label: b.name, value: b.id || b._id }));
    return { items, hasMore: params.page * params.pageSize < count };
  }

  // ─── Taxes (dropdown) ──────────────────────────────────────
  // Returns items plus the raw list so callers can compute taxPercentage
  // after a selection without re-fetching.
  async getTaxes(
    params: { page: number; pageSize: number; search: string } = { page: 1, pageSize: 20, search: '' },
  ): Promise<DropdownPage & { raw: any[] }> {
    const res = await this.api.request(
      this.api.post('accounts/getTaxesList', {
        page: params.page,
        limit: params.pageSize,
        searchTerm: params.search,
        sortBy: {},
      }),
    );
    const data = res?.data;
    const list = data?.list || data || [];
    const count = data?.count || list.length;
    const items = list.map((t: any) => ({ label: t.name, value: t.id || t._id }));
    return { items, raw: list, hasMore: params.page * params.pageSize < count };
  }

  // ─── Child products (dropdown, excludes current product) ───
  async getChildProducts(
    params: {
      page: number;
      pageSize: number;
      search: string;
      productId?: string | null;
      parentId?: string | null;
    },
  ): Promise<DropdownPage> {
    const res = await this.api.request(
      this.api.post('product/getChildProductList', {
        page: params.page,
        limit: params.pageSize,
        searchTerm: params.search,
        productId: params.productId || null,
        parentId: params.parentId || null,
      }),
    );
    const data = res?.data;
    const list = data?.list || data || [];
    const count = data?.count || list.length;
    const items = list.map((p: any) => ({
      label: p.name + (p.barcode ? ` · ${p.barcode}` : ''),
      value: p.id || p._id,
      raw: p,
    }));
    return { items, hasMore: params.page * params.pageSize < count };
  }

  async getCustomFields(): Promise<{ key: string; label: string; type?: string }[]> {
    try {
      const res = await this.api.request(this.api.get('company/getCustomizationByKey/product/customFields'));
      const data = res?.data;
      let fields: any[] = data?.customFields || data?.value || (Array.isArray(data) ? data : []);
      if (!Array.isArray(fields)) return [];
      return fields
        .filter((f: any) => !f.isDeleted)
        .map((f: any) => ({
          key: f.abbr || f.name || f.key || f.fieldName,
          label: f.label || f.name || f.fieldName || f.abbr || f.key,
          type: f.type || 'text',
        }));
    } catch (e) {
      console.error('Failed to load custom fields', e);
      return [];
    }
  }

  // ─── Media ─────────────────────────────────────────────────

  async getProductForMedia(param: any = null): Promise<any> {
    const res = await this.api.request(this.api.post('product/getProductForMedia', param));
    return res?.data ?? res;
  }

  async bulkProductMedia(payload: { productId: string; mediaIds: string[] }[]): Promise<any> {
    return this.api.request(this.api.post('product/bulkProductMedia', payload));
  }
}
