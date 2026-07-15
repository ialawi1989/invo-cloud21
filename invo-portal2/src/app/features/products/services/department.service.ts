import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/** Per-language overrides — `{ name: { en, ar, … } }`. */
export interface DepartmentTranslation {
  name?: Record<string, string>;
  [key: string]: unknown;
}

/** Full department record (get-one / save round-trip). */
export interface Department {
  /** `null` on create — backend assigns the id on save. */
  id: string | null;
  name: string;
  translation?: DepartmentTranslation;
  companyId?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/** A department with its categories (from `getDepartments`) — used to feed the
 *  category form's department picker. */
export interface DepartmentWithCategories {
  id: string;
  name: string;
  categories: { id: string; name: string }[];
}

export interface DepartmentListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue?: string; sortDirection?: 'asc' | 'desc' };
}

export interface DepartmentListRow {
  id: string;
  name: string;
}

export interface DepartmentListResult {
  list: DepartmentListRow[];
  count: number;
  pageCount: number;
}

/**
 * DepartmentService — wraps the legacy `product/*Department*` endpoints.
 * Mirrors the normalising pattern of the other product services so the pages
 * never touch the wire shape.
 */
@Injectable({ providedIn: 'root' })
export class DepartmentService {
  private api = inject(ApiService);

  async getList(params: DepartmentListParams = {}): Promise<DepartmentListResult> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      sortBy: params.sortBy ?? {},
    };
    const res = await this.api.request<any>(this.api.post('product/getDepartmentList', body));
    const raw: any[] = res?.data?.list ?? [];
    const list: DepartmentListRow[] = raw.map((d) => ({
      id: String(d?.id ?? ''),
      name: String(d?.name ?? ''),
    }));
    return {
      list,
      count: Number(res?.data?.count ?? list.length) || 0,
      pageCount: Number(res?.data?.pageCount ?? 1) || 1,
    };
  }

  /** All departments (each with its categories) — for pickers. */
  async getDepartments(): Promise<DepartmentWithCategories[]> {
    const res = await this.api.request<any>(this.api.get('product/getDepartments/'));
    const raw: any[] = Array.isArray(res?.data) ? res.data : [];
    return raw.map((d) => ({
      id: String(d?.id ?? ''),
      name: String(d?.name ?? ''),
      categories: Array.isArray(d?.categories)
        ? d.categories.map((c: any) => ({ id: String(c?.id ?? ''), name: String(c?.name ?? '') }))
        : [],
    }));
  }

  async getOne(id: string): Promise<Department | null> {
    const res = await this.api.request<any>(this.api.get(`product/getDepartment/${id}`));
    const raw = res?.data ?? null;
    if (!raw) return null;
    return {
      id: String(raw?.id ?? ''),
      name: String(raw?.name ?? ''),
      translation: (raw?.translation && typeof raw.translation === 'object') ? { ...raw.translation } : undefined,
      companyId: raw?.companyId,
      createdAt: raw?.createdAt,
      ...raw,
    };
  }

  /** Create (id empty/null) or update. */
  async save(payload: Partial<Department>): Promise<{ success: boolean; data?: any }> {
    const res = await this.api.request<any>(this.api.post('product/saveDepartment', payload));
    return { success: !!res?.success, data: res?.data };
  }

  async delete(id: string): Promise<{ success: boolean }> {
    const res = await this.api.request<any>(this.api.delete(`product/deleteDepartment/${id}`));
    return { success: !!res?.success };
  }
}
