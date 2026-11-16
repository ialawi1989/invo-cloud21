import { Injectable, inject } from '@angular/core';

import { EditSettings } from '../models/common.model';
import { CustomerTier, CustomerTierAction, CustomerTierSettings, CustomerTierUpdate } from '../models/tiers.model';
import { PageInfo, PromotionsApiService, SortInfo } from './promotions-api.service';

/**
 * Customer-tiers part of the legacy `PromotionsService` — same endpoints and
 * payloads; the settings object is cached on the service exactly like the
 * legacy one (the page edits it in place, `save` PUTs it).
 */
@Injectable({ providedIn: 'root' })
export class TiersService {
  private api = inject(PromotionsApiService);

  customerTierSettings!: CustomerTierSettings;

  getCustomerTiers(): CustomerTier[] {
    return this.customerTierSettings.customerTiers;
  }

  addCustomerTier(maxTiers: number): void {
    if (this.customerTierSettings.customerTiers.length < maxTiers) {
      this.customerTierSettings.customerTiers.push({
        id: '',
        name: {},
        minNumberOfOrders: 0,
        minAmountSpend: 0,
        customerCount: 0,
        enabled: true,
      });
    }
  }

  removeTier(index: number): void {
    this.customerTierSettings.customerTiers.splice(index, 1);
  }

  setCustomerTierSettings(settings: CustomerTierSettings): void {
    this.customerTierSettings = settings;
  }

  async getCustomerTierSettings(): Promise<CustomerTierSettings> {
    this.customerTierSettings = await this.api.get<CustomerTierSettings>('promotions/customer-tiers');
    return this.customerTierSettings;
  }

  getCustomerTierAction = (pageInfo?: PageInfo, sortInfo?: SortInfo): Promise<CustomerTierAction[]> =>
    this.api.get<CustomerTierAction[]>('promotions/customer-tiers-history', { pageInfo, sortInfo });

  async saveCustomerTierSettings(update: CustomerTierUpdate, settings = this.customerTierSettings): Promise<void> {
    const payload: EditSettings<CustomerTierSettings> = {
      setting: settings,
      reason: update.reason,
      note: update.note,
    };
    await this.api.put('promotions/customer-tiers', payload);
  }

  async evaluateCustomerCounts(action: CustomerTierUpdate): Promise<CustomerTierSettings> {
    await this.api.put('promotions/customer-tiers-evaluate', action);
    return this.customerTierSettings;
  }
}
