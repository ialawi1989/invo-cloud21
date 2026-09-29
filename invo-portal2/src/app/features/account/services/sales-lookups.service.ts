import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

export interface SalesTax {
  id: string;
  name: string;
  taxPercentage: number;
  taxType: string;
  taxes: any[];
  taxTotal?: number;
  default?: boolean;
  [k: string]: any;
}

export interface SalesAccount {
  id: string;
  name: string;
  type?: string;
  [k: string]: any;
}

/**
 * Read-only lookups the sales documents (invoices, estimates, credit notes, …) share:
 * taxes, sales accounts, surcharges and the branch-scoped product picker. Endpoints and
 * payloads are the legacy ones (`accounts/*`).
 */
@Injectable({ providedIn: 'root' })
export class SalesLookupsService {
  private api = inject(ApiService);

  private async post(url: string, body: any): Promise<any> {
    return (await this.api.request(this.api.post(url, body ?? {})))?.data;
  }

  /** Every tax (legacy asked for `{ page: 1, limit: 999 }`). */
  async getTaxes(): Promise<SalesTax[]> {
    const d = await this.post('accounts/getTaxesList', { page: 1, limit: 999 });
    return d?.list ?? (Array.isArray(d) ? d : []);
  }

  /** Accounts a sale line can be posted to. */
  async getSalesAccounts(): Promise<SalesAccount[]> {
    return (await this.api.request(this.api.get('accounts/getSalesAccounts')))?.data ?? [];
  }

  async getSurcharges(params: { page: number; limit: number; searchTerm?: string; sortBy?: any; chargeId?: string | null }): Promise<any[]> {
    const body: any = { page: params.page, limit: params.limit, searchTerm: params.searchTerm ?? '', sortBy: params.sortBy ?? {} };
    if (params.chargeId) body.chargeId = params.chargeId;
    return (await this.post('accounts/getSurchargeList', body))?.list ?? [];
  }

  /** Branch-scoped product search for a document line (`accounts/getBranchProducts/`). */
  async getBranchProducts(params: {
    page: number; limit: number; searchTerm: string; sortBy?: any; branchId: string;
    customerId?: string | null; tags?: string[]; exclude?: any[];
  }): Promise<any[]> {
    const body: any = {
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm,
      sortBy: params.sortBy ?? {},
      branchId: params.branchId,
      customerId: params.customerId ?? null,
      filter: { tags: params.tags ?? [] },
    };
    if (params.exclude?.length) body.exclude = params.exclude;
    return (await this.post('accounts/getBranchProducts/', body))?.list ?? [];
  }

  /** Barcode scan on a line: returns the product record or null. */
  async getBranchProductByBarcode(searchTerm: string, branchId: string): Promise<any | null> {
    const res = await this.api.request(this.api.post('accounts/getBranchProductByBarcode/', { searchTerm, branchId }));
    return res?.data ?? null;
  }

  /** Bulk barcode import (`product/searchByBarcodes`). */
  async searchByBarcodes(barcodes: string[], type = 'invoice'): Promise<any[]> {
    const res = await this.api.request<any>(
      this.api.post('product/searchByBarcodes', { barcodes, supplierId: null, branchId: null, type }),
    );
    const d = res?.data ?? res;
    return Array.isArray(d) ? d : d?.data ?? [];
  }

  async getProductSerials(id: string, branchId: string): Promise<any[]> {
    return (await this.api.request(this.api.get(`product/getProductSerials/${branchId}/${id}`)))?.data ?? [];
  }

  async getProductBatches(id: string, branchId: string): Promise<any[]> {
    return (await this.api.request(this.api.get(`product/getProductBatches/${branchId}/${id}`)))?.data ?? [];
  }

  async getBranches(): Promise<any[]> {
    return (await this.post('branch/getBranches/', { page: 1, limit: 1000, searchTerm: '', sortBy: {} }))?.list ?? [];
  }

  /** Payment methods usable at a branch (`accounts/getMiniPaymentMethodList/`). */
  async getMiniPaymentMethods(branchId: string | null, paymentMethodId?: string | null): Promise<any[]> {
    const body: any = { branchId };
    if (paymentMethodId) body.paymentMethodId = paymentMethodId;
    return (await this.post('accounts/getMiniPaymentMethodList/', body))?.list ?? [];
  }

  /** Product tags for the item filter (`product/getProductTags`). */
  async getProductTags(p: { page: number; pageSize: number; search: string }): Promise<{ items: { label: string; value: string }[]; hasMore: boolean }> {
    const res = await this.api.request<any>(this.api.post('product/getProductTags', { page: p.page, limit: p.pageSize, searchTerm: p.search }));
    const data = res?.data;
    const list: any[] = data?.list || data || [];
    return {
      items: list.map(t => ({ label: t.tag || t.name || t, value: t.tag || t.id || t.name || t })),
      hasMore: list.length >= p.pageSize,
    };
  }
}
