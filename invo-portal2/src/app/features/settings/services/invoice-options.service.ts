import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '@core/http/api.service';
import { CompanyService } from '@core/auth/company.service';

/**
 * InvoiceOptionsService
 * ─────────────────────
 * Manages invoice-specific settings like notes, terms, waste, void reason.
 * Reads from cached `CompanyService.settings` signal and writes back via
 * `POST company/saveCompany`, refreshing the cache on success.
 */
@Injectable({ providedIn: 'root' })
export class InvoiceOptionsService {
  private api     = inject(ApiService);
  private company = inject(CompanyService);

  /** Returns the latest company-settings payload, refetching if missing. */
  async getCompany(force = false): Promise<any> {
    console.log(`InvoiceOptionsService.getCompany(force=${force})`);
    try {
      const result = await this.company.loadSettings(force);
      console.log('InvoiceOptionsService - loadSettings result:', result);
      return result;
    } catch (error) {
      console.error('InvoiceOptionsService - loadSettings error:', error);
      throw error;
    }
  }

  /**
   * Save the invoice options payload (note, term, enableWaste, etc).
   * After successful save we re-load settings so cached signals propagate.
   */
  async saveCompany(payload: any): Promise<any> {
    const res = await firstValueFrom(this.api.post<any>('company/saveCompany', payload));
    if (res?.success) {
      await this.company.loadSettings(true);
    }
    return res;
  }
}
