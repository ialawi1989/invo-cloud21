import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/** A member option inside a group. */
export interface OptionGroupOption {
  index: number;
  optionId: string;
  name: string;
  price: number;
  /** Default quantity of this option when the group is applied. */
  qty: number;
  thumbnailUrl?: string;
}

export interface OptionGroupTranslation {
  name?: Record<string, string>;
  alias?: Record<string, string>;
  [key: string]: unknown;
}

/** Full option-group record (get-one / save). */
export interface OptionGroup {
  /** `null` on create. */
  id: string | null;
  title: string;
  alias: string;
  minSelectable: number;
  maxSelectable: number;
  options: OptionGroupOption[];
  translation?: OptionGroupTranslation;
  mediaId?: string | null;
  [key: string]: unknown;
}

export interface OptionGroupListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue?: string; sortDirection?: 'asc' | 'desc' };
}

export interface OptionGroupListRow {
  id: string;
  /** The group title, exposed as `name` so it plugs into the shared list. */
  name: string;
}

export interface OptionGroupListResult {
  list: OptionGroupListRow[];
  count: number;
  pageCount: number;
}

/** OptionGroupService — wraps the legacy `product/*OptionGroup*` endpoints. */
@Injectable({ providedIn: 'root' })
export class OptionGroupService {
  private api = inject(ApiService);

  async getList(params: OptionGroupListParams = {}): Promise<OptionGroupListResult> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      sortBy: params.sortBy ?? {},
    };
    const res = await this.api.request<any>(this.api.post('product/getOptionGroupList', body));
    const raw: any[] = res?.data?.list ?? [];
    const list: OptionGroupListRow[] = raw.map((g) => ({
      id: String(g?.id ?? ''),
      name: String(g?.title ?? ''),
    }));
    return {
      list,
      count: Number(res?.data?.count ?? list.length) || 0,
      pageCount: Number(res?.data?.pageCount ?? 1) || 1,
    };
  }

  async getOne(id: string): Promise<OptionGroup | null> {
    const res = await this.api.request<any>(this.api.get(`product/getOptionGroup/${id}`));
    const raw = res?.data ?? null;
    if (!raw) return null;
    return {
      id: String(raw?.id ?? ''),
      title: String(raw?.title ?? ''),
      alias: String(raw?.alias ?? ''),
      minSelectable: Number(raw?.minSelectable) || 0,
      maxSelectable: Number(raw?.maxSelectable) || 0,
      options: Array.isArray(raw?.options) ? raw.options.map((o: any, i: number) => this.mapOption(o, i)) : [],
      translation: (raw?.translation && typeof raw.translation === 'object') ? { ...raw.translation } : undefined,
      mediaId: raw?.mediaId ?? null,
      ...raw,
    };
  }

  async save(payload: Partial<OptionGroup>): Promise<{ success: boolean; data?: any }> {
    const body: Record<string, unknown> = {
      ...(payload ?? {}),
      options: (payload.options ?? []).map((o, i) => ({
        index: i,
        optionId: o.optionId,
        name: o.name,
        price: Number(o.price) || 0,
        qty: Number(o.qty) || 0,
      })),
    };
    const res = await this.api.request<any>(this.api.post('product/saveOptionGroup', body));
    return { success: !!res?.success, data: res?.data };
  }

  async delete(id: string): Promise<{ success: boolean }> {
    const res = await this.api.request<any>(this.api.delete(`product/deleteOptionGroup/${id}`));
    return { success: !!res?.success };
  }

  private mapOption(o: any, i: number): OptionGroupOption {
    return {
      index: typeof o?.index === 'number' ? o.index : i,
      optionId: String(o?.optionId ?? o?.id ?? ''),
      name: String(o?.name ?? ''),
      price: Number(o?.price) || 0,
      qty: Number(o?.qty) || 0,
      thumbnailUrl: o?.thumbnailUrl,
    };
  }
}
