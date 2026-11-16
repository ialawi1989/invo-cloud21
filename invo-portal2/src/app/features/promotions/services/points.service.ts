import { Injectable, inject } from '@angular/core';

import { EditSettings, TranslatedString } from '../models/common.model';
import {
  CustomerPoint,
  CustomerPointAction,
  CustomerPointsActionName,
  CustomerPointsSettingAction,
  CustomerPointsSummary,
  CustomerPointUpdate,
  PointsSettings,
} from '../models/points.model';
import { PageInfo, PromotionsApiService, SortInfo } from './promotions-api.service';

const BASE = 'promotions/promotions-points';

export type { CustomerPointsSummary, PointsSettings } from '../models/points.model';

export interface CustomerPointsSpend {
  actionName: 'SPEND_POINTS';
  reason: TranslatedString;
  note: string;
  pointsValue: number;
  spentOrderNumber: string;
  spentOrderId: string;
  paymentLineId: string;
  paidAmount?: number;
}

/**
 * Points part of the legacy `PromotionsService` — same endpoints, payloads and
 * argument order; only the transport differs (`PromotionsApiService`). Used
 * both by the points screens and by the payment widget.
 */
@Injectable({ providedIn: 'root' })
export class PointsService {
  private api = inject(PromotionsApiService);

  getPointsSettings = (): Promise<PointsSettings> => this.api.get<PointsSettings>(`${BASE}/settings`);

  async setPointsSettings(settings: EditSettings<PointsSettings>): Promise<void> {
    await this.api.put(`${BASE}/settings`, settings);
  }

  getPointsActionsList = (pageInfo?: PageInfo, sortInfo?: SortInfo): Promise<CustomerPointsSettingAction[]> =>
    this.api.get<CustomerPointsSettingAction[]>(`${BASE}/history`, { pageInfo, sortInfo });

  sendAddCustomerPoints(customerPoints: CustomerPoint): Promise<string> {
    return this.api.post<string>(`${BASE}/send-Add-Customer-Points`, customerPoints);
  }

  addCustomerPoints(customerPoints: CustomerPoint): Promise<string> {
    return this.api.post<string>(`${BASE}/customer-points`, customerPoints);
  }

  private updateCustomerPoints(id: string, update: CustomerPointUpdate & Record<string, any>): Promise<string> {
    return this.api.patch<string>(`${BASE}/customer-points/${id}`, update);
  }

  updateCustomerPointsSpend(phoneNumber: string, update: CustomerPointsSpend): Promise<string> {
    return this.api.patch<string>(`${BASE}/customer-points?phoneNumber=${encodeURIComponent(phoneNumber)}`, update);
  }

  async cancelCustomerPoints(id: string, reason: TranslatedString, notes: string): Promise<void> {
    await this.updateCustomerPoints(id, { actionName: CustomerPointsActionName.CANCEL_POINTS, reason, note: notes });
  }

  async restoreCustomerPoints(id: string, reason: TranslatedString, notes: string): Promise<void> {
    await this.updateCustomerPoints(id, { actionName: CustomerPointsActionName.RESTORE_POINTS, reason, note: notes });
  }

  async activateCustomerPoints(id: string, reason: TranslatedString, notes: string): Promise<void> {
    await this.updateCustomerPoints(id, { actionName: CustomerPointsActionName.ACTIVATE, reason, note: notes });
  }

  async spendCustomerPoints(
    id: string,
    reason: TranslatedString,
    notes: string,
    amount: number,
    spentOrderNumber: string,
    spentOrderId: string,
  ): Promise<void> {
    await this.updateCustomerPoints(id, {
      actionName: CustomerPointsActionName.SPEND_POINTS,
      reason,
      note: notes,
      pointsValue: amount,
      spentOrderNumber: spentOrderNumber ?? '',
      spentOrderId: spentOrderId ?? '',
    });
  }

  async refundCustomerPoints(id: string, reason: TranslatedString, notes: string, amount: number): Promise<void> {
    await this.updateCustomerPoints(id, {
      actionName: CustomerPointsActionName.REFUND,
      reason,
      note: notes,
      pointsValue: amount,
    });
  }

  async extendCustomerPoints(id: string, reason: TranslatedString, notes: string, newDate: any): Promise<void> {
    await this.updateCustomerPoints(id, {
      actionName: CustomerPointsActionName.EXTEND,
      reason,
      note: notes,
      expiryDate: newDate,
    });
  }

  getCustomerPoints = (searchCriteria = '', pageInfo?: PageInfo, sortInfo?: SortInfo): Promise<CustomerPoint[]> => {
    let url = `${BASE}/customer-points`;
    if (searchCriteria && searchCriteria.trim() != '') url += '?searchCriteria=' + encodeURIComponent(searchCriteria);
    return this.api.get<CustomerPoint[]>(url, { pageInfo, sortInfo });
  };

  async getCustomerPointsSummary(phoneNumber = ''): Promise<CustomerPointsSummary> {
    if (!phoneNumber) return { activePoints: 0, customerTierId: '' };
    const result = await this.api.get<CustomerPointsSummary>(
      `${BASE}/customer-points/summary/${encodeURIComponent(phoneNumber)}`,
    );
    return result ?? { activePoints: 0, customerTierId: '' };
  }

  getCustomerPoint = (id = ''): Promise<CustomerPoint> => this.api.get<CustomerPoint>(`${BASE}/customer-points/${id}`);

  getCustomerPointAction = (id = '', pageInfo?: PageInfo, sortInfo?: SortInfo): Promise<CustomerPointAction[]> =>
    this.api.get<CustomerPointAction[]>(`${BASE}/customer-points-action/${id}`, { pageInfo, sortInfo });

  getAllActions(phoneNumber: string, pageInfo?: PageInfo, sortInfo?: SortInfo): Promise<CustomerPointAction[]> {
    return this.api.get<CustomerPointAction[]>(`${BASE}/statement/${encodeURIComponent(phoneNumber)}`, { pageInfo, sortInfo });
  }
}
