import { Injectable, inject } from '@angular/core';

import { TranslatedString } from '../models/common.model';
import {
  CampaignAction,
  CampaignsActionName,
  CampaignsStatues,
  CampaignUpdate,
  PromotionsCampaign,
} from '../models/campaigns.model';
import { PageInfo, PromotionsApiService, SortInfo } from './promotions-api.service';

const BASE = 'promotions/promotions-campaigns';

/**
 * Campaigns part of the legacy `PromotionsService` — same endpoints, payloads and
 * argument order; only the transport differs. (Product search lives in
 * `PromotionsLookupsService`.)
 */
@Injectable({ providedIn: 'root' })
export class CampaignsService {
  private api = inject(PromotionsApiService);

  isCampaignOverlap(startDate: Date | string, endDate: Date | string, customerTierIds: string[]): Promise<boolean> {
    return this.api.get<boolean>(
      `${BASE}/isCampaignOverlap?startDate=${startDate}&endDate=${endDate}&customerTierIds=${customerTierIds}`,
    );
  }

  isCampaignNameExists(name: string, lang: string, id?: string): Promise<boolean> {
    let url = `${BASE}/isCampaignNameExists?name=${encodeURIComponent(name)}&lang=${lang}`;
    if (id) url += `&id=${encodeURIComponent(id)}`;
    return this.api.get<boolean>(url);
  }

  getCampaigns = (
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
    campaignsStatue?: CampaignsStatues,
  ): Promise<PromotionsCampaign[]> => {
    let url = `${BASE}/campaign?A`;
    if (campaignsStatue) url += `&campaignsStatue=${encodeURIComponent(campaignsStatue)}`;
    return this.api.get<PromotionsCampaign[]>(url, { pageInfo, sortInfo });
  };

  addCampaign(campaign: PromotionsCampaign): Promise<string> {
    return this.api.post<string>(`${BASE}/campaign`, campaign);
  }

  getCampaign<T extends PromotionsCampaign = PromotionsCampaign>(id = ''): Promise<T> {
    return this.api.get<T>(`${BASE}/campaign/${id}`);
  }

  getCampaignAction = (id = '', pageInfo?: PageInfo, sortInfo?: SortInfo): Promise<CampaignAction[]> =>
    this.api.get<CampaignAction[]>(`${BASE}/campaign-action/${id}`, { pageInfo, sortInfo });

  updateCampaign(campaign: PromotionsCampaign, reason: TranslatedString, note?: string): Promise<string> {
    return this.api.put<string>(`${BASE}/campaign/${campaign.id}`, { ...campaign, reason, note });
  }

  patchCampaign(id: string, update: CampaignUpdate): Promise<string> {
    return this.api.patch<string>(`${BASE}/campaign/${id}`, update);
  }

  async stopCampaign(id: string, reason: TranslatedString, note: string): Promise<void> {
    await this.patchCampaign(id, { actionName: CampaignsActionName.STOPPED, reason, note });
  }
  async startCampaign(id: string, reason: TranslatedString, note: string): Promise<void> {
    await this.patchCampaign(id, { actionName: CampaignsActionName.STARTED, reason, note });
  }
  async extendCampaign(id: string, reason: TranslatedString, note: string, endDate: any): Promise<void> {
    await this.patchCampaign(id, { actionName: CampaignsActionName.EXTEND, reason, note, endDate });
  }
}
