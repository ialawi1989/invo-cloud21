import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/http';
import { BranchSummary, KitMaxQtyResponse, KitActionResponse } from './product.types';

/**
 * Product Inventory Service
 * Handles product options, availability, options availability, recipes,
 * kit build/break, tags, tax.
 */
@Injectable({ providedIn: 'root' })
export class ProductInventoryService {
  private api = inject(ApiService);

  // ─── Product Options ───────────────────────────────────────

  async setProductOptions(options: any): Promise<any> {
    return this.api.request(this.api.post('company/setProductOptions', { customFields: options }));
  }

  async getProductOptionsOld(): Promise<any> {
    const res = await this.api.request(this.api.get('company/getProductOptions/'));
    return res?.data;
  }

  async getProductOptions(): Promise<any[]> {
    const res = await this.api.request(this.api.get('company/getProductOptions/'));
    return res?.data?.customFields ?? [];
  }

  // ─── Inventory Locations ───────────────────────────────────

  async saveProductInventoryLocations(locationInfo: any): Promise<any> {
    return this.api.request(this.api.post('product/saveInventoryLocations', locationInfo));
  }

  // ─── Availability ──────────────────────────────────────────

  async getProductAvailability(productId: string): Promise<BranchSummary[]> {
    const res = await this.api.request(this.api.get(`product/getProductAvailability/${productId}`));
    const raw = res?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }

  async getBranchProductsAvailability(data: any): Promise<any> {
    return this.api.request(this.api.post('product/getBranchProductsAvailability/', data));
  }

  async setBranchProductAvailability(data: any): Promise<any> {
    return this.api.request(this.api.post('product/setBranchProductAvailability', data));
  }

  async updateAvailability(data: any): Promise<any> {
    return this.api.request(this.api.post('product/updateAvailability', data));
  }

  async updateOnlineAvailability(data: any): Promise<any> {
    return this.api.request(this.api.post('product/updateOnlineAvailability', data));
  }

  // ─── Options Availability ──────────────────────────────────

  async getOptionsBranchAvailability(id: string): Promise<any> {
    return this.api.request(this.api.get(`product/getOptionsBranchAvailability/${id}`));
  }

  async getOptionsProductAvailability(branchProdId: string): Promise<any> {
    return this.api.request(this.api.get(`product/getOptionsProductAvailability/${branchProdId}`));
  }

  async setOptionsBranchAvailability(data: any): Promise<any> {
    return this.api.request(this.api.post('product/setOptionsBranchAvailability', data));
  }

  async setOptionsProductAvailability(data: any): Promise<any> {
    return this.api.request(this.api.post('product/setOptionsProductAvailability', data));
  }

  async updateProductOptionsAvailability(data: any): Promise<any> {
    return this.api.request(this.api.post('product/updateProductOptionsAvailability', data));
  }

  async updateOnlineProductOptionsAvailability(data: any): Promise<any> {
    return this.api.request(this.api.post('product/updateOnlineProductOptionsAvailability', data));
  }

  // ─── Recipe ────────────────────────────────────────────────

  async saveProductRecipeItem(productId: string, param: any = null): Promise<any> {
    return this.api.request(this.api.post(`product/saveProductRecipeItem/${productId}`, param));
  }

  async deleteProductRecipeItem(productId: string, itemId: string): Promise<any> {
    return this.api.request(this.api.delete(`product/deleteProductRecipeItem/${productId}/${itemId}`));
  }

  // ─── Kit Builder ───────────────────────────────────────────

  async getKitMaxQty(productId: string, branchId: string): Promise<KitMaxQtyResponse> {
    const res = await this.api.request(this.api.post('product/getKitMaxQty', { productId, branchId }));
    const data = res?.data ?? {};
    const success = res?.success !== undefined ? !!res.success : (data as any)?.maximumQty !== undefined;
    return {
      success: !!success,
      data: {
        maximumQty:       Number((data as any)?.maximumQty ?? 0),
        kitBuilderUsages: Array.isArray((data as any)?.kitBuilderUsages) ? (data as any).kitBuilderUsages : [],
      },
      message: res?.msg ?? res?.message ?? '',
    };
  }

  async buildKit(productId: string, branchId: string, qty: number, branchProduct: any): Promise<KitActionResponse> {
    const res = await this.api.request(
      this.api.post('product/buildKit', { productId, branchId, onHand: qty, branchProduct }),
    );
    return { success: !!res?.success, data: res?.data ?? {}, message: res?.msg ?? res?.message ?? '' };
  }

  async breakKit(productId: string, branchId: string, qty: number): Promise<KitActionResponse> {
    const res = await this.api.request(
      this.api.post('product/breakKit', { productId, branchId, onHand: qty }),
    );
    return { success: !!res?.success, data: res?.data ?? {}, message: res?.msg ?? res?.message ?? '' };
  }

  // ─── Tags ──────────────────────────────────────────────────

  async getProductTags(params: any = null): Promise<any> {
    const res = await this.api.request(this.api.post('product/getProductTags', params));
    return res?.data;
  }

  // ─── Tax ───────────────────────────────────────────────────

  async assignProductTax(param: any): Promise<any> {
    return this.api.request(this.api.post('product/assignProductTax', param));
  }
}
