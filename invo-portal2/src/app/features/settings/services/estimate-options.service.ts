import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '@core/http/api.service';
import { CompanyService } from '@core/auth/company.service';

/**
 * EstimateOptionsService
 * ──────────────────────
 * Manages estimate-specific settings (default note + terms). Reads from the
 * cached `CompanyService.settings` signal and writes back via
 * `POST company/saveCompany`, refreshing the cache on success. Mirrors
 * InvoiceOptionsService.
 */
@Injectable({ providedIn: 'root' })
export class EstimateOptionsService {
  private api     = inject(ApiService);
  private company = inject(CompanyService);

  /** Returns the latest company-settings payload, refetching if missing. */
  async getCompany(force = false): Promise<any> {
    return this.company.loadSettings(force);
  }

  /**
   * Save the estimate options payload (note, term). After a successful save
   * we re-load settings so cached signals propagate.
   */
  async saveCompany(payload: any): Promise<any> {
    const res = await firstValueFrom(this.api.post<any>('company/saveCompany', payload));
    if (res?.success) {
      await this.company.loadSettings(true);
    }
    return res;
  }
}
