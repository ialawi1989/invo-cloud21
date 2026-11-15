import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import { SalesLookupsService } from '../../../account/services/sales-lookups.service';
import { InventoryLocationService } from '../../../products/services/inventory-location.service';
import { ProductsService } from '../../../products/services/products.service';
import {
  CountBatch, CountLine, CountListParams, CountListResult, CountRow, CountSerial, CountStatus, PhysicalCount, enteredOf, expectedOf,
} from '../models/physical-count.model';

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** A product offered for counting (`product/getPhysicalCountProducts` and its by-category / by-inventory variants). */
export interface CountProduct {
  id: string;
  name: string;
  barcode: string;
  UOM: string;
  type: string;
  unitCost: number;
  onHand: number;
  categoryName: string;
}

const COUNTABLE = new Set(['inventory', 'kit', 'serialized', 'batch']);

const mapProduct = (p: any): CountProduct => ({
  id: p.id, name: p.name ?? '', barcode: p.barcode ?? '', UOM: p.UOM ?? '', type: p.type ?? '',
  unitCost: num(p.unitCost), onHand: num(p.onHand), categoryName: p.categoryName ?? '',
});

/**
 * Physical counts API - the `product/*physicalCount*` endpoints of the legacy `PhysicalCountService`
 * (InvoCloudBack `routes/v1/app/product.ts` -> `PhysicalCountController`), same paths, verbs and payloads.
 */
@Injectable({ providedIn: 'root' })
export class PhysicalCountService {
  private api = inject(ApiService);
  private lookups = inject(SalesLookupsService);
  private locations = inject(InventoryLocationService);
  private products = inject(ProductsService);

