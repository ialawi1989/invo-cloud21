import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

export type InventoryRequestPriority = 'High' | 'Normal' | 'Low';

/** One tax component on a line (group taxes carry several). */
export interface InventoryRequestLineTax {
  name?: string;
  taxId?: string;
  taxPercentage: number;
  taxAmount?: number;
}

export interface InventoryRequestLine {
  /** `''` for a line that was never saved. */
  id: string;
  productId: string;
  productName: string;
  /** Same as `productName` — lets the `localizedName` pipe take the line directly. */
  name: string;
  barcode: string;
  uom: string;
  translation?: any;
  qty: number;
  unitCost: number;
  supplierId: string;
  supplierName: string;
  priority: InventoryRequestPriority | string;
  taxId: string;
  taxPercentage: number;
  taxType: string;
  taxes: InventoryRequestLineTax[];
  isInclusiveTax: boolean;
}

export interface LinkedDoc { id: string; number: string }

export interface InventoryRequest {
  id: string;
  branchId: string;
  branchName: string;
  employeeId: string;
  employeeName: string;
  status: string;
  createdAt: string;
  hasSupplier: boolean;
  lines: InventoryRequestLine[];
  purchaseOrders: LinkedDoc[];
  transferOrders: LinkedDoc[];
}

export interface InventoryRequestListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue?: string; sortDirection?: 'asc' | 'desc' } | Record<string, never>;
}

export interface InventoryRequestListResult {
  list: InventoryRequest[];
  count: number;
  pageCount: number;
}

/** Product row offered by the request-line picker (`product/getInventoryRequestProducts`). */
export interface RequestProduct {
  id: string;
  name: string;
  barcode: string;
  uom: string;
  type: string;
  unitCost: number;
  taxId: string;
}

