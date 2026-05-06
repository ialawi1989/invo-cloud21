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
        this.api.post('company/saveCompany', payload)
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
