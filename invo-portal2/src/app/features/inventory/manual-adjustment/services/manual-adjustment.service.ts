import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import {
  AdjustmentLine, AdjustmentListParams, AdjustmentListResult, AdjustmentProduct, AdjustmentRow, AdjustmentType, ManualAdjustment,
} from '../models/manual-adjustment.model';

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/**
 * Manual adjustments API - the `accounts/*ManualAdjustment*` endpoints of the legacy `InventoryMovementService` /
 * `AccountService` (InvoCloudBack `routes/v1/app/accounts.ts` -> `InventoryMovement.controller`), same paths, verbs and payloads.
 */
@Injectable({ providedIn: 'root' })
export class ManualAdjustmentService {
  private api = inject(ApiService);

  async getList(params: AdjustmentListParams = {}): Promise<AdjustmentListResult> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      // Left out when unsorted: the backend reads `sortBy.sortValue` straight into its ORDER BY.
      ...(params.sortBy ? { sortBy: params.sortBy } : {}),
      filter: params.filter ?? {},
    };
    const res = await this.api.request<any>(this.api.post('accounts/getManualAdjustmentMovementList', body));
    const list: AdjustmentRow[] = res?.data?.list ?? [];
    return { list, count: num(res?.data?.count ?? list.length), pageCount: num(res?.data?.pageCount ?? 1) || 1 };
  }

  async getById(id: string): Promise<ManualAdjustment | null> {
    const res = await this.api.request<any>(this.api.get('accounts/getManualAdjustmentMovementById/' + id));
    const d = res?.data;
    if (!d?.id) return null;
    return {
      id: d.id,
      adjustmentType: (d.adjustmentType ?? 'onHand adjustment') as AdjustmentType,
      inventoryMovmentDate: d.inventoryMovmentDate ?? d.createdAt ?? '',
      branchId: d.branchId ?? '',
      branchName: d.branchName ?? '',
      employeeName: d.employeeName ?? '',
      cost: num(d.cost),
      lines: (d.lines ?? []).map((l: any): AdjustmentLine => ({
        id: l.id ?? '', productId: l.productId ?? '', productName: l.productName ?? '', UOM: l.UOM ?? '', barcode: l.barcode ?? '',
        qty: num(l.qty), currentOnHand: num(l.currentOnHand), currentCost: num(l.currentCost), cost: num(l.cost),
        // What the stock became: the on-hand at that time plus the delta (legacy `tempQty`).
        newQty: num(l.currentOnHand) + num(l.qty),
      })),
    };
  }

  /** Accounting entries of the adjustment (`{ accountType, debit, credit }` rows). */
  async getJournal(id: string): Promise<{ accountType: string; debit: number; credit: number }[]> {
    const res = await this.api.request<any>(this.api.get('accounts/getManualAdjustmentMovementJournal/' + id));
    return res?.data?.defaultJournals ?? [];
  }

  /** Inventory products of a branch with their on-hand and last unit cost. */
  async getBranchProducts(params: { branchId: string; page: number; limit: number; searchTerm: string; date?: string }): Promise<{ list: AdjustmentProduct[]; count: number }> {
    const { date, ...rest } = params;
    const res = await this.api.request<any>(this.api.post('accounts/getManualAdjustmentProducts', { ...rest, inventoryMovmentDate: date }));
    const list: AdjustmentProduct[] = (res?.data?.list ?? []).map((p: any) => this.mapProduct(p));
    return { list, count: num(res?.data?.count ?? list.length) };
  }

  /** Products by barcode, for the import. */
  async getProductsByBarcodes(barcodes: string[], branchId: string): Promise<AdjustmentProduct[]> {
    const res = await this.api.request<any>(this.api.post('accounts/getManualAdjustmentProductsByBarcodes', { products: barcodes, branchId }));
    return (Array.isArray(res?.data) ? res.data : []).map((p: any) => this.mapProduct(p));
  }

  private mapProduct(p: any): AdjustmentProduct {
    return {
      id: p.id, name: p.name ?? '', barcode: p.barcode ?? '', UOM: p.UOM ?? '', categoryName: p.categoryName ?? '',
      onHand: num(p.onHand), unitCost: num(p.unitCost),
    };
  }

  /** Returns the raw `{ success, msg, data }` envelope. */
  async remove(id: string): Promise<any> {
    return this.api.request<any>(this.api.delete('accounts/deleteManualAdjustmentMovement/' + id));
  }

  /**
   * Creates (no id) or updates an adjustment. Only the delta (`qty`) matters for an on-hand adjustment and only the new `cost`
   * for a unit-cost one - the backend re-reads the current on-hand and cost itself.
   */
  async save(a: ManualAdjustment): Promise<any> {
    const body = {
      id: a.id || '',
      type: 'Manual Adjustment',
      adjustmentType: a.adjustmentType,
      inventoryMovmentDate: new Date(a.inventoryMovmentDate || Date.now()).toISOString(),
      branchId: a.branchId,
      lines: a.lines.map(l => ({
        id: l.id || '', productId: l.productId, qty: l.qty, cost: l.cost, currentOnHand: l.currentOnHand, currentCost: l.currentCost,
        barcode: l.barcode, productName: l.productName, UOM: l.UOM, isDeleted: !!l.isDeleted,
      })),
    };
    return this.api.request<any>(this.api.post('accounts/saveManualAdjustmentMovement', body));
  }
}
