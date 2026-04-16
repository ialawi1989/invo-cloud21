import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';

export interface ProductListParams {
  page: number;
  limit: number;
  searchTerm: string;
  sortBy: { sortValue?: string; sortDirection?: 'asc' | 'desc' };
  filter: { types?: string[]; departments?: string[]; categories?: string[]; tags?: string[] };
  columns?: string[];
}

export interface ProductListResponse {
  list: any[];
  count: number;
  pageCount: number;
}

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private http = inject(HttpClient);
  private baseUrl = environment.backendUrl || '';

  async getProductList(params: ProductListParams): Promise<ProductListResponse> {
    const response = await this.http.post<any>(`${this.baseUrl}/product/getProductList`, params).toPromise();
    return {
      list: response?.data?.list || [],
      count: response?.data?.count || 0,
      pageCount: response?.data?.pageCount || 0
    };
  }

  async getProduct(id: string): Promise<any> {
    const response = await this.http.get<any>(`${this.baseUrl}/product/${id}`).toPromise();
    return response?.data;
  }

  async deleteProduct(id: string): Promise<any> {
    return await this.http.delete<any>(`${this.baseUrl}/product/deleteProduct/${id}`).toPromise();
  }

  async productChildsList(params: any): Promise<ProductListResponse> {
    const response = await this.http.post<any>(`${this.baseUrl}/product/productChildsList`, params).toPromise();
    return {
      list: response?.data?.list || [],
      count: response?.data?.count || 0,
      pageCount: response?.data?.pageCount || 0
    };
  }

  async getProductTags(params: { page: number; pageSize: number; search: string } = { page: 1, pageSize: 20, search: '' }): Promise<{ items: { label: string; value: string }[]; hasMore: boolean }> {
    const response = await this.http.post<any>(`${this.baseUrl}/product/getProductTags`, {
      page: params.page, limit: params.pageSize, searchTerm: params.search
    }).toPromise();
    const data = response?.data;
    const list = data?.list || data || [];
    const count = data?.count || list.length;
    const items = list.map((t: any) => ({ label: t.tag || t.name || t, value: t.tag || t.id || t._id || t.name || t }));
    return { items, hasMore: params.page * params.pageSize < count };
  }

  async getDepartments(params: { page: number; pageSize: number; search: string } = { page: 1, pageSize: 20, search: '' }): Promise<{ items: { label: string; value: string }[]; hasMore: boolean }> {
    const response = await this.http.post<any>(`${this.baseUrl}/product/getDepartmentList`, {
      page: params.page, limit: params.pageSize, searchTerm: params.search
    }).toPromise();
    const data = response?.data;
    const list = data?.list || data || [];
    const count = data?.count || list.length;
    const items = list.map((d: any) => ({ label: d.name, value: d.id || d._id }));
    return { items, hasMore: params.page * params.pageSize < count };
  }

  async getCategories(params: { page: number; pageSize: number; search: string } = { page: 1, pageSize: 20, search: '' }): Promise<{ items: { label: string; value: string }[]; hasMore: boolean }> {
    const response = await this.http.post<any>(`${this.baseUrl}/product/getCategoryList`, {
      page: params.page, limit: params.pageSize, searchTerm: params.search
    }).toPromise();
    const data = response?.data;
    const list = data?.list || data || [];
    const count = data?.count || list.length;
    const items = list.map((c: any) => ({ label: c.name, value: c.id || c._id }));
    return { items, hasMore: params.page * params.pageSize < count };
  }

  async getCustomFields(): Promise<{ key: string; label: string; type?: string }[]> {
    try {
      const response = await this.http.get<any>(`${this.baseUrl}/company/getCustomizationByKey/product/customFields`).toPromise();
      const data = response?.data;
      let fields: any[] = data?.customFields || data?.value || (Array.isArray(data) ? data : []);
      if (!Array.isArray(fields)) return [];
      return fields
        .filter((f: any) => !f.isDeleted)
        .map((f: any) => ({
          // `abbr` is the stable identifier for the custom field (matches the
          // column name stored on each product row). Prefer it over `name`,
          // which is a mutable display label.
          key: f.abbr || f.name || f.key || f.fieldName,
          label: f.label || f.name || f.fieldName || f.abbr || f.key,
          type: f.type || 'text'
        }));
    } catch (e) {
      console.error('Failed to load custom fields', e);
      return [];
    }
  }

  showGenerateBarcode(product: any): void {
    console.log('Generate barcode for:', product);
  }

  exportProducts(ids?: string[]): void {
    const params = ids ? { ids } : {};
    this.http.post(`${this.baseUrl}/product/export`, params, { responseType: 'blob' })
      .subscribe(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `products-${new Date().getTime()}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
      });
  }
}
