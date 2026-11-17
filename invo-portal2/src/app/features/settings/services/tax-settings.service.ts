import { companySavePayload } from '@core/auth/employee-earnings';
import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

@Injectable({ providedIn: 'root' })
export class TaxSettingsService {
  private api = inject(ApiService);

  async getTaxesList(params: {
    page: number;
    limit: number;
    searchTerm?: string;
    sortBy?: any;
  }): Promise<any> {
    try {
      const res = await this.api.request(
        this.api.post('accounts/getTaxesList', params)
      );
      return res.data || res;
    } catch (error) {
      console.error('getTaxesList error:', error);
      throw error;
    }
  }

  async getTaxById(id: string): Promise<any> {
    const res = await this.api.request<any>(this.api.get(`accounts/getTaxById/${id}`));
    if (res?.success === false) throw new Error(typeof res?.msg === 'string' ? res.msg : 'Request failed');
    return res?.data ?? null;
  }

  /** Taxes that may be a child of a group: not groups themselves, and never the tax being edited. */
  async getChildTaxes(excludeId: string | null): Promise<{ id: string; name: string; taxPercentage: number }[]> {
    const res = await this.api.request<any>(this.api.post('accounts/getChildTaxes', { taxId: excludeId ?? '' }));
    const rows: any[] = Array.isArray(res?.data) ? res.data : [];
    return rows.map(t => ({ id: t.id, name: t.name ?? '', taxPercentage: Number(t.taxPercentage) || 0 }));
  }

  /** Add (no `id`) or edit (`id`) a tax. The backend rejects a duplicate name and the built-in taxes. */
  async saveTax(payload: any): Promise<void> {
    const res = await this.api.request<any>(this.api.post('accounts/saveTax', payload));
    if (res?.success === false) throw new Error(typeof res?.msg === 'string' ? res.msg : 'Save failed');
  }

  async setDefaultTax(taxId: string): Promise<any> {
    try {
      const res = await this.api.request(
        this.api.post('accounts/setDefaultTax', { taxId })
      );
      return res;
    } catch (error) {
      console.error('setDefaultTax error:', error);
      throw error;
    }
  }

  async saveCompany(payload: any): Promise<any> {
    try {
      const res = await this.api.request(
        this.api.post('company/saveCompany', companySavePayload(payload))
      );
      return res;
    } catch (error) {
      console.error('saveCompany error:', error);
      throw error;
    }
  }

  async assignTax(payload: any): Promise<any> {
    try {
      const res = await this.api.request(
        this.api.post('product/assignProductTax', payload)
      );
      return res;
    } catch (error) {
      console.error('assignTax error:', error);
      throw error;
    }
  }
}
