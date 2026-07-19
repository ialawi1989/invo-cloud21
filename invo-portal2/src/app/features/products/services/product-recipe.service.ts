import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/**
 * What a recipe line hangs off. The backend takes this verbatim as a path
 * segment on the saveRecipeItem / deleteRecipeItem endpoints.
 */
export type RecipeOwnerType = 'menuProduct' | 'option' | 'recipe';

/**
 * A single recipe line under a menu-item product. Either an inventory/kit
 * product (`inventoryId`) or a nested recipe (`recipeId`).
 */
export interface MenuRecipeItem {
  inventoryId?: string;
  recipeId?: string;
  name: string;
  categoryName?: string;
  UOM?: string;
  unitCost: number;
  usages: number;
  type?: string;
  // ── UI-only state (not persisted) ─────────────────────────────────────────
  /** Original usage on load — for revert + dirty detection. */
  originalUsages?: number;
  /** Row added client-side, not yet saved. */
  isNew?: boolean;
}

/** A menu-item product row with its inline recipe. */
export interface MenuItemProduct {
  id: string;
  name: string;
  barcode?: string;
  sku?: string;
  categoryName?: string;
  serviceTime?: number | null;
  unitCost?: number | null;
  recipes: MenuRecipeItem[];
  // ── UI-only state ─────────────────────────────────────────────────────────
  expanded?: boolean;
}

export interface MenuItemListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  categoryId?: string;
  sortBy?: { sortValue?: string; sortDirection?: 'asc' | 'desc' };
}

export interface MenuItemListResult {
  list: MenuItemProduct[];
  count: number;
  pageCount: number;
}

/**
 * ProductRecipeService — the "Product Recipe" quick-editor endpoints. Lists
 * menu-item products with their recipes and saves/deletes individual recipe
 * lines in place (`type = 'menuProduct'`).
 */
@Injectable({ providedIn: 'root' })
export class ProductRecipeService {
  private api = inject(ApiService);

  async getMenuItemList(params: MenuItemListParams = {}): Promise<MenuItemListResult> {
    const body: Record<string, unknown> = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      sortBy: params.sortBy ?? {},
    };
    if (params.categoryId) body['categoryId'] = params.categoryId;

    const res = await this.api.request<any>(this.api.post('product/getMenuItemList', body));
    const raw: any[] = res?.data?.list ?? [];
    const list: MenuItemProduct[] = raw.map((p) => ({
      id: String(p?.id ?? ''),
      name: String(p?.name ?? ''),
      barcode: p?.barcode ?? '',
      sku: p?.sku ?? '',
      categoryName: p?.categoryName ?? '',
      serviceTime: p?.serviceTime ?? null,
      unitCost: typeof p?.unitCost === 'number' ? p.unitCost : (p?.unitCost != null ? Number(p.unitCost) : null),
      recipes: Array.isArray(p?.recipes) ? p.recipes.map((r: any) => this.mapItem(r)) : [],
      expanded: false,
    }));
    return {
      list,
      count: Number(res?.data?.count ?? list.length) || 0,
      pageCount: Number(res?.data?.pageCount ?? 1) || 1,
    };
  }

  /**
   * The recipe lines attached to one owner. Options and recipes carry no lines
   * in their list payload, so the panel fetches them lazily when a row opens.
   *
   * The load endpoints are named per owner (unlike save/delete, which take the
   * owner as a path segment), hence the lookup.
   */
  async getItems(ownerType: RecipeOwnerType, ownerId: string): Promise<MenuRecipeItem[]> {
    const path = ownerType === 'recipe'
      ? `product/getRecipeItems/recipe/${ownerId}`
      : `product/getOptionItems/option/${ownerId}`;
    const res = await this.api.request<any>(this.api.get(path));
    const raw: any[] = Array.isArray(res?.data) ? res.data : (res?.data?.list ?? []);
    return raw.map((r) => this.mapItem(r));
  }

  /** Create/update one recipe line on a menu-item product or an option. */
  async saveRecipeItem(
    ownerType: RecipeOwnerType,
    ownerId: string,
    item: MenuRecipeItem,
  ): Promise<{ success: boolean; data?: any }> {
    const body: Record<string, unknown> = {
      name: item.name,
      usages: Number(item.usages) || 0,
    };
    if (item.recipeId) body['recipeId'] = item.recipeId;
    else body['inventoryId'] = item.inventoryId;

    const res = await this.api.request<any>(
      this.api.post(`product/saveRecipeItem/${ownerType}/${ownerId}`, body),
    );
    return { success: !!res?.success, data: res?.data };
  }

  /** Remove one recipe line. `itemId` is the line's inventoryId or recipeId. */
  async deleteRecipeItem(
    ownerType: RecipeOwnerType,
    ownerId: string,
    itemId: string,
  ): Promise<{ success: boolean }> {
    const res = await this.api.request<any>(
      this.api.delete(`product/deleteRecipeItem/${ownerType}/${ownerId}/${itemId}`),
    );
    return { success: !!res?.success };
  }

  private mapItem(r: any): MenuRecipeItem {
    // `usages` on menu-item/option payloads, `usage` on recipe payloads.
    const usages = Number(r?.usages ?? r?.usage) || 0;
    return {
      inventoryId: r?.inventoryId ? String(r.inventoryId) : undefined,
      recipeId: r?.recipeId ? String(r.recipeId) : undefined,
      name: String(r?.name ?? ''),
      categoryName: r?.categoryName ?? '',
      UOM: r?.UOM ?? '',
      unitCost: Number(r?.unitCost) || 0,
      usages,
      type: r?.type ?? '',
      originalUsages: usages,
      isNew: false,
    };
  }
}
