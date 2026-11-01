import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/** The seven entity kinds the Translation page edits. */
export type TranslationEntity =
  | 'products'
  | 'matrixes'
  | 'departments'
  | 'categories'
  | 'option-groups'
  | 'options'
  | 'brands';

export interface TranslationListParams {
  page: number;
  limit: number;
  searchTerm?: string;
  sortBy?: { sortValue: string; sortDirection: 'asc' | 'desc' };
  /** Products only — same filter object `product/getProductList` takes. */
  filter?: Record<string, any>;
}

export interface TranslationListResult {
  /** Raw rows — `translation` is kept intact so every language survives a round-trip. */
  list: any[];
  count: number;
  pageCount: number;
}

interface EntityRoutes {
  list: string;
  save: string;
}

/**
 * Routes are the ones the legacy Translation page uses (InvoCloudFront2
 * `products-translations`), verified against InvoCloudBack's product router.
 * Every save endpoint takes `{ list: [{ id, translation }] }` and REPLACES the
 * whole `translation` column, so callers must send the full object.
 */
const ROUTES: Record<TranslationEntity, EntityRoutes> = {
  products:        { list: 'product/getProductList',        save: 'product/updateTranslation' },
  matrixes:        { list: 'product/getMatrixList',         save: 'product/updateMatrixTranslation' },
  departments:     { list: 'product/getDepartmentList',     save: 'product/updateDepartmentTranslation' },
  categories:      { list: 'product/getCategoryList',       save: 'product/updateCategoriesTranslation' },
  'option-groups': { list: 'product/getOptionGroupList',    save: 'product/updateOptionGroupTranslation' },
  options:         { list: 'product/getOptionsList',        save: 'product/updateOptionTranslation' },
  brands:          { list: 'product/getBrandList',          save: 'product/updateBrandsTranslation' },
};

/**
 * Bulk Translation service — paged raw lists + bulk translation saves for all
 * product-catalogue entities. The per-entity services strip `translation` from
 * their list rows, so this page talks to the same endpoints directly.
 */
@Injectable({ providedIn: 'root' })
export class BulkTranslationService {
  private api = inject(ApiService);

  async getList(entity: TranslationEntity, params: TranslationListParams): Promise<TranslationListResult> {
    const body: Record<string, any> = {
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm ?? '',
    };
    // Omit sortBy when unset: the backend treats a present-but-empty object as a
    // sort on column "undefined"; absent means its own default order.
    if (params.sortBy?.sortValue) body['sortBy'] = params.sortBy;
    if (params.filter) body['filter'] = params.filter;
    if (entity === 'products') body['columns'] = ['id', 'name', 'type', 'translation'];

    const res = await this.api.request<any>(this.api.post(ROUTES[entity].list, body));
    const data = res?.data ?? {};
    const list: any[] = Array.isArray(data.list) ? data.list : [];
    return {
      list,
      count: Number(data.count ?? list.length) || 0,
      pageCount: Number(data.pageCount ?? 1) || 1,
    };
  }

  async save(
    entity: TranslationEntity,
    list: { id: string; translation: Record<string, any> }[],
  ): Promise<{ success: boolean; msg?: string }> {
    const res = await this.api.request<any>(this.api.post(ROUTES[entity].save, { list }));
    return { success: !!res?.success, msg: res?.msg };
  }
}
