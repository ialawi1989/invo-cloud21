import { Injectable, inject } from '@angular/core';

import { TranslatedString } from '../models/common.model';
import { PromotionsApiService } from './promotions-api.service';

const BASE = 'promotions/promotions-points';

/** The subset of the legacy points settings the sales screens need. */
export interface PointsSettings {
  enabled: boolean;
  pointsValue: number;
  currencyValue: number;
  paymentMethodId: string;
}

export interface CustomerPointsSummary {
  customerTierId: string;
  activePoints: number;
}

export interface CustomerPointsSpend {
  actionName: 'SPEND_POINTS';
  reason: TranslatedString;
  note: string;
  pointsValue: number;
  spentOrderNumber: string;
  spentOrderId: string;
  paymentLineId: string;
}

/**
 * Points part of the legacy `PromotionsService` used while taking a payment — same endpoints and
 * payloads, only the transport differs (`PromotionsApiService`).
 */
@Injectable({ providedIn: 'root' })
export class PointsService {
  private api = inject(PromotionsApiService);

  getPointsSettings = (): Promise<PointsSettings> => this.api.get<PointsSettings>(`${BASE}/settings`);

  async getCustomerPointsSummary(phoneNumber = ''): Promise<CustomerPointsSummary> {
    if (!phoneNumber) return { activePoints: 0, customerTierId: '' };
    return this.api.get<CustomerPointsSummary>(`${BASE}/customer-points/summary/${encodeURIComponent(phoneNumber)}`);
  }

  updateCustomerPointsSpend(phoneNumber: string, update: CustomerPointsSpend): Promise<string> {
    return this.api.patch<string>(`${BASE}/customer-points?phoneNumber=${encodeURIComponent(phoneNumber)}`, update);
  }
}
