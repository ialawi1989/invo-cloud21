import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import {
  Option, PriceManagement, PriceManagementListParams, PriceManagementListResult, PriceManagementRow, RepeatType, emptyRepeatDays,
} from '../models/price-management.model';

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/**
 * Price management API - the `product/*PriceManagement*` endpoints of the legacy `PriceManagementService`
 * (InvoCloudBack `routes/v1/app/product.ts` -> `PriceManagmentController`), same paths, verbs and payloads.
 */
@Injectable({ providedIn: 'root' })
export class PriceManagementService {
  private api = inject(ApiService);

  async getList(params: PriceManagementListParams = {}): Promise<PriceManagementListResult> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      // Left out when unsorted: the backend reads `sortBy.sortValue` straight into its ORDER BY (an empty `{}` breaks it).
      ...(params.sortBy ? { sortBy: params.sortBy } : {}),
    };
    const res = await this.api.request<any>(this.api.post('product/getPriceManagementList', body));
    const list: PriceManagementRow[] = res?.data?.list ?? [];
    return { list, count: num(res?.data?.count ?? list.length), pageCount: num(res?.data?.pageCount ?? 1) || 1 };
  }

  async getById(id: string): Promise<PriceManagement | null> {
    const res = await this.api.request<any>(this.api.get('product/getPriceManagement/' + id));
    const d = res?.data;
    if (!d?.id) return null;
    return {
      id: d.id,
      title: d.title ?? '',
      repeat: (d.repeat ?? '') as RepeatType | '',
      priceLabelId: d.priceLabelId ?? '',
      branchIds: Array.isArray(d.branchIds) ? d.branchIds : [],
      fromDate: d.fromDate ? new Date(d.fromDate) : new Date(),
      toDate: d.toDate ? new Date(d.toDate) : new Date(),
      fromTime: d.fromTime || '12:00:00',
      toTime: d.toTime || '12:00:00',
      discountId: d.discountId ?? '',
      chargeId: d.chargeId ?? '',
      repeatDays: { ...emptyRepeatDays(), ...(d.repeatDays ?? {}) },
    };
  }

  /** Returns the raw `{ success, msg, data }` envelope. */
  async save(p: PriceManagement): Promise<any> {
    return this.api.request<any>(this.api.post('product/savePriceManagement', p));
  }

  /**
   * `true` when no other price management overlaps the interval. (The backend answers `success: false` on a clash; the legacy
   * service resolved `response.success` as-is.)
   */
  async isDateRangeFree(p: { id?: string; fromDate: Date; toDate: Date }): Promise<boolean> {
    const body: any = { fromDate: new Date(p.fromDate), toDate: new Date(p.toDate) };
    if (p.id) body.id = p.id;
    const res = await this.api.request<any>(this.api.post('product/validatePriceManagementDate', body));
    return !!res?.success;
  }

  /** `company/validateName` with `tableName: 'priceManage'`; `success: true` means the title is free. */
  async isTitleFree(title: string, id?: string | null): Promise<boolean> {
    const body: any = { tableName: 'priceManage', name: title };
    if (id) body.id = id;
    const res = await this.api.request<any>(this.api.post('company/validateName', body));
    return !!res?.success;
  }

  // ── Lookups (same endpoints the legacy form loaded up-front) ───────────────
  async getPriceLabels(): Promise<Option[]> {
    const res = await this.api.request<any>(this.api.post('product/getPriceLabelList', {}));
    return this.opts(res?.data);
  }
  async getSurcharges(): Promise<Option[]> {
    const res = await this.api.request<any>(this.api.post('accounts/getSurchargeList', { page: 1, limit: 1000, searchTerm: '' }));
    return this.opts(res?.data);
  }
  async getDiscounts(): Promise<Option[]> {
    const res = await this.api.request<any>(this.api.post('accounts/getDiscountList', { page: 1, limit: 1000, searchTerm: '' }));
    return this.opts(res?.data);
  }
  async getBranches(): Promise<Option[]> {
    const res = await this.api.request<any>(this.api.post('branch/getBranches/', { page: 1, limit: 1000, searchTerm: '', sortBy: {} }));
    return this.opts(res?.data);
  }

  private opts(data: any): Option[] {
    const raw: any[] = Array.isArray(data?.list) ? data.list : Array.isArray(data) ? data : [];
    return raw.map(o => ({ id: String(o.id), name: String(o.name ?? '') }));
  }
}