const dedupe = (rows: any[], numberKey: string): LinkedDoc[] => {
  const seen = new Set<string>();
  const out: LinkedDoc[] = [];
  for (const r of rows ?? []) {
    if (!r?.id || !r?.[numberKey] || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push({ id: String(r.id), number: String(r[numberKey]) });
  }
  return out;
};

/**
 * InventoryRequestService — wraps the legacy `product/*InventoryRequest*` endpoints
 * (InvoCloudBack `routes/v1/app/product.ts` → `InventoryRequests.controller`).
 */
@Injectable({ providedIn: 'root' })
export class InventoryRequestService {
  private api = inject(ApiService);

  async getList(params: InventoryRequestListParams = {}): Promise<InventoryRequestListResult> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      sortBy: params.sortBy ?? {},
    };
    const res = await this.api.request<any>(this.api.post('product/getInventoryRequestList', body));
    const list = (res?.data?.list ?? []).map((r: any) => this.mapRow(r));
    return {
      list,
      count: Number(res?.data?.count ?? list.length) || 0,
      pageCount: Number(res?.data?.pageCount ?? 1) || 1,
    };
  }

  async getById(id: string): Promise<InventoryRequest | null> {
    const res = await this.api.request<any>(this.api.get(`product/getInventoryRequestById/${id}`));
    const raw = res?.data;
    if (!raw?.id) return null;
    return this.mapRow(raw);
  }

  /** Create (no id) or update. Resolves with the raw `{ success, data, msg }` response. */
  async save(req: { id: string | null; branchId: string; lines: InventoryRequestLine[] }): Promise<any> {
    const body = {
      id: req.id || null,
      branchId: req.branchId,
      lines: req.lines.map((l) => ({
        id: l.id || null,
        productId: l.productId,
        // The list's `hasSupplier` counts non-null supplierIds, so "none" must be null, never ''.
        supplierId: l.supplierId || null,
        priority: l.priority || 'Normal',
        qty: l.qty,
      })),
    };
    return this.api.request<any>(this.api.post('product/saveInventoryRequest', body));
  }

  async delete(id: string): Promise<any> {
    return this.api.request<any>(this.api.delete(`product/deleteInventoryRequest/${id}`));
  }

  /** Creates one purchase order per supplier from the request and marks it Converted. */
  async convertToPurchaseOrder(requestId: string): Promise<any> {
    return this.api.request<any>(this.api.post('product/convertToPurchaseOrder', { requestId }));
  }

  /** Paged + searchable product source for the line picker (inventory / batch / serialized only). */
  async getProductsPage(p: { page: number; limit: number; searchTerm?: string }): Promise<{ items: RequestProduct[]; hasMore: boolean }> {
    const res = await this.api.request<any>(
      this.api.post('product/getInventoryRequestProducts', {
        page: p.page,
        limit: p.limit,
        searchTerm: p.searchTerm ?? '',
        sortBy: {},
      }),
    );
    const raw: any[] = res?.data?.list ?? [];
    return {
      items: raw.map((x) => ({
        id: String(x.id),
        name: String(x.name ?? ''),
        barcode: String(x.barcode ?? ''),
        uom: String(x.UOM ?? ''),
        type: String(x.type ?? ''),
        unitCost: Number(x.unitCost) || 0,
        taxId: String(x.taxId ?? ''),
      })),
      hasMore: p.page < (Number(res?.data?.pageCount) || 1),
    };
  }

  // ── mapping ──────────────────────────────────────────────────────────────
  private mapRow(r: any): InventoryRequest {
    return {
      id: String(r?.id ?? ''),
      branchId: String(r?.branchId ?? ''),
      branchName: String(r?.branchName ?? ''),
      employeeId: String(r?.employeeId ?? ''),
      employeeName: String(r?.employeeName ?? ''),
      status: String(r?.status ?? ''),
      createdAt: r?.createdAt ?? '',
      hasSupplier: !!(r?.hasSupplier ?? r?.hassupplier),
      lines: (Array.isArray(r?.lines) ? r.lines : []).map((l: any) => this.mapLine(l)),
      // The list endpoint aliases the converted POs as `purchaseOrders`; get-by-id aliases the same
      // join as `details` (and the model has no `purchaseOrders` field), so accept either.
      purchaseOrders: dedupe(r?.purchaseOrders ?? r?.details ?? [], 'purchaseNumber'),
      transferOrders: dedupe(r?.transferOrders ?? [], 'transferNumber'),
    };
  }

  private mapLine(l: any): InventoryRequestLine {
    const sel = l?.selectedItem ?? {};
    return {
      id: String(l?.id ?? ''),
      productId: String(l?.productId ?? ''),
      productName: String(sel.productName ?? sel.name ?? l?.productName ?? ''),
      name: String(sel.productName ?? sel.name ?? l?.productName ?? ''),
      barcode: String(sel.barcode ?? l?.barcode ?? ''),
      uom: String(sel.UOM ?? ''),
      translation: sel.translation ?? null,
      qty: Number(l?.qty) || 0,
      unitCost: Number(l?.unitCost) || 0,
      supplierId: l?.supplierId ? String(l.supplierId) : '',
      supplierName: String(l?.supplierName ?? ''),
      priority: String(l?.priority || 'Normal'),
      taxId: l?.taxId ? String(l.taxId) : '',
      taxPercentage: Number(l?.taxPercentage) || 0,
      taxType: String(l?.taxType ?? ''),
      taxes: Array.isArray(l?.taxes) ? l.taxes : [],
      isInclusiveTax: !!l?.isInclusiveTax,
    };
  }
}

/** A line's amounts, ported from legacy `PurchaseOrderLine.calculateAmount/calculateTax`. */
export function calcLine(l: Pick<InventoryRequestLine, 'qty' | 'unitCost' | 'taxId' | 'taxPercentage' | 'taxType' | 'taxes' | 'isInclusiveTax'>): { subTotal: number; taxTotal: number; total: number } {
  const subTotal = (l.unitCost || 0) * (l.qty || 0);
  let total = subTotal;
  let taxTotal = 0;
  if (l.taxId) {
    let base = total;
    const amt = (pct: number) => (l.isInclusiveTax ? (base * pct) / (100 + pct) : base * (pct / 100));
    if (l.taxes?.length) {
      for (const t of l.taxes) {
        const a = amt(t.taxPercentage || 0);
        taxTotal += a;
        if (l.taxType === 'stacked') base += a;
      }
    } else {
      taxTotal = amt(l.taxPercentage || 0);
    }
    if (!l.isInclusiveTax) total += taxTotal;
  }
  return { subTotal, taxTotal, total };
}
