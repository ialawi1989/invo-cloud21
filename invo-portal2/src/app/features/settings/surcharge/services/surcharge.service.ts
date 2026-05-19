import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import {
  Surcharge,
  SurchargeListParams,
  SurchargeListResponse,
} from './surcharge.types';

/**
 * Wraps the legacy account/surcharge endpoints.
 *
 *   POST accounts/getSurchargeList   → paginated list
 *   GET  accounts/getSurcharge/:id   → single read
 *   POST accounts/saveSurcharge      → upsert
 *   GET  accounts/deleteSurcharge/:id → delete (legacy verb;
 *                                       adjust if the server
 *                                       uses a different one)
 *
 * Wire format matches the legacy `Surcharge` model verbatim, so
 * we don't normalise anything here — values round-trip as-is.
 */
@Injectable({ providedIn: 'root' })
export class SurchargeService {
  private api = inject(ApiService);

  async getList(params: SurchargeListParams = {}): Promise<SurchargeListResponse> {
    const body = {
      page:       params.page  ?? 1,
      limit:      params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      sortBy:     params.sortBy ?? {},
    };
    const res = await this.api.request<any>(
      this.api.post('accounts/getSurchargeList', body),
    );
    const data = res?.data ?? {};
    const list: any[] = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
    return {
      list:      list.map(this.normalize),
      count:     Number(data?.count ?? list.length) || 0,
      pageCount: Number(data?.pageCount ?? Math.ceil((data?.count ?? list.length) / (body.limit || 15))) || 1,
    };
  }

  async getById(id: string): Promise<Surcharge | null> {
    const res = await this.api.request<any>(
      this.api.get(`accounts/getSurcharge/${id}`),
    );
    if (!res?.success && res?.success !== undefined) return null;
    const raw = res?.data ?? res;
    if (!raw || typeof raw !== 'object') return null;
    return this.normalize(raw);
  }

  async save(s: Surcharge): Promise<{ id: string } | null> {
    const res = await this.api.request<any>(
      this.api.post('accounts/saveSurcharge', s),
    );
    if (!res?.success) return null;
    const newId = res?.data?.id ?? s.id;
    return newId ? { id: String(newId) } : null;
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.api.request<any>(
      this.api.get(`accounts/deleteSurcharge/${id}`),
    );
    return !!res?.success;
  }

  /** Coerce server response into the canonical front-end shape.
   *  Numbers may arrive as strings, `percentage` as a 0/1 flag,
   *  `taxId` may be missing — normalise all three. */
  private normalize(raw: any): Surcharge {
    return {
      id:         String(raw?.id ?? ''),
      name:       String(raw?.name ?? ''),
      amount:     Number(raw?.amount ?? 0) || 0,
      percentage: !!raw?.percentage,
      companyId:  raw?.companyId ? String(raw.companyId) : undefined,
      taxId:      raw?.taxId ? String(raw.taxId) : null,
    };
  }
}