  async getList(params: CountListParams = {}): Promise<CountListResult> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      // Left out when unsorted: the backend reads `sortBy.sortValue` straight into its ORDER BY.
      ...(params.sortBy ? { sortBy: params.sortBy } : {}),
      filter: params.filter ?? {},
    };
    const res = await this.api.request<any>(this.api.post('product/getphysicalCountList', body));
    const list: CountRow[] = res?.data?.list ?? [];
    return { list, count: num(res?.data?.count ?? list.length), pageCount: num(res?.data?.pageCount ?? 1) || 1 };
  }

  async getById(id: string): Promise<PhysicalCount | null> {
    const res = await this.api.request<any>(this.api.get('product/getphysicalCount/' + id));
    const d = res?.data;
    if (!d?.id) return null;
    const status = (d.status ?? 'Open') as CountStatus;
    return {
      id: d.id, reference: d.reference ?? '', status, note: d.note ?? '', type: d.type ?? '', branchId: d.branchId ?? '',
      branchName: d.branchName ?? '', createdDate: d.createdDate ?? '', calculatedDate: d.calculatedDate ?? null, closedDate: d.closedDate ?? null,
      createdEmployeeId: d.createdEmployeeId ?? null, calculatedEmployeeId: d.calculatedEmployeeId ?? null, closedEmployeeId: d.closedEmployeeId ?? null,
      createdEmployeeName: d.createdEmployeeName ?? '', calculatedEmployeeName: d.calculatedEmployeeName ?? '', closedEmployeeName: d.closedEmployeeName ?? '',
      lines: (d.lines ?? []).map((l: any) => this.mapLine(l)),
    };
  }

  private mapLine(l: any): CountLine {
    return {
      id: l.id ?? '', productId: l.productId ?? '', productName: l.productName ?? '', UOM: l.UOM ?? '', barcode: l.barcode ?? '',
      categoryName: l.categoryName ?? '', productType: l.productType ?? '', unitCost: num(l.unitCost),
      enteredQty: num(l.enteredQty), expectedQty: num(l.expectedQty),
      // The backend nests the saved sub-lines under their product. A serial sub-line carries 1 / 0 as its entered quantity.
      serials: (l.serials ?? []).map((s: any): CountSerial => ({ id: s.id ?? '', serial: s.serial ?? '', isAvailable: num(s.enteredQty) > 0, unitCost: num(s.unitCost) })),
      batches: (l.batches ?? []).map((b: any): CountBatch => ({
        id: b.id ?? '', batch: b.batch ?? '', enteredQty: num(b.enteredQty), expectedQty: num(b.expectedQty), unitCost: num(b.unitCost),
      })),
    };
  }

  /** Accounting entries of a closed count (`{ accountType, debit, credit }` rows). */
  async getJournal(id: string): Promise<{ accountType: string; debit: number; credit: number }[]> {
    const res = await this.api.request<any>(this.api.get('product/getPhysicalCountJournal/' + id));
    return res?.data?.defaultJournals ?? [];
  }

  /** Every product a branch can count (inventory, kit, batch, serialized), paged. */
  async getBranchProducts(params: { branchId: string; page: number; limit: number; searchTerm?: string }): Promise<{ list: CountProduct[]; count: number }> {
    const res = await this.api.request<any>(this.api.post('product/getPhysicalCountProducts', { ...params, searchTerm: params.searchTerm ?? '', sortBy: {} }));
    const list = (res?.data?.list ?? []).map(mapProduct);
    return { list, count: num(res?.data?.count ?? list.length) };
  }

  /** All the products of a branch (the "count everything" start); pages through the endpoint. */
  async getAllBranchProducts(branchId: string): Promise<CountProduct[]> {
    const limit = 200;
    const out: CountProduct[] = [];
    for (let page = 1; page <= 50; page++) {
      const { list, count } = await this.getBranchProducts({ branchId, page, limit });
      out.push(...list);
      if (out.length >= count || list.length < limit) break;
    }
    return out;
  }

  async getProductsByInventory(branchId: string, locationIds: string[]): Promise<CountProduct[]> {
    const res = await this.api.request<any>(this.api.post('product/getPhysicalCountProductsbyInventory', { branchId, inventorylocationsid: locationIds }));
    return (Array.isArray(res?.data) ? res.data : []).map(mapProduct);
  }

  async getProductsByCategory(branchId: string, categoryIds: string[]): Promise<CountProduct[]> {
    const res = await this.api.request<any>(this.api.post('product/getPhysicalCountProductsbyCategory', { branchId, categoryId: categoryIds }));
    return (Array.isArray(res?.data) ? res.data : []).map(mapProduct);
  }

  /** Products by barcode, for the import: only the types a count can take, with the branch's on-hand and unit cost. */
  async getProductsByBarcodes(barcodes: string[], branchId: string): Promise<CountProduct[]> {
    const rows = await this.products.getBarcodesProducts(barcodes, branchId);
    return rows
      .filter((p: any) => COUNTABLE.has(p.type))
      .map((p: any) => {
        const bp = (p.branchProduct ?? []).find((x: any) => x.branchId === branchId);
        return mapProduct({ ...p, onHand: bp?.onHand, unitCost: bp?.unitCost ?? p.unitCost });
      });
  }

  /** Inventory locations of a branch, for the "by inventory" start. */
  async getLocations(branchId: string): Promise<{ id: string; name: string }[]> {
    const res = await this.locations.getList({ page: 1, limit: 200, searchTerm: '', branches: [branchId] });
    return res.list.map(l => ({ id: l.id, name: l.name }));
  }

  /** A fresh line for a product picked for counting: serials and batches are loaded from the branch. */
  async newLine(p: CountProduct, branchId: string): Promise<CountLine> {
    const line: CountLine = {
      id: '', productId: p.id, productName: p.name, UOM: p.UOM, barcode: p.barcode, categoryName: p.categoryName, productType: p.type,
      unitCost: p.unitCost, enteredQty: 0, expectedQty: p.onHand, serials: [], batches: [],
    };
    if (p.type === 'serialized') {
      const serials = await this.lookups.getProductSerials(p.id, branchId);
      // The lookup carries no count-line id: a new serial is inserted by the backend.
      line.serials = serials.map((s: any): CountSerial => ({ id: '', serial: s.serial ?? '', isAvailable: false, unitCost: num(s.unitCost) }));
    } else if (p.type === 'batch') {
      const batches = await this.lookups.getProductBatches(p.id, branchId);
      line.batches = batches.map((b: any): CountBatch => ({
        id: '', batch: b.batch ?? '', enteredQty: 0, expectedQty: num(b.onHand), unitCost: num(b.unitCost), expireDate: b.expireDate ?? null,
      }));
    }
    return line;
  }

  /** Batches the branch received after the count was opened (so they can still be counted). */
  async missingBatches(line: CountLine, branchId: string): Promise<CountBatch[]> {
    const have = new Set(line.batches.map(b => b.batch));
    const batches = await this.lookups.getProductBatches(line.productId, branchId);
    return batches.filter((b: any) => !have.has(b.batch)).map((b: any): CountBatch => ({
      id: '', batch: b.batch ?? '', enteredQty: 0, expectedQty: num(b.onHand), unitCost: num(b.unitCost), expireDate: b.expireDate ?? null,
    }));
  }

  /** Returns the raw `{ success, msg, data }` envelope. */
  async remove(id: string): Promise<any> {
    return this.api.request<any>(this.api.delete('product/deletePhysicalCount/' + id));
  }

  /**
   * Creates (no id) or updates a count. The backend re-reads the on-hand and unit cost of every line itself; what it takes
   * from the client is the entered quantity, the status and, for serial / batch products, the sub-lines.
   */
  async save(c: PhysicalCount): Promise<any> {
    const body = {
      id: c.id || '',
      reference: c.reference,
      status: c.status,
      note: c.note,
      type: c.type,
      branchId: c.branchId,
      // The backend writes these columns as sent on an update, so the employees recorded earlier travel back unchanged.
      // A null date or id is left out: the validator only accepts strings.
      ...(c.createdDate ? { createdDate: new Date(c.createdDate).toISOString() } : { createdDate: new Date().toISOString() }),
      ...(c.calculatedDate ? { calculatedDate: new Date(c.calculatedDate).toISOString() } : {}),
      ...(c.closedDate ? { closedDate: new Date(c.closedDate).toISOString() } : {}),
      ...(c.createdEmployeeId ? { createdEmployeeId: c.createdEmployeeId } : {}),
      ...(c.calculatedEmployeeId ? { calculatedEmployeeId: c.calculatedEmployeeId } : {}),
      ...(c.closedEmployeeId ? { closedEmployeeId: c.closedEmployeeId } : {}),
      lines: c.lines.map(l => ({
        id: l.id || '', productId: l.productId, productType: l.productType, enteredQty: enteredOf(l), expectedQty: expectedOf(l),
        unitCost: l.unitCost, isDeleted: !!l.isDeleted,
        serials: l.serials.map(s => ({ id: s.id || '', serial: s.serial, isAvailable: s.isAvailable, unitCost: s.unitCost })),
        batches: l.batches.map(b => ({ id: b.id || '', batch: b.batch, enteredQty: b.enteredQty })),
      })),
    };
    return this.api.request<any>(this.api.post('product/savePhysicalCount', body));
  }
}
