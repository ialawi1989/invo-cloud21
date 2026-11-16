import { Injectable, inject } from '@angular/core';

import { EditSettings, TranslatedString } from '../models/common.model';
import {
  Coupon,
  CouponAction,
  CouponActionName,
  CouponSetsAction,
  CouponSetsActionName,
  CouponSetsSettings,
  CouponSetsSettingsAction,
  CouponSetsStatues,
  CouponSetUpdate,
  CouponUpdate,
  PromotionsCouponSet,
} from '../models/coupons.model';
import { PageInfo, PromotionsApiService, SortInfo } from './promotions-api.service';

const BASE = 'promotions/promotions-coupons';

/**
 * Coupons / stamp-cards part of the legacy `PromotionsService` — same endpoints,
 * payloads and argument order (note `getCoupons` / `getCouponSetAction` take
 * sortInfo BEFORE pageInfo, as legacy); only the transport differs.
 */
@Injectable({ providedIn: 'root' })
export class CouponsService {
  private api = inject(PromotionsApiService);

  isCouponSetNameExists(name: string, lang: string, id?: string): Promise<boolean> {
    let url = `${BASE}/isCouponSetNameExists?name=${encodeURIComponent(name)}&lang=${lang}`;
    if (id) url += `&id=${encodeURIComponent(id)}`;
    return this.api.get<boolean>(url);
  }

  addCouponSet(couponSet: PromotionsCouponSet): Promise<string> {
    return this.api.post<string>(`${BASE}/couponSet`, couponSet);
  }

  async setCouponSetsSettings(settings: EditSettings<CouponSetsSettings>): Promise<void> {
    await this.api.put(`${BASE}/settings`, settings);
  }

  getCouponSetsSettings = (): Promise<CouponSetsSettings> => this.api.get<CouponSetsSettings>(`${BASE}/settings`);

  async generateUniquePrefix(name?: string): Promise<string> {
    const url = name ? `${BASE}/generateUniquePrefix/${encodeURIComponent(name)}` : `${BASE}/generateUniquePrefix`;
    const { codePrefix } = await this.api.get<{ codePrefix: string }>(url);
    return codePrefix;
  }

  getCouponSetsActionsList = (pageInfo?: PageInfo, sortInfo?: SortInfo): Promise<CouponSetsSettingsAction[]> =>
    this.api.get<CouponSetsSettingsAction[]>(`${BASE}/history`, { pageInfo, sortInfo });

  async issueCoupon(coupon: Coupon, count: number, reason: TranslatedString, note?: string): Promise<string> {
    const id = await this.api.post<string>(`${BASE}/coupon`, { coupon, count, reason, note });
    // backend may answer 200 with { success: false, message } (e.g. "There is an active stamp card")
    let parsed: any = id;
    if (typeof id === 'string') {
      try { parsed = JSON.parse(id); } catch { parsed = id; }
    }
    if (parsed && typeof parsed === 'object' && parsed.success === false) {
      throw new Error(parsed.message || 'UNKNOWN ERROR');
    }
    return id;
  }

  sendIssueCoupon(coupon: Coupon): Promise<string> {
    return this.api.post<string>(`${BASE}/sendIssueCoupon`, { coupon });
  }

  activateCouponSet(id: string, reason: TranslatedString, note: string) {
    return this.patchCouponsSet(id, { actionName: CouponSetsActionName.ACTIVATE, reason, note });
  }
  deactivateCouponSet(id: string, reason: TranslatedString, note: string) {
    return this.patchCouponsSet(id, { actionName: CouponSetsActionName.DEACTIVATE, reason, note });
  }

  getCouponSet<T extends PromotionsCouponSet>(id = ''): Promise<T> {
    return this.api.get<T>(`${BASE}/couponSet/${id}`);
  }

  getCoupon<T extends Coupon>(id = ''): Promise<T> {
    return this.api.get<T>(`${BASE}/coupon/${id}`);
  }

  getCouponSets = (
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
    couponStatue?: CouponSetsStatues,
    minData = false,
    couponSetName?: string | null,
    couponSetType?: string | null,
  ): Promise<PromotionsCouponSet[]> => {
    let url = `${BASE}/couponSets?A`;
    if (couponSetName && couponSetName.trim() !== '') url += `&couponSetName=${encodeURIComponent(couponSetName)}`;
    if (couponSetType && couponSetType.trim() !== '') url += `&couponSetType=${encodeURIComponent(couponSetType)}`;
    if (couponStatue) url += `&couponStatue=${encodeURIComponent(couponStatue)}`;
    if (minData) url += `&minData=true`;
    return this.api.get<PromotionsCouponSet[]>(url, { pageInfo, sortInfo });
  };

  getCoupons = (couponSetId: string, sortInfo?: SortInfo, pageInfo?: PageInfo): Promise<Coupon[]> =>
    this.api.get<Coupon[]>(`${BASE}/coupons/${couponSetId}`, { pageInfo, sortInfo });

  getCouponSetAction = (id = '', sortInfo?: SortInfo, pageInfo?: PageInfo): Promise<CouponSetsAction[]> =>
    this.api.get<CouponSetsAction[]>(`${BASE}/couponSet-action/${id}`, { pageInfo, sortInfo });

  getCouponAction = (id = '', pageInfo?: PageInfo, sortInfo?: SortInfo): Promise<CouponAction[]> =>
    this.api.get<CouponAction[]>(`${BASE}/coupon-action/${id}`, { pageInfo, sortInfo });

  updateCouponsSet(couponSet: PromotionsCouponSet, reason: TranslatedString, note?: string): Promise<string> {
    return this.api.put<string>(`${BASE}/couponSet/${couponSet.id}`, { ...couponSet, reason, note });
  }

  patchCouponsSet(id: string, update: CouponSetUpdate): Promise<string> {
    return this.api.patch<string>(`${BASE}/couponSet/${id}`, update);
  }

  updateCoupons(coupon: Coupon, reason: TranslatedString, note?: string): Promise<string> {
    return this.api.put<string>(`${BASE}/coupon/${coupon.id}`, { ...coupon, reason, note });
  }

  patchCoupons(id: string, update: CouponUpdate): Promise<string> {
    return this.api.patch<string>(`${BASE}/coupon/${id}`, update);
  }

  async activateCoupon(id: string, reason: TranslatedString, note: string) {
    await this.patchCoupons(id, { actionName: CouponActionName.ACTIVATE, reason, note });
  }
  async deactivateCoupon(id: string, reason: TranslatedString, note: string) {
    await this.patchCoupons(id, { actionName: CouponActionName.DEACTIVATE, reason, note });
  }
  async cancelCoupon(id: string, reason: TranslatedString, note: string) {
    await this.patchCoupons(id, { actionName: CouponActionName.CANCEL, reason, note });
  }
  async stampCard(id: string, reason: TranslatedString, note: string, stampCount: number) {
    await this.patchCoupons(id, { actionName: CouponActionName.STAMPED, reason, note, stampCount });
  }
  async unStampCard(id: string, reason: TranslatedString, note: string, stampCount: number) {
    await this.patchCoupons(id, { actionName: CouponActionName.UNSTAMPED, reason, note, stampCount });
  }
  async uncancelCoupon(id: string, reason: TranslatedString, note: string) {
    await this.patchCoupons(id, { actionName: CouponActionName.UNCANCEL, reason, note });
  }
  async extendCoupon(id: string, expiryDate: Date, reason: TranslatedString, note: string) {
    await this.patchCoupons(id, { actionName: CouponActionName.EXTEND, expiryDate, reason, note });
  }
}
