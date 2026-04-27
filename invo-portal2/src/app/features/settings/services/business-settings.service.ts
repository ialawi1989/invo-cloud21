import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '@core/http/api.service';
import { CompanyService } from '@core/auth/company.service';

/**
 * BusinessSettingsService
 * ───────────────────────
 * Thin façade for the Business Settings page. Reads come straight from the
 * cached `CompanyService.settings` signal (which is populated on app boot
 * via `loadSettings()`); writes hit `POST company/saveCompany` and re-load
 * so the rest of the app sees fresh values.
 */
@Injectable({ providedIn: 'root' })
export class BusinessSettingsService {
  private api     = inject(ApiService);
  private company = inject(CompanyService);

  /** Returns the latest company-settings payload, refetching if missing. */
  async getCompany(force = false): Promise<any> {
    return await this.company.loadSettings(force);
  }

  /**
   * Save the merged company payload (identity + locale + tax + logo).
   * After a successful save we re-load settings so cached signals
   * across the app pick up the fresh values immediately.
   */
  async saveCompany(payload: any): Promise<any> {
    const res = await firstValueFrom(this.api.post<any>('company/saveCompany', payload));
    if (res?.success) {
      // Force-refresh cached settings so name/logo/etc. propagate everywhere.
      await this.company.loadSettings(true);
    }
    return res;
  }
}
