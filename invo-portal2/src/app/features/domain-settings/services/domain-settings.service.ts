import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import { DomainSettings, RegisterDomainPayload, emptyDomainSettings } from '../models/domain-settings.model';

export interface DomainActionResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Domain settings API - the legacy `CompanyService` domain endpoints, same paths, verbs and payloads
 * (InvoCloudBack `routes/v1/app/company.ts` -> `DomainController`). Self-contained: nothing else uses it.
 *   GET    company/domainStatus
 *   POST   company/registerDomain
 *   POST   company/approveDomain   (empty body)
 *   DELETE company/deleteDomain
 */
@Injectable({ providedIn: 'root' })
export class DomainSettingsService {
  private api = inject(ApiService);

  /** Merges known keys only (legacy `DomainSettings.ParseJson`). */
  parse(json: any): DomainSettings {
    const out = emptyDomainSettings();
    if (!json || typeof json !== 'object') return out;
    for (const key of Object.keys(out) as (keyof DomainSettings)[]) {
      if (key in json) (out as any)[key] = json[key];
    }
    if (!Array.isArray(out.validationCNAMEs)) out.validationCNAMEs = [];
    return out;
  }

  /** `null` when the backend reports failure (no domain registered, tenant gone...), like the legacy non-`DomainSettings` result. */
  async status(): Promise<DomainSettings | null> {
    const res = await this.api.request<any>(this.api.get('company/domainStatus'));
    return res?.success ? this.parse(res.data || {}) : null;
  }

  register(payload: RegisterDomainPayload): Promise<DomainActionResult> {
    return this.action(this.api.post('company/registerDomain', payload));
  }

  approve(): Promise<DomainActionResult> {
    return this.action(this.api.post('company/approveDomain', {}));
  }

  remove(): Promise<DomainActionResult> {
    return this.action(this.api.delete('company/deleteDomain'));
  }

  private async action(obs: ReturnType<ApiService['get']>): Promise<DomainActionResult> {
    const res = await this.api.request<any>(obs);
    return { success: !!res?.success, message: res?.message || res?.msg || '', data: res?.data };
  }
}
